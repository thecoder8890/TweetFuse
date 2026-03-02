import { FeedItem } from "../types";

interface FeedItemCardProps {
  tweet: FeedItem;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

function safeNumber(value: number | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "-";
}

export function FeedItemCard({ tweet }: FeedItemCardProps) {
  return (
    <article className="feed-item">
      <header className="feed-item__header">
        {tweet.profile_image_url ? (
          <img className="feed-item__avatar" src={tweet.profile_image_url} alt={`${tweet.username} avatar`} />
        ) : (
          <div className="feed-item__avatar feed-item__avatar--fallback">@</div>
        )}

        <div className="feed-item__identity">
          <div className="feed-item__name">{tweet.display_name}</div>
          <div className="feed-item__username">@{tweet.username}</div>
        </div>

        <div className="feed-item__source">Source: {tweet.source_account}</div>
      </header>

      <p className="feed-item__text">{tweet.text}</p>

      <footer className="feed-item__footer">
        <span>{formatDate(tweet.created_at)}</span>
        <a href={tweet.post_url} target="_blank" rel="noreferrer">
          Open on X
        </a>
      </footer>

      <div className="feed-item__metrics">
        <span>Likes: {safeNumber(tweet.public_metrics?.like_count)}</span>
        <span>Replies: {safeNumber(tweet.public_metrics?.reply_count)}</span>
        <span>Reposts: {safeNumber(tweet.public_metrics?.retweet_count)}</span>
        <span>Quotes: {safeNumber(tweet.public_metrics?.quote_count)}</span>
      </div>
    </article>
  );
}
