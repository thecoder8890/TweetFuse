import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadConfiguredAccounts } from "./services/accountConfigService";
import { clearAllCaches, getCachedFeed, refreshFeed } from "./services/aggregatorService";

function resolveClientDistPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "client/dist"),
    path.resolve(process.cwd(), "../client/dist"),
    path.resolve(__dirname, "../../client/dist"),
    path.resolve(__dirname, "../../../client/dist")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const mode = process.env.USE_MOCK_MODE === "true" || !process.env.X_BEARER_TOKEN ? "mock" : "live";
    res.json({
      ok: true,
      mode,
      now: new Date().toISOString()
    });
  });

  app.get("/api/accounts", async (_req, res) => {
    try {
      const config = await loadConfiguredAccounts();
      res.json({
        accounts: config.accounts,
        settings: config.settings,
        mode: process.env.USE_MOCK_MODE === "true" || !process.env.X_BEARER_TOKEN ? "mock" : "live"
      });
    } catch (error) {
      res.status(500).json({
        message: (error as Error).message
      });
    }
  });

  app.get("/api/feed", async (req, res) => {
    try {
      const limitRaw = req.query.limit as string | undefined;
      const limit = limitRaw ? Number(limitRaw) : undefined;
      const account = req.query.account as string | undefined;

      const payload = await getCachedFeed({
        limit: Number.isFinite(limit) ? limit : undefined,
        account: account?.trim() || undefined
      });

      res.json(payload);
    } catch (error) {
      res.status(500).json({
        message: (error as Error).message
      });
    }
  });

  app.post("/api/refresh", async (_req, res) => {
    try {
      clearAllCaches();
      const refreshed = await refreshFeed(true);
      res.json(refreshed);
    } catch (error) {
      res.status(500).json({
        message: (error as Error).message
      });
    }
  });

  const clientDist = resolveClientDistPath();
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
