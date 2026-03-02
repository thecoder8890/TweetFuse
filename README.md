# X Feed Aggregator (React + Express + TypeScript)

A full stack local app that aggregates recent posts from many configured X accounts into one unified timeline.

The primary product behavior is a merged feed, not per-account columns.

## What this app does

- Reads configured X usernames from `config/accounts.json`.
- Fetches latest tweets for each account from the official X API (server-side only).
- Merges all tweets into one combined timeline.
- Sorts newest first.
- Deduplicates by tweet ID.
- Returns one aggregated payload from backend to frontend.
- Supports 20 to 30 accounts with concurrency controls and in-memory caching.
- Supports mock mode when `X_BEARER_TOKEN` is missing.

## Project structure

```text
.
├── .env.example
├── .gitignore
├── README.md
├── config
│   └── accounts.json
├── package.json
├── client
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src
│       ├── App.tsx
│       ├── api.ts
│       ├── main.tsx
│       ├── styles.css
│       ├── types.ts
│       └── components
│           └── FeedItemCard.tsx
└── server
    ├── package.json
    ├── tsconfig.json
    └── src
        ├── app.ts
        ├── index.ts
        ├── types.ts
        └── services
            ├── accountConfigService.ts
            ├── aggregatorService.ts
            ├── cache.ts
            ├── mockData.ts
            ├── normalization.ts
            └── xApiClient.ts
```

## Configuration

Update `config/accounts.json`.

```json
{
  "accounts": [
    "OpenAI",
    "xdevelopers",
    "TechCrunch"
  ],
  "settings": {
    "tweetsPerAccount": 8,
    "refreshIntervalSeconds": 60,
    "excludeReplies": true,
    "excludeRetweets": true,
    "maxConcurrentRequests": 4,
    "cacheTTLSeconds": 45,
    "retryCount": 2
  }
}
```

- `accounts`: source of truth list of usernames (supports 20 to 30+).
- `tweetsPerAccount`: per-account fetch size.
- `refreshIntervalSeconds`: frontend polling interval (from backend meta).
- `excludeReplies` / `excludeRetweets`: passed to X API `exclude` query.
- `maxConcurrentRequests`: safe parallelism (avoid unbounded fan-out).
- `cacheTTLSeconds`: in-memory cache TTL for account tweets and merged feed.
- `retryCount`: retries for transient request failures.

## Environment variables

Copy `.env.example` to `.env` and set values.

```bash
cp .env.example .env
```

`.env`:

```env
X_BEARER_TOKEN=your_x_bearer_token_here
USE_MOCK_MODE=false
PORT=4000
```

- Token is only used on backend.
- Frontend never sees `X_BEARER_TOKEN`.
- If no token is set, app defaults to mock mode automatically.

## Run locally

From repository root:

```bash
npm install
cp .env.example .env
# edit .env and add X_BEARER_TOKEN (optional if using mock mode)
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

Production-style run:

```bash
npm run build
npm run start
```

`npm run start` launches the server, and if `client/dist` exists it serves the built React app.

## Aggregator flow

1. Load usernames + settings from `config/accounts.json`.
2. For each account:
   - Resolve username -> user ID (`/2/users/by/username/:username`)
   - Fetch latest tweets (`/2/users/:id/tweets`)
   - Normalize raw X payload in `normalization.ts`
3. Merge all normalized tweets in `aggregateTweets`.
4. Deduplicate by `id`.
5. Sort by `created_at` descending.
6. Return `{ feed, meta, errors }`.

## Backend API

### `GET /api/health`
Basic health status.

### `GET /api/accounts`
Returns configured accounts and active settings.

### `GET /api/feed`
Returns unified merged timeline.

Query params:

- `limit` (optional): max number of tweets returned.
- `account` (optional): only tweets from one source account.

### `POST /api/refresh`
Forces cache clear + refresh and returns newest merged payload.

## Feed response shape

```json
{
  "feed": [
    {
      "id": "...",
      "text": "...",
      "created_at": "2026-03-02T12:00:00.000Z",
      "username": "OpenAI",
      "display_name": "OpenAI",
      "profile_image_url": "https://...",
      "post_url": "https://x.com/OpenAI/status/...",
      "public_metrics": {
        "like_count": 10,
        "reply_count": 2,
        "retweet_count": 1,
        "quote_count": 0
      },
      "source_account": "OpenAI",
      "source_user_id": "123"
    }
  ],
  "meta": {
    "totalAccountsConfigured": 12,
    "accountsFetchedSuccessfully": 11,
    "accountsFailed": 1,
    "totalTweetsBeforeMerge": 88,
    "totalTweetsAfterMerge": 84,
    "returnedTweets": 84,
    "lastRefreshedAt": "2026-03-02T12:00:00.000Z",
    "fromCache": true,
    "refreshIntervalSeconds": 60,
    "cacheTTLSeconds": 45,
    "mode": "live"
  },
  "errors": [
    {
      "account": "example",
      "message": "...",
      "status": 429,
      "code": "rate_limited"
    }
  ]
}
```

## Frontend behavior

- Uses backend only (`/api/feed`, `/api/refresh`, `/api/accounts`).
- Displays one merged timeline.
- Shows source account on each post.
- Supports controls:
  - text search
  - source account filter
  - time window filter
  - response limit (50/100/200)
- Auto-refresh polling using backend `meta.refreshIntervalSeconds`.
- Manual refresh button.
- Shows last updated time, cache/live indicator, and partial failures.

## Caching and reliability

In-memory caches:

- username -> user profile (`TTL * 3`)
- account -> recent tweets (`TTL`)
- final merged feed (`TTL`)

Reliability safeguards:

- Configurable concurrency limit (`maxConcurrentRequests`)
- Basic retries for transient failures (`retryCount`)
- Partial failures do not fail entire feed response
- Rate-limit responses are surfaced in per-account `errors`

## Known limitations

- No persistent database (cache resets on server restart).
- X API rate limits and access vary by X plan.
- `tweetsPerAccount` and endpoint capabilities depend on your X API tier.
- This app uses official API endpoints only; no scraping or unofficial widget embedding.
# TweetFuse
