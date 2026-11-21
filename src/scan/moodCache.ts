// Remembers each song's lyrics MOOD (never the lyrics), so the next scan
// doesn't ask Spotify again. Works like TagCache (src/scan/tagCache.ts):
// pure JSON in/out, entries expire, a version bump throws old entries away.
// Unit-tested in tests/moodCache.test.ts.
//
// "No profile" (null: no lyrics, not English, too few mood words) is cached
// too, so instrumental songs aren't looked up again every scan.

import type { MoodProfile } from "../mood/lyricsMood";

// Bump when the word lists change, so every song is re-judged with the new lists.
// History: 2 = drop entries wrongly cached as "no lyrics" when Spotify returned an error.
export const MOOD_CACHE_VERSION = 2;
const MAX_AGE_DAYS = 60; // lyrics rarely change
const DAY_MS = 24 * 60 * 60 * 1000;

interface Entry {
  mood: MoodProfile | null;
  at: number;
}

export class MoodCache {
  private entries = new Map<string, Entry>();

  constructor(json?: string | null) {
    if (!json) return;
    try {
      const data = JSON.parse(json);
      if (data?.version !== MOOD_CACHE_VERSION || typeof data.entries !== "object") return;
      for (const [uri, entry] of Object.entries<any>(data.entries)) {
        if (typeof entry?.at === "number" && "mood" in entry) this.entries.set(uri, entry);
      }
    } catch {
      // Corrupt text: start fresh.
    }
  }

  // undefined = not cached (ask Spotify). null = cached "no profile".
  get(uri: string, now: number): MoodProfile | null | undefined {
    const entry = this.entries.get(uri);
    if (!entry || now - entry.at > MAX_AGE_DAYS * DAY_MS) return undefined;
    return entry.mood;
  }

  set(uri: string, mood: MoodProfile | null, now: number): void {
    this.entries.set(uri, { mood, at: now });
  }

  toJSON(now: number): string {
    const fresh: Record<string, Entry> = {};
    this.entries.forEach((entry, uri) => {
      if (now - entry.at <= MAX_AGE_DAYS * DAY_MS) fresh[uri] = entry;
    });
    return JSON.stringify({ version: MOOD_CACHE_VERSION, entries: fresh });
  }
}
