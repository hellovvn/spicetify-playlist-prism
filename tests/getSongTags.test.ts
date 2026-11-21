// Unit tests for the retry + fallback chain, using FAKE Last.fm functions.
// Run with: npm test
//
// vi.fn() creates a "mock function": it does what we tell it AND records
// every call, so tests can check e.g. "was the artist lookup skipped?".

import { describe, expect, test, vi } from "vitest";
import { getSongTags, type TagFetchers } from "../src/tags/getSongTags";
import { LastfmError, type LastfmTag } from "../src/lastfm/client";

// Builds fake fetchers from simple tables.
//   trackTags: title -> tags (or an Error to throw). Missing title = no tags.
//   artistTags: tags (or an Error) for any artist.
function fakeLastfm(
  trackTags: Record<string, LastfmTag[] | Error>,
  artistTags: LastfmTag[] | Error = []
): TagFetchers {
  return {
    fetchTrackTags: vi.fn(async (_artist: string, title: string) => {
      const answer = trackTags[title] ?? [];
      if (answer instanceof Error) throw answer;
      return answer;
    }),
    fetchArtistTags: vi.fn(async (_artist: string) => {
      if (artistTags instanceof Error) throw artistTags;
      return artistTags;
    }),
  };
}

const tags = (...pairs: [string, number][]): LastfmTag[] => pairs.map(([name, count]) => ({ name, count }));

describe("getSongTags", () => {
  test("Snooze: retries cleaned titles until one has tags", async () => {
    const lastfm = fakeLastfm({ Snooze: tags(["rnb", 100], ["chill", 60], ["acoustic", 40]) });
    const result = await getSongTags(
      { name: "Snooze (Acoustic) (feat. Justin Bieber)", artists: ["SZA", "Justin Bieber"] },
      lastfm
    );

    expect(result.titlesTried).toEqual(["Snooze (Acoustic) (feat. Justin Bieber)", "Snooze (Acoustic)", "Snooze"]);
    expect(result.matchedTitle).toBe("Snooze");
    expect(result.tags.map((t) => t.name)).toEqual(["r&b", "chill", "acoustic"]);
    // 3 usable song tags -> the artist lookup is skipped entirely.
    expect(result.usedArtistTags).toBe(false);
    expect(lastfm.fetchArtistTags).not.toHaveBeenCalled();
  });

  // Added after a mutation check: removing the loop's "break" passed every
  // other test, because in those the working title was always the LAST one.
  test("stops at the FIRST title that works (no extra requests, tags kept)", async () => {
    const lastfm = fakeLastfm({ "Snooze (Acoustic)": tags(["acoustic", 100], ["rnb", 80], ["chill", 50]) });
    const result = await getSongTags(
      { name: "Snooze (Acoustic) (feat. Justin Bieber)", artists: ["SZA", "Justin Bieber"] },
      lastfm
    );
    expect(result.matchedTitle).toBe("Snooze (Acoustic)");
    expect(result.titlesTried).toHaveLength(2);
    expect(lastfm.fetchTrackTags).toHaveBeenCalledTimes(2);
    expect(result.tags.map((t) => t.name)).toEqual(["acoustic", "r&b", "chill"]);
  });

  test("drops tags repeating the title, but version words like '(Acoustic)' don't count as title", async () => {
    const lastfm = fakeLastfm({
      "The Color Violet (Live)": tags(["color", 100], ["live", 80], ["synthwave", 60], ["r&b", 50], ["violet", 40]),
    });
    const result = await getSongTags({ name: "The Color Violet (Live)", artists: ["Tory Lanez"] }, lastfm);
    // "color"/"violet" repeat the core title -> dropped; "live" comes from the version marker -> kept.
    expect(result.tags.map((t) => t.name)).toEqual(["live", "synthwave", "r&b"]);
  });

  test("sends only the MAIN artist to Last.fm", async () => {
    const lastfm = fakeLastfm({});
    await getSongTags({ name: "Snooze", artists: ["SZA", "Justin Bieber"] }, lastfm);
    expect(lastfm.fetchTrackTags).toHaveBeenCalledWith("SZA", "Snooze");
    expect(lastfm.fetchArtistTags).toHaveBeenCalledWith("SZA");
  });

  test("RESCUER: no song tags at all -> artist tags only, at half weight", async () => {
    const lastfm = fakeLastfm({}, tags(["pop", 100], ["singer-songwriter", 50]));
    const result = await getSongTags({ name: "RESCUER", artists: ["Alex Warren"] }, lastfm);

    expect(result.matchedTitle).toBeNull();
    expect(result.usedArtistTags).toBe(true);
    expect(result.tags).toEqual([
      { name: "pop", weight: 0.5, source: "artist" },
      { name: "singer songwriter", weight: 0.25, source: "artist" },
    ]);
  });

  test("few song tags: blends song + artist tags", async () => {
    const lastfm = fakeLastfm({ Song: tags(["soul", 100]) }, tags(["pop", 100]));
    const result = await getSongTags({ name: "Song", artists: ["Someone"] }, lastfm);
    expect(result.tags).toEqual([
      { name: "soul", weight: 1, source: "track" },
      { name: "pop", weight: 0.5, source: "artist" },
    ]);
  });

  test("a title with only junk tags counts as untagged, so the next title is tried", async () => {
    const lastfm = fakeLastfm({
      "Song - Remastered": tags(["seen live", 100], ["2011", 50]),
      Song: tags(["rock", 100], ["indie", 80], ["sad", 50]),
    });
    const result = await getSongTags({ name: "Song - Remastered", artists: ["Band"] }, lastfm);
    expect(result.matchedTitle).toBe("Song");
  });

  test("Last.fm 'not found' (error 6) is treated as 'no tags', not a failure", async () => {
    const notFound = new LastfmError(6, "Track not found");
    const lastfm = fakeLastfm({ "Song (Live)": notFound, Song: tags(["jazz", 100]) }, tags(["blues", 100]));
    const result = await getSongTags({ name: "Song (Live)", artists: ["Band"] }, lastfm);
    expect(result.matchedTitle).toBe("Song");
  });

  test("other Last.fm errors (e.g. 29 rate limit) are NOT swallowed", async () => {
    const lastfm = fakeLastfm({ Song: new LastfmError(29, "Rate limit exceeded") });
    await expect(getSongTags({ name: "Song", artists: ["Band"] }, lastfm)).rejects.toThrow("Last.fm error 29");
  });

  test("no tags for song or artist -> empty result, no crash", async () => {
    const lastfm = fakeLastfm({}, []);
    const result = await getSongTags({ name: "Golden Tears", artists: ["Carpetman"] }, lastfm);
    expect(result).toEqual({ tags: [], titlesTried: ["Golden Tears"], matchedTitle: null, usedArtistTags: true });
  });
});
