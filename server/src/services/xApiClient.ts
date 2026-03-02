import { HttpError } from "../types";

interface XApiClientOptions {
  bearerToken: string;
  retryCount: number;
}

interface XApiResponse<T> {
  data: T;
}

function isTransientStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class XApiClient {
  private readonly bearerToken: string;
  private readonly retryCount: number;
  private readonly baseUrl = "https://api.x.com/2";

  constructor(options: XApiClientOptions) {
    this.bearerToken = options.bearerToken;
    this.retryCount = options.retryCount;
  }

  private async request<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    let attempt = 0;
    while (true) {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`
          }
        });

        if (!response.ok) {
          const text = await response.text();
          const err = new HttpError(
            `X API request failed (${response.status}): ${text.slice(0, 200)}`,
            response.status,
            response.status === 429 ? "rate_limited" : undefined
          );

          if (attempt < this.retryCount && isTransientStatus(response.status)) {
            const backoff = 350 * (attempt + 1);
            attempt += 1;
            await delay(backoff);
            continue;
          }

          throw err;
        }

        return (await response.json()) as T;
      } catch (error) {
        const isHttpError = error instanceof HttpError;
        if (isHttpError) {
          throw error;
        }

        if (attempt < this.retryCount) {
          const backoff = 350 * (attempt + 1);
          attempt += 1;
          await delay(backoff);
          continue;
        }

        throw new HttpError(`X API network error: ${(error as Error).message}`, 500, "network_error");
      }
    }
  }

  async getUserByUsername(username: string): Promise<{ id: string; username: string; name: string; profile_image_url?: string }> {
    const response = await this.request<XApiResponse<{ id: string; username: string; name: string; profile_image_url?: string }>>(
      `/users/by/username/${encodeURIComponent(username)}`,
      {
        "user.fields": "name,profile_image_url,username"
      }
    );

    return response.data;
  }

  async getTweetsForUser(
    userId: string,
    options: {
      tweetsPerAccount: number;
      excludeReplies: boolean;
      excludeRetweets: boolean;
    }
  ): Promise<Array<{ id: string; text: string; created_at: string; public_metrics?: Record<string, number> }>> {
    const exclusions: string[] = [];
    if (options.excludeReplies) {
      exclusions.push("replies");
    }
    if (options.excludeRetweets) {
      exclusions.push("retweets");
    }

    const response = await this.request<XApiResponse<Array<{ id: string; text: string; created_at: string; public_metrics?: Record<string, number> }>>>(
      `/users/${encodeURIComponent(userId)}/tweets`,
      {
        max_results: Math.min(100, Math.max(5, options.tweetsPerAccount)),
        "tweet.fields": "created_at,public_metrics",
        ...(exclusions.length > 0 ? { exclude: exclusions.join(",") } : {})
      }
    );

    return response.data ?? [];
  }
}
