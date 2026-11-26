// Prism's report relay (Cloudflare Worker).
// Prism sends POST /report with a ReportInput (JSON). The relay checks it, applies the
// rate limits, and opens a GitHub issue as the "prism-reports" GitHub App.
// GET /lastfm-key hands out Prism's own Last.fm API key (secret LASTFM_APP_KEY), so new
// users need no key of their own and the key can be swapped without a Prism release.
// The App's private key lives ONLY here (Cloudflare secret GITHUB_PRIVATE_KEY), never in Prism.
// Setup and how to switch repos: relay/README.md.

import { buildIssue, parseReport } from "./report";
import { importPrivateKey, makeAppJwt } from "./githubAuth";

// Minimal type for the KV binding, so the project needs no Cloudflare type package.
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  GITHUB_APP_ID: string;
  GITHUB_INSTALLATION_ID: string;
  /** "owner/repo" the issues go to. Change this to switch to a private repo. */
  GITHUB_REPO: string;
  /** Comma-separated origins allowed to call the relay from a browser (CORS). */
  ALLOWED_ORIGINS: string;
  /** "off" turns reporting off without a redeploy of Prism. */
  REPORTS_ENABLED?: string;
  GITHUB_PRIVATE_KEY: string;
  /** Prism's own Last.fm API key (read-only methods only). Unset = /lastfm-key answers 503. */
  LASTFM_APP_KEY?: string;
  LIMITS: KV;
}

const MAX_BODY_BYTES = 20_000;
const PER_SENDER_PER_HOUR = 3;
const ALL_SENDERS_PER_DAY = 50;
const USER_AGENT = "prism-reports-relay";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/lastfm-key") {
      if (request.method !== "GET") return reply(405, { ok: false, error: "Use GET." }, cors);
      const key = (env.LASTFM_APP_KEY ?? "").trim();
      if (!key) return reply(503, { ok: false, error: "No shared Last.fm key set up." }, cors);
      // Cached for an hour by the browser; Prism asks once per Spotify start anyway.
      return reply(200, { ok: true, key }, { ...cors, "Cache-Control": "public, max-age=3600" });
    }
    if (url.pathname !== "/report") return reply(404, { ok: false, error: "Not found." }, cors);
    if (request.method !== "POST") return reply(405, { ok: false, error: "Use POST." }, cors);
    if (env.REPORTS_ENABLED === "off") {
      return reply(503, { ok: false, error: "Reporting is turned off right now." }, cors);
    }

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { ok: false, error: "The report is too long." }, cors);

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return reply(400, { ok: false, error: "The report isn't valid JSON." }, cors);
    }
    const parsed = parseReport(raw);
    if (!parsed.ok) return reply(400, { ok: false, error: parsed.error }, cors);

    const limited = await checkRateLimits(request, env);
    if (limited) return reply(429, { ok: false, error: limited }, cors);

    try {
      const issue = await createIssue(env, buildIssue(parsed.report));
      return reply(201, { ok: true, number: issue.number, url: issue.url }, cors);
    } catch (e) {
      console.log("GitHub error:", e instanceof Error ? e.message : String(e));
      return reply(502, { ok: false, error: "Couldn't send the report. Please try again later." }, cors);
    }
  },
};

// ---- Rate limits (KV counters; KV is eventually consistent, so these are approximate) ----

async function checkRateLimits(request: Request, env: Env): Promise<string | null> {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13); // "2026-11-25T14"
  const day = now.toISOString().slice(0, 10);

  // The sender's IP is only kept as a hash, and only for an hour.
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const sender = await sha256Hex(ip);

  const senderKey = `sender:${sender}:${hour}`;
  const dayKey = `day:${day}`;
  const senderCount = Number((await env.LIMITS.get(senderKey)) ?? "0");
  const dayCount = Number((await env.LIMITS.get(dayKey)) ?? "0");

  if (senderCount >= PER_SENDER_PER_HOUR) return "You've sent a few reports already. Please try again in an hour.";
  if (dayCount >= ALL_SENDERS_PER_DAY) return "Prism has had a lot of reports today. Please try again tomorrow.";

  await env.LIMITS.put(senderKey, String(senderCount + 1), { expirationTtl: 3600 });
  await env.LIMITS.put(dayKey, String(dayCount + 1), { expirationTtl: 2 * 86400 });
  return null;
}

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- GitHub ----

let cachedToken: { token: string; expiresAt: number } | null = null;

async function installationToken(env: Env): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 5 * 60_000) return cachedToken.token;

  const key = await importPrivateKey(env.GITHUB_PRIVATE_KEY);
  const jwt = await makeAppJwt(env.GITHUB_APP_ID, key, Math.floor(Date.now() / 1000));
  const res = await fetch(
    `https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
    { method: "POST", headers: githubHeaders(jwt) },
  );
  if (!res.ok) throw new Error(`access token: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string; expires_at: string };
  cachedToken = { token: data.token, expiresAt: Date.parse(data.expires_at) };
  return data.token;
}

async function createIssue(
  env: Env,
  issue: { title: string; body: string; labels: string[] },
): Promise<{ number: number; url: string }> {
  const token = await installationToken(env);
  const post = (payload: object) =>
    fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: "POST",
      headers: { ...githubHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  let res = await post(issue);
  // If GitHub refuses the labels, still post the report (the title says Bug/Idea anyway).
  if (res.status === 422 || res.status === 403) {
    console.log("Issue with labels refused:", res.status, await res.text());
    res = await post({ title: issue.title, body: issue.body });
  }
  if (!res.ok) throw new Error(`create issue: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { number: number; html_url: string };
  return { number: data.number, url: data.html_url };
}

function githubHeaders(bearer: string): Record<string, string> {
  return {
    Authorization: `Bearer ${bearer}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
}

// ---- HTTP helpers ----

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function reply(status: number, body: object, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
