import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAccounts, fetchFeed, refreshFeed } from "./api";
import { FeedItem, FeedResponse } from "./types";
import { FeedItemCard } from "./components/FeedItemCard";

const DEFAULT_LIMIT = 100;

function minutesSince(dateIso: string): number {
  return (Date.now() - new Date(dateIso).getTime()) / 60_000;
}

function applyClientFilters(
  feed: FeedItem[],
  filters: {
    search: string;
    account: string;
    maxAgeMinutes: string;
  }
): FeedItem[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return feed.filter((tweet) => {
    if (filters.account && tweet.source_account.toLowerCase() !== filters.account.toLowerCase()) {
      return false;
    }

    if (normalizedSearch && !tweet.text.toLowerCase().includes(normalizedSearch)) {
      return false;
    }

    if (filters.maxAgeMinutes) {
      const maxAge = Number(filters.maxAgeMinutes);
      if (Number.isFinite(maxAge) && maxAge > 0 && minutesSince(tweet.created_at) > maxAge) {
        return false;
      }
    }

    return true;
  });
}

export default function App() {
  const [feedResponse, setFeedResponse] = useState<FeedResponse | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [searchText, setSearchText] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [timeWindow, setTimeWindow] = useState("");

  const loadData = useCallback(async (currentLimit: number): Promise<void> => {
    setErrorMessage(null);
    const [accountsPayload, feedPayload] = await Promise.all([
      fetchAccounts(),
      fetchFeed({ limit: currentLimit })
    ]);

    setAccounts(accountsPayload.accounts);
    setFeedResponse(feedPayload);
  }, []);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const refreshed = await refreshFeed();
      setFeedResponse({
        ...refreshed,
        feed: refreshed.feed.slice(0, limit)
      });
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsRefreshing(false);
    }
  }, [limit]);

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    void loadData(limit)
      .catch((error: Error) => {
        if (mounted) {
          setErrorMessage(error.message);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loadData, limit]);

  useEffect(() => {
    if (!feedResponse) {
      return;
    }

    const intervalSeconds = feedResponse.meta.refreshIntervalSeconds || 60;
    const timer = window.setInterval(() => {
      void loadData(limit).catch((error: Error) => setErrorMessage(error.message));
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [feedResponse, limit, loadData]);

  const filteredFeed = useMemo(() => {
    if (!feedResponse) {
      return [];
    }

    return applyClientFilters(feedResponse.feed, {
      search: searchText,
      account: accountFilter,
      maxAgeMinutes: timeWindow
    });
  }, [feedResponse, searchText, accountFilter, timeWindow]);

  if (isLoading) {
    return <main className="app-shell">Loading aggregated feed...</main>;
  }

  return (
    <main className="app-shell">
      <section className="top-bar">
        <div>
          <h1>Unified X Feed</h1>
          <p>
            Single merged timeline across {feedResponse?.meta.totalAccountsConfigured ?? 0} configured accounts.
          </p>
        </div>

        <div className="status-block">
          <button onClick={() => void handleRefresh()} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <div>Last updated: {feedResponse ? new Date(feedResponse.meta.lastRefreshedAt).toLocaleString() : "-"}</div>
          <div>Source: {feedResponse?.meta.fromCache ? "Cache" : "Live Fetch"}</div>
          <div>Mode: {feedResponse?.meta.mode ?? "-"}</div>
        </div>
      </section>

      <section className="controls">
        <label>
          Search
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search merged tweet text"
          />
        </label>

        <label>
          Source account
          <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </select>
        </label>

        <label>
          Time window
          <select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)}>
            <option value="">All time</option>
            <option value="30">Last 30 minutes</option>
            <option value="60">Last 1 hour</option>
            <option value="360">Last 6 hours</option>
            <option value="1440">Last 24 hours</option>
          </select>
        </label>

        <label>
          Limit
          <select value={String(limit)} onChange={(event) => setLimit(Number(event.target.value))}>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </label>
      </section>

      {errorMessage && <section className="error">Error: {errorMessage}</section>}

      {feedResponse && feedResponse.errors.length > 0 && (
        <section className="warning">
          <strong>Partial failure:</strong> {feedResponse.meta.accountsFailed} account(s) failed.
          <ul>
            {feedResponse.errors.slice(0, 5).map((item) => (
              <li key={item.account}>
                @{item.account}: {item.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="meta">
        <span>Fetched successfully: {feedResponse?.meta.accountsFetchedSuccessfully ?? 0}</span>
        <span>Tweets before merge: {feedResponse?.meta.totalTweetsBeforeMerge ?? 0}</span>
        <span>Tweets shown: {filteredFeed.length}</span>
      </section>

      {filteredFeed.length === 0 ? (
        <section className="empty">No tweets match your current filters.</section>
      ) : (
        <section className="feed-list">
          {filteredFeed.map((tweet) => (
            <FeedItemCard key={tweet.id} tweet={tweet} />
          ))}
        </section>
      )}
    </main>
  );
}
