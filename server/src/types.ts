export interface AggregatorSettings {
  tweetsPerAccount: number;
  refreshIntervalSeconds: number;
  excludeReplies: boolean;
  excludeRetweets: boolean;
  maxConcurrentRequests: number;
  cacheTTLSeconds: number;
  retryCount: number;
}

export interface AccountsFileObject {
  accounts: string[];
  settings?: Partial<AggregatorSettings>;
}

export type AccountsFile = string[] | AccountsFileObject;

export interface LoadedAccountsConfig {
  accounts: string[];
  settings: AggregatorSettings;
  configPath: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
}

export interface PublicMetrics {
  retweet_count?: number;
  reply_count?: number;
  like_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
}

export interface AggregatedTweet {
  id: string;
  text: string;
  created_at: string;
  username: string;
  display_name: string;
  profile_image_url?: string;
  post_url: string;
  public_metrics?: PublicMetrics;
  source_account: string;
  source_user_id: string;
}

export interface AccountFetchError {
  account: string;
  message: string;
  code?: string;
  status?: number;
}

export interface FeedMeta {
  totalAccountsConfigured: number;
  accountsFetchedSuccessfully: number;
  accountsFailed: number;
  totalTweetsBeforeMerge: number;
  totalTweetsAfterMerge: number;
  returnedTweets: number;
  lastRefreshedAt: string;
  fromCache: boolean;
  refreshIntervalSeconds: number;
  cacheTTLSeconds: number;
  mode: "mock" | "live";
}

export interface FeedResponse {
  feed: AggregatedTweet[];
  meta: FeedMeta;
  errors: AccountFetchError[];
}

export interface FeedQuery {
  limit?: number;
  account?: string;
}

export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
