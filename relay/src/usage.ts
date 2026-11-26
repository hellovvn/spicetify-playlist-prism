// Anonymous daily user count for the relay.
// Every Prism asks GET /lastfm-key once per Spotify start, so counting the distinct callers
// per UTC day gives "about N people opened Prism that day".
// Privacy: the caller's IP is never stored. It is hashed together with the day and a secret
// pepper, and that hash only lives for 2 days (just long enough not to count someone twice).
// What stays is one number per day ("users:2026-11-26" = "12").
// KV is eventually consistent and the counter is read-then-write, so counts are approximate
// (two first calls at the same moment can count as one).

export interface UsageKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const SEEN_TTL_SECONDS = 2 * 86400;

/** "2026-11-26" in UTC. */
export function usageDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Counts this caller once per UTC day. Returns true when it was a new caller today. */
export async function countUser(kv: UsageKV, ip: string, now: Date, pepper: string): Promise<boolean> {
  const day = usageDay(now);
  const seenKey = `seen:${day}:${await sha256Hex(`${pepper}|${day}|${ip}`)}`;
  if (await kv.get(seenKey)) return false;
  await kv.put(seenKey, "1", { expirationTtl: SEEN_TTL_SECONDS });
  const countKey = `users:${day}`;
  const count = Number((await kv.get(countKey)) ?? "0") || 0;
  await kv.put(countKey, String(count + 1));
  return true;
}

/** The last `days` days' counts, newest first (days without a count say 0). */
export async function readUsage(
  kv: UsageKV,
  now: Date,
  days: number,
): Promise<{ day: string; users: number }[]> {
  const out: { day: string; users: number }[] = [];
  for (let i = 0; i < days; i++) {
    const day = usageDay(new Date(now.getTime() - i * 86400_000));
    out.push({ day, users: Number((await kv.get(`users:${day}`)) ?? "0") || 0 });
  }
  return out;
}

/** Constant-time-ish check of "Authorization: Bearer <token>" against the secret. */
export function isUsageAuthorized(header: string | null, token: string | undefined): boolean {
  const secret = (token ?? "").trim();
  if (!secret || !header) return false;
  const given = header.replace(/^Bearer\s+/i, "").trim();
  if (given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
