import { AggregatedTweet, UserProfile } from "../types";

interface RawUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

interface RawTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: AggregatedTweet["public_metrics"];
}

export function normalizeUser(rawUser: RawUser): UserProfile {
  return {
    userId: rawUser.id,
    username: rawUser.username,
    displayName: rawUser.name,
    profileImageUrl: rawUser.profile_image_url
  };
}

export function normalizeTweet(rawTweet: RawTweet, profile: UserProfile): AggregatedTweet {
  return {
    id: rawTweet.id,
    text: rawTweet.text,
    created_at: rawTweet.created_at,
    username: profile.username,
    display_name: profile.displayName,
    profile_image_url: profile.profileImageUrl,
    post_url: `https://x.com/${profile.username}/status/${rawTweet.id}`,
    public_metrics: rawTweet.public_metrics,
    source_account: profile.username,
    source_user_id: profile.userId
  };
}
