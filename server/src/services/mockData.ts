import { AggregatedTweet, UserProfile } from "../types";

function hashAccount(account: string): number {
  let hash = 0;
  for (let i = 0; i < account.length; i += 1) {
    hash = (hash << 5) - hash + account.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function buildMockUser(account: string): UserProfile {
  const cleaned = account.replace(/^@+/, "");
  return {
    userId: `mock-${cleaned.toLowerCase()}`,
    username: cleaned,
    displayName: `${cleaned} (Mock)`,
    profileImageUrl: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(cleaned)}`
  };
}

export function buildMockTweets(profile: UserProfile, count: number): AggregatedTweet[] {
  const now = Date.now();
  const seed = hashAccount(profile.username);
  const tweets: AggregatedTweet[] = [];

  for (let i = 0; i < count; i += 1) {
    const ageMinutes = seed % 30 + i * 13;
    const createdAt = new Date(now - ageMinutes * 60_000).toISOString();
    const tweetId = `${Math.floor(now / 1000)}${seed}${i}`;

    tweets.push({
      id: tweetId,
      text: `Mock update #${i + 1} from @${profile.username}. Configure X_BEARER_TOKEN for live data.`,
      created_at: createdAt,
      username: profile.username,
      display_name: profile.displayName,
      profile_image_url: profile.profileImageUrl,
      post_url: `https://x.com/${profile.username}/status/${tweetId}`,
      public_metrics: {
        like_count: (seed + i * 7) % 1000,
        retweet_count: (seed + i * 3) % 250,
        reply_count: (seed + i * 5) % 120,
        quote_count: (seed + i * 2) % 60
      },
      source_account: profile.username,
      source_user_id: profile.userId
    });
  }

  return tweets;
}
