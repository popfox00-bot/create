import Anthropic from "@anthropic-ai/sdk";
import dns from "node:dns/promises";
import net from "node:net";
import { searchWithClient, safeHttpUrl } from "./public/search-core.js";

export { parseSearchRequest, UserError } from "./public/search-core.js";

let client;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Run the search server-side and add preview thumbnails. */
export async function runSearch(request, { signal } = {}) {
  const result = await searchWithClient(getClient(), request, { signal, model: process.env.SEARCH_MODEL || undefined });
  await addThumbnails(result.results);
  return result;
}

// ---------------------------------------------------------------------------
// Thumbnails: for results without an image, look up the page's og:image.
// ---------------------------------------------------------------------------

async function addThumbnails(results) {
  await Promise.all(
    results.map(async (r) => {
      if (r.image_url) return;
      try {
        r.image_url = await findPreviewImage(r.url);
      } catch {
        r.image_url = null;
      }
    }),
  );
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

/** Refuse to fetch anything that resolves to a private/loopback address (SSRF guard). */
async function assertPublicHost(url) {
  const { hostname } = new URL(url);
  const addrs = await dns.lookup(hostname, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("non-public host");
  }
}

async function findPreviewImage(pageUrl) {
  if (!safeHttpUrl(pageUrl)) return null;
  await assertPublicHost(pageUrl);
  const res = await fetch(pageUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(4000),
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; Inkling/0.1; +preview)",
      accept: "text/html",
    },
  });
  if (!res.ok || !(res.headers.get("content-type") || "").includes("text/html")) return null;

  // Only read the head of the document; meta tags live there.
  const reader = res.body.getReader();
  let html = "";
  while (html.length < 200_000) {
    const { value, done } = await reader.read();
    if (done) break;
    html += new TextDecoder().decode(value);
    if (html.includes("</head>")) break;
  }
  reader.cancel().catch(() => {});

  const metaRe = /<meta\s+[^>]*?(?:property|name)\s*=\s*["'](og:image(?::secure_url)?|twitter:image)["'][^>]*>/gi;
  for (const tag of html.match(metaRe) || []) {
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!content) continue;
    const abs = new URL(content.replaceAll("&amp;", "&"), pageUrl).toString();
    if (safeHttpUrl(abs)) return abs;
  }
  return null;
}
