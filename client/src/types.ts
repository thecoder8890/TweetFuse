export interface PublicMetrics {
  retweet_count?: number;
  reply_count?: number;
  like_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
}

export interface FeedItem {
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

export interface AccountError {
  account: string;
  message: string;
  status?: number;
  code?: string;
}

export interface FeedResponse {
  feed: FeedItem[];
  meta: FeedMeta;
  errors: AccountError[];
}

export interface AccountsResponse {
  accounts: string[];
  settings: {
    tweetsPerAccount: number;
    refreshIntervalSeconds: number;
    excludeReplies: boolean;
    excludeRetweets: boolean;
    maxConcurrentRequests: number;
    cacheTTLSeconds: number;
    retryCount: number;
  };
  mode: "mock" | "live";
}
