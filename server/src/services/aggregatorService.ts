import { AccountFetchError, AggregatedTweet, FeedQuery, FeedResponse, HttpError, LoadedAccountsConfig, UserProfile } from "../types";
import { loadConfiguredAccounts } from "./accountConfigService";
import { TTLCache } from "./cache";
import { buildMockTweets, buildMockUser } from "./mockData";
import { normalizeTweet, normalizeUser } from "./normalization";
import { XApiClient } from "./xApiClient";

const usernameToUserCache = new TTLCache<UserProfile>();
const accountTweetsCache = new TTLCache<AggregatedTweet[]>();
const aggregatedFeedCache = new TTLCache<FeedResponse>();

interface AccountFetchResult {
  account: string;
  tweets: AggregatedTweet[];
  error?: AccountFetchError;
}

function isMockMode(): boolean {
  const forced = process.env.USE_MOCK_MODE?.toLowerCase();
  if (forced === "true") {
    return true;
  }
  if (forced === "false") {
    return false;
  }
  return !process.env.X_BEARER_TOKEN;
}

function getMode(): "mock" | "live" {
  return isMockMode() ? "mock" : "live";
}

function sortAndDeduplicate(tweets: AggregatedTweet[]): AggregatedTweet[] {
  const deduped = new Map<string, AggregatedTweet>();
  for (const tweet of tweets) {
    if (!deduped.has(tweet.id)) {
      deduped.set(tweet.id, tweet);
    }
  }

  return [...deduped.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function aggregateTweets(tweetLists: AggregatedTweet[][]): AggregatedTweet[] {
  return sortAndDeduplicate(tweetLists.flat());
}

async function runWithConcurrency<T, R>(
  items: T[],
  maxConcurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const queueWorker = async (): Promise<void> => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;

      if (current >= items.length) {
        return;
      }

      results[current] = await worker(items[current]);
    }
  };

  const totalWorkers = Math.min(maxConcurrency, items.length);
  await Promise.all(Array.from({ length: totalWorkers }, () => queueWorker()));
  return results;
}

async function getLiveClient(retryCount: number): Promise<XApiClient> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error("X_BEARER_TOKEN is missing. Set token or enable mock mode.");
  }

  return new XApiClient({ bearerToken: token, retryCount });
}

export async function getUserByUsername(
  username: string,
  config: LoadedAccountsConfig,
  xApiClient?: XApiClient
): Promise<UserProfile> {
  const key = username.toLowerCase();
  const cached = usernameToUserCache.get(key);
  if (cached) {
    return cached;
  }

  let user: UserProfile;

  if (isMockMode()) {
    user = buildMockUser(username);
  } else {
    if (!xApiClient) {
      throw new Error("Live mode requires an initialized X API client.");
    }
    const raw = await xApiClient.getUserByUsername(username);
    user = normalizeUser(raw);
  }

  usernameToUserCache.set(key, user, config.settings.cacheTTLSeconds * 3);
  return user;
}

export async function getTweetsForUser(
  user: UserProfile,
  account: string,
  config: LoadedAccountsConfig,
  xApiClient?: XApiClient
): Promise<AggregatedTweet[]> {
  const accountCacheKey = account.toLowerCase();
  const cached = accountTweetsCache.get(accountCacheKey);
  if (cached) {
    return cached;
  }

  let tweets: AggregatedTweet[];

  if (isMockMode()) {
    tweets = buildMockTweets(user, config.settings.tweetsPerAccount);
  } else {
    if (!xApiClient) {
      throw new Error("Live mode requires an initialized X API client.");
    }

    const rawTweets = await xApiClient.getTweetsForUser(user.userId, {
      tweetsPerAccount: config.settings.tweetsPerAccount,
      excludeReplies: config.settings.excludeReplies,
      excludeRetweets: config.settings.excludeRetweets
    });

    tweets = rawTweets.map((tweet) => normalizeTweet(tweet, user));
  }

  accountTweetsCache.set(accountCacheKey, tweets, config.settings.cacheTTLSeconds);
  return tweets;
}

async function fetchOneAccount(
  account: string,
  config: LoadedAccountsConfig,
  xApiClient?: XApiClient
): Promise<AccountFetchResult> {
  try {
    const user = await getUserByUsername(account, config, xApiClient);
    const tweets = await getTweetsForUser(user, account, config, xApiClient);
    return { account, tweets };
  } catch (error) {
    const asHttpError = error as HttpError;
    return {
      account,
      tweets: [],
      error: {
        account,
        message: (error as Error).message,
        status: asHttpError?.status,
        code: asHttpError?.code
      }
    };
  }
}

export async function refreshFeed(forceRefresh = false): Promise<FeedResponse> {
  const config = await loadConfiguredAccounts();
  const cacheKey = `full:${config.configPath}`;

  if (!forceRefresh) {
    const cached = aggregatedFeedCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        meta: {
          ...cached.meta,
          fromCache: true
        }
      };
    }
  }

  const liveClient = isMockMode() ? undefined : await getLiveClient(config.settings.retryCount);
  const perAccount = await runWithConcurrency(
    config.accounts,
    config.settings.maxConcurrentRequests,
    async (account) => fetchOneAccount(account, config, liveClient)
  );

  const errors = perAccount.filter((entry) => entry.error).map((entry) => entry.error as AccountFetchError);
  const successful = perAccount.filter((entry) => !entry.error);
  const totalTweetsBeforeMerge = successful.reduce((sum, entry) => sum + entry.tweets.length, 0);

  const mergedFeed = aggregateTweets(successful.map((entry) => entry.tweets));
  const response: FeedResponse = {
    feed: mergedFeed,
    meta: {
      totalAccountsConfigured: config.accounts.length,
      accountsFetchedSuccessfully: successful.length,
      accountsFailed: errors.length,
      totalTweetsBeforeMerge,
      totalTweetsAfterMerge: mergedFeed.length,
      returnedTweets: mergedFeed.length,
      lastRefreshedAt: new Date().toISOString(),
      fromCache: false,
      refreshIntervalSeconds: config.settings.refreshIntervalSeconds,
      cacheTTLSeconds: config.settings.cacheTTLSeconds,
      mode: getMode()
    },
    errors
  };

  aggregatedFeedCache.set(cacheKey, response, config.settings.cacheTTLSeconds);
  return response;
}

export async function getCachedFeed(query: FeedQuery = {}): Promise<FeedResponse> {
  const response = await refreshFeed(false);

  let filtered = response.feed;
  if (query.account) {
    const match = query.account.toLowerCase();
    filtered = filtered.filter((tweet) => tweet.source_account.toLowerCase() === match);
  }

  if (query.limit && query.limit > 0) {
    filtered = filtered.slice(0, query.limit);
  }

  return {
    ...response,
    feed: filtered,
    meta: {
      ...response.meta,
      returnedTweets: filtered.length
    }
  };
}

export function clearAllCaches(): void {
  usernameToUserCache.clear();
  accountTweetsCache.clear();
  aggregatedFeedCache.clear();
}
