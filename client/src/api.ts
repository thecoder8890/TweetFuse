import { AccountsResponse, FeedResponse } from "./types";

export async function fetchAccounts(): Promise<AccountsResponse> {
  const response = await fetch("/api/accounts");
  if (!response.ok) {
    throw new Error(`Failed to fetch accounts (${response.status})`);
  }
  return (await response.json()) as AccountsResponse;
}

export async function fetchFeed(params: { limit?: number; account?: string } = {}): Promise<FeedResponse> {
  const url = new URL("/api/feed", window.location.origin);
  if (params.limit) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.account) {
    url.searchParams.set("account", params.account);
  }

  const response = await fetch(`${url.pathname}${url.search}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed (${response.status})`);
  }

  return (await response.json()) as FeedResponse;
}

export async function refreshFeed(): Promise<FeedResponse> {
  const response = await fetch("/api/refresh", {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh feed (${response.status})`);
  }

  return (await response.json()) as FeedResponse;
}
