import dotenv from "dotenv";
import path from "node:path";
import { createApp } from "./app";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const app = createApp();
const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  const mode = process.env.USE_MOCK_MODE === "true" || !process.env.X_BEARER_TOKEN ? "mock" : "live";
  console.log(`[server] listening on http://localhost:${port} (${mode} mode)`);
});
