// Anonymous usage counts, the pure parts (tests/featureCounts.test.ts).
// What is counted and how the relay stores it: relay/src/features.ts.
// Saved in LocalStorage as prism:usageCounts = { counts, lastSent } until the daily send.

import { FEATURES, type Feature } from "../../relay/src/features";

export interface PendingCounts {
  counts: Partial<Record<Feature, number>>;
  lastSent: string | null; // UTC day of the last successful send, "2026-11-26"
}

/** Settings > Feedback switch: "off" turns it off; anything else (never set included) = on. */
export function isUsageSharingOn(saved: string | null): boolean {
  return saved !== "off";
}

export function parsePending(text: string | null): PendingCounts {
  const empty: PendingCounts = { counts: {}, lastSent: null };
  if (!text) return empty;
  try {
    const raw = JSON.parse(text) as { counts?: Record<string, unknown>; lastSent?: unknown };
    const counts: Partial<Record<Feature, number>> = {};
    for (const name of FEATURES) {
      const n = raw.counts?.[name];
      if (typeof n === "number" && Number.isInteger(n) && n > 0) counts[name] = n;
    }
    return { counts, lastSent: typeof raw.lastSent === "string" ? raw.lastSent : null };
  } catch {
    return empty;
  }
}

/** One more use of `feature`. Capped so a bug can't grow the number forever. */
export function addCount(pending: PendingCounts, feature: Feature): PendingCounts {
  const n = Math.min((pending.counts[feature] ?? 0) + 1, 500);
  return { ...pending, counts: { ...pending.counts, [feature]: n } };
}

/** After a send: take away what was sent (uses counted DURING the send stay), mark the day. */
export function afterSend(pending: PendingCounts, sent: Partial<Record<Feature, number>>, day: string): PendingCounts {
  const counts: Partial<Record<Feature, number>> = {};
  for (const name of FEATURES) {
    const left = (pending.counts[name] ?? 0) - (sent[name] ?? 0);
    if (left > 0) counts[name] = left;
  }
  return { counts, lastSent: day };
}

/** At most one send per UTC day. */
export function shouldSend(pending: PendingCounts, today: string): boolean {
  return pending.lastSent !== today;
}
