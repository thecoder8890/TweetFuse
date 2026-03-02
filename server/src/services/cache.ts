export class TTLCache<T> {
  private readonly data = new Map<string, { value: T; expiresAt: number }>();

  get(key: string): T | undefined {
    const entry = this.data.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.data.set(key, { value, expiresAt });
  }

  clear(): void {
    this.data.clear();
  }
}
