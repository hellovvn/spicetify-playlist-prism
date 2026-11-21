// Remembers each song's cleaned tags, so the NEXT scan skips Last.fm for it.
// The first scan of a big library takes minutes; repeat scans take seconds.
//
// PURE: it only turns data into JSON text and back. Saving that text in
// Spotify's storage happens in src/storage.ts. Unit-tested in tests/tagCache.test.ts.
//
// Two ways an entry goes stale:
//  - AGE: Last.fm tags slowly change, so entries expire after MAX_AGE_DAYS.
//  - RULES: if we change the cleanup rules (like adding country names in 4c),
//    old entries were cleaned with the old rules. Bumping CACHE_VERSION
//    throws the whole cache away so everything is re-fetched and re-cleaned.

import type { SourcedTag } from "../tags/combineTags";

// History: 2 = title-word tags dropped + spelling/plural variants merged.
export const CACHE_VERSION = 2;
const MAX_AGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CachedTags {
  tags: SourcedTag[];
  matchedTitle: string | null; // null = no song-level tags were found
}

interface Entry extends CachedTags {
  at: number; // when it was saved (milliseconds since 1970, like Date.now())
}

export class TagCache {
  private entries = new Map<string, Entry>();

  // Starts from saved JSON text. Anything missing, broken, or from another
  // CACHE_VERSION gives an empty cache instead of an error.
  constructor(json?: string | null) {
    if (!json) return;
    try {
      const data = JSON.parse(json);
      if (data?.version !== CACHE_VERSION || typeof data.entries !== "object") return;
      for (const [uri, entry] of Object.entries<any>(data.entries)) {
        if (Array.isArray(entry?.tags) && typeof entry.at === "number") this.entries.set(uri, entry);
      }
    } catch {
      // Corrupt text: start fresh.
    }
  }

  get(uri: string, now: number): CachedTags | null {
    const entry = this.entries.get(uri);
    if (!entry || now - entry.at > MAX_AGE_DAYS * DAY_MS) return null;
    return { tags: entry.tags, matchedTitle: entry.matchedTitle };
  }

  set(uri: string, value: CachedTags, now: number): void {
    this.entries.set(uri, { ...value, at: now });
  }

  get size(): number {
    return this.entries.size;
  }

  // Saves only entries that haven't expired, so the stored text can't grow forever.
  toJSON(now: number): string {
    const fresh: Record<string, Entry> = {};
    this.entries.forEach((entry, uri) => {
      if (now - entry.at <= MAX_AGE_DAYS * DAY_MS) fresh[uri] = entry;
    });
    return JSON.stringify({ version: CACHE_VERSION, entries: fresh });
  }
}
