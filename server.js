import express from "express";
import { timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isConfigured, parseSearchRequest, runSearch, UserError } from "./search.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader so `npm start` works without extra dependencies.
const envPath = join(__dirname, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data: https: http:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://api.anthropic.com; frame-ancestors 'none'",
  });
  next();
});

// Optional password gate for a private deployment.
if (process.env.APP_PASSWORD) {
  const expected = Buffer.from(process.env.APP_PASSWORD);
  app.use((req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || "").split(" ");
    const password = scheme === "Basic" && encoded ? Buffer.from(encoded, "base64").toString().split(":").slice(1).join(":") : "";
    const given = Buffer.from(password);
    if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
    res.set("WWW-Authenticate", 'Basic realm="Inkling"').status(401).send("Authentication required");
  });
}

app.use(express.json({ limit: "15mb" }));
// Only index.html and public/ are served — never the repo root (server code, .env).
app.get("/", (req, res) => res.sendFile(join(__dirname, "index.html")));
app.use("/public", express.static(join(__dirname, "public")));

app.get("/api/status", (req, res) => {
  res.json({ configured: isConfigured() });
});

app.post("/api/search", async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: "Server is missing ANTHROPIC_API_KEY. Add it to .env and restart." });
  }
  let request;
  try {
    request = parseSearchRequest(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const result = await runSearch(request, { signal: controller.signal });
    res.json(result);
  } catch (err) {
    if (controller.signal.aborted) return;
    if (err instanceof UserError) return res.status(422).json({ error: err.message });
    console.error("Search failed:", err);
    const status = err?.status === 429 ? 429 : 502;
    res.status(status).json({
      error: status === 429 ? "Rate limited — wait a moment and try again." : "Search failed. Check the server logs.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Inkling running at http://localhost:${PORT}`);
  if (!isConfigured()) console.warn("Warning: ANTHROPIC_API_KEY is not set — searches will fail until it is.");
});
