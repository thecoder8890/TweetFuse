import { promises as fs } from "node:fs";
import path from "node:path";
import { AccountsFile, AccountsFileObject, AggregatorSettings, LoadedAccountsConfig } from "../types";

const DEFAULT_SETTINGS: AggregatorSettings = {
  tweetsPerAccount: 10,
  refreshIntervalSeconds: 60,
  excludeReplies: true,
  excludeRetweets: true,
  maxConcurrentRequests: 4,
  cacheTTLSeconds: 45,
  retryCount: 2
};

const CONFIG_CANDIDATES = [
  () => process.env.CONFIG_PATH,
  () => path.resolve(process.cwd(), "config/accounts.json"),
  () => path.resolve(process.cwd(), "../config/accounts.json"),
  () => path.resolve(__dirname, "../../../config/accounts.json")
];

function sanitizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "");
}

async function resolveConfigPath(): Promise<string> {
  for (const resolvePath of CONFIG_CANDIDATES) {
    const candidate = resolvePath();
    if (!candidate) {
      continue;
    }

    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue to next candidate.
    }
  }

  throw new Error("Unable to find config/accounts.json. Set CONFIG_PATH if your path is custom.");
}

function parseAccountsFile(parsed: AccountsFile): { accounts: string[]; settings: Partial<AggregatorSettings> } {
  if (Array.isArray(parsed)) {
    return { accounts: parsed, settings: {} };
  }

  const objectData = parsed as AccountsFileObject;
  return {
    accounts: objectData.accounts ?? [],
    settings: objectData.settings ?? {}
  };
}

export async function loadConfiguredAccounts(): Promise<LoadedAccountsConfig> {
  const configPath = await resolveConfigPath();
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as AccountsFile;

  const { accounts, settings } = parseAccountsFile(parsed);
  const dedupedAccounts = [...new Set(accounts.map(sanitizeUsername).filter(Boolean))];

  if (dedupedAccounts.length === 0) {
    throw new Error("No accounts were configured. Add usernames to config/accounts.json.");
  }

  const merged: AggregatorSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    maxConcurrentRequests: Math.max(1, Math.min(10, Number(settings.maxConcurrentRequests ?? DEFAULT_SETTINGS.maxConcurrentRequests))),
    tweetsPerAccount: Math.max(5, Math.min(100, Number(settings.tweetsPerAccount ?? DEFAULT_SETTINGS.tweetsPerAccount))),
    refreshIntervalSeconds: Math.max(10, Number(settings.refreshIntervalSeconds ?? DEFAULT_SETTINGS.refreshIntervalSeconds)),
    cacheTTLSeconds: Math.max(5, Number(settings.cacheTTLSeconds ?? DEFAULT_SETTINGS.cacheTTLSeconds)),
    retryCount: Math.max(0, Math.min(5, Number(settings.retryCount ?? DEFAULT_SETTINGS.retryCount)))
  };

  return {
    accounts: dedupedAccounts,
    settings: merged,
    configPath
  };
}
