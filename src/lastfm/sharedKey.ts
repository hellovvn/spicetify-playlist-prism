// Prism's shared Last.fm key: fetched from the relay (GET /lastfm-key, relay/src/worker.ts)
// and kept in LocalStorage, so new users can start without a key of their own.
// The relay is asked once per Spotify start (per bundle), so a swapped key reaches
// everyone at their next restart; if the relay can't be reached, the saved copy is used.

import { REPORT_RELAY_URL } from "../report/send";
import { getLastfmKey, saveSharedLastfmKey } from "../storage";
import { parseSharedKeyReply } from "./keyChoice";

let refreshing: Promise<void> | null = null;

/** Asks the relay for the current shared key and saves it. Never throws. */
export function refreshSharedLastfmKey(): Promise<void> {
  if (!refreshing) {
    refreshing = (async () => {
      if (!REPORT_RELAY_URL) return;
      try {
        const res = await fetch(`${REPORT_RELAY_URL}/lastfm-key`);
        const key = parseSharedKeyReply(await res.json().catch(() => null));
        if (key) saveSharedLastfmKey(key);
      } catch {
        // Offline or relay down: keep whatever copy we have.
      }
    })();
  }
  return refreshing;
}

/** The key to use, waiting for the relay first only when there's no key at all yet. */
export async function ensureLastfmKey(): Promise<string | null> {
  const key = getLastfmKey();
  if (key) return key;
  await refreshSharedLastfmKey();
  return getLastfmKey();
}
