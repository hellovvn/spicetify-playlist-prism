// Unit tests for the scan engine, with FAKE Spotify/Last.fm/clock.
// Run with: npm test

import { describe, expect, test, vi } from "vitest";
import {
  scanSongs,
  shareArtistLookups,
  summarize,
  tagStatusOf,
  timeLeftText,
  type ScanDeps,
} from "../src/scan/scan";
import { TagCache } from "../src/scan/tagCache";
import { LastfmError } from "../src/lastfm/client";
import type { SongTagsResult } from "../src/tags/getSongTags";

const track = (id: string, artist = "Band") => ({ uri: `spotify:track:${id}`, name: `Song ${id}`, artists: [artist] });
const songTags = (name: string): SongTagsResult => ({
  tags: [{ name, weight: 1, source: "track" }],
  titlesTried: [],
  matchedTitle: "x",
  usedArtistTags: false,
});
const bpm = { bpm: 100, key: "C", mode: "major" as const, camelot: "8B" };

// Builds fake deps. `tagsFor` decides each song's answer (or an Error to throw).
function fakeDeps(tagsFor: (name: string) => SongTagsResult | Error, cache = new TagCache()) {
  const slept: number[] = [];
  const deps: ScanDeps = {
    getAudio: vi.fn(async (uris: string[]) => new Map(uris.map((u) => [u, bpm]))),
    getTags: vi.fn(async (song) => {
      const answer = tagsFor(song.name);
      if (answer instanceof Error) throw answer;
      return answer;
    }),
    cache,
    saveCache: vi.fn(),
    clock: { now: () => 0, sleep: async (ms) => void slept.push(ms) },
    isFatal: (e) => e instanceof LastfmError && (e.code === 10 || e.code === 26),
    isRateLimit: (e) => e instanceof LastfmError && e.code === 29,
  };
  return { deps, slept };
}

describe("scanSongs", () => {
  test("gets tags + BPM/key for every song, in the original order", async () => {
    const { deps } = fakeDeps(() => songTags("r&b"));
    const { songs, cancelled } = await scanSongs([track("a"), track("b"), track("c")], deps);
    expect(songs.map((s) => s.uri)).toEqual(["spotify:track:a", "spotify:track:b", "spotify:track:c"]);
    expect(songs.every((s) => s.tagStatus === "song" && s.audio?.bpm === 100)).toBe(true);
    expect(cancelled).toBe(false);
    expect(deps.getAudio).toHaveBeenCalledTimes(1); // all songs in one batch call
  });

  test("songs already in the cache skip Last.fm", async () => {
    const cache = new TagCache();
    cache.set("spotify:track:a", { tags: [{ name: "cached", weight: 1, source: "track" }], matchedTitle: "x" }, 0);
    const { deps } = fakeDeps(() => songTags("fresh"), cache);
    const progress: number[] = [];
    const { songs } = await scanSongs([track("a"), track("b")], deps, (p) => progress.push(p.fromCache));
    expect(songs.map((s) => s.tags[0].name)).toEqual(["cached", "fresh"]);
    expect(deps.getTags).toHaveBeenCalledTimes(1);
    expect(progress.at(-1)).toBe(1);
  });

  test("new results go into the cache and the cache is saved", async () => {
    const { deps } = fakeDeps(() => songTags("pop"));
    await scanSongs([track("a")], deps);
    expect(deps.cache.get("spotify:track:a", 0)?.tags[0].name).toBe("pop");
    expect(deps.saveCache).toHaveBeenCalled();
  });

  test("saves the cache every `saveEvery` songs, not only at the end", async () => {
    const { deps } = fakeDeps(() => songTags("pop"));
    await scanSongs([track("a"), track("b"), track("c"), track("d"), track("e")], deps, undefined, undefined, {
      saveEvery: 2,
      concurrency: 1,
    });
    expect(deps.saveCache).toHaveBeenCalledTimes(3); // after 2, after 4, and the leftover 1 at the end
  });

  test("rate limit (error 29): waits 10 s, 20 s... then retries the same song", async () => {
    let calls = 0;
    const { deps, slept } = fakeDeps(() => (++calls <= 2 ? new LastfmError(29, "slow down") : songTags("pop")));
    const { songs } = await scanSongs([track("a")], deps);
    expect(slept).toEqual([10_000, 20_000]);
    expect(songs[0].tagStatus).toBe("song");
  });

  test("gives up on a song after too many rate limits, but keeps scanning the others", async () => {
    const { deps } = fakeDeps((name) => (name === "Song a" ? new LastfmError(29, "slow down") : songTags("pop")));
    const progress: number[] = [];
    const { songs } = await scanSongs([track("a"), track("b")], deps, (p) => progress.push(p.failed), undefined, {
      maxRetries: 2,
    });
    expect(songs.map((s) => s.tagStatus)).toEqual(["error", "song"]);
    expect(progress.at(-1)).toBe(1);
  });

  test("other errors fail just that song (no retries)", async () => {
    const { deps, slept } = fakeDeps((name) => (name === "Song a" ? new Error("network") : songTags("pop")));
    const { songs } = await scanSongs([track("a"), track("b")], deps);
    expect(songs.map((s) => s.tagStatus)).toEqual(["error", "song"]);
    expect(slept).toEqual([]);
  });

  test("a bad API key (error 10) stops the whole scan with that error, after saving the cache", async () => {
    const { deps } = fakeDeps((name) => (name === "Song b" ? new LastfmError(10, "Invalid API key") : songTags("pop")));
    await expect(
      scanSongs([track("a"), track("b"), track("c"), track("d")], deps, undefined, undefined, { concurrency: 1 })
    ).rejects.toThrow("Last.fm error 10");
    expect(deps.getTags).toHaveBeenCalledTimes(2); // stopped right after the bad answer
    expect(deps.saveCache).toHaveBeenCalled(); // song a's tags kept for next time
  });

  test("Cancel: returns what was scanned so far and says it was cancelled", async () => {
    const { deps } = fakeDeps(() => songTags("pop"));
    let done = 0;
    const { songs, cancelled } = await scanSongs(
      [track("a"), track("b"), track("c")],
      deps,
      (p) => (done = p.done),
      () => done >= 1,
      { concurrency: 1 }
    );
    expect(songs).toHaveLength(1);
    expect(cancelled).toBe(true);
  });

  test("BPM/key failing doesn't stop the scan", async () => {
    const { deps } = fakeDeps(() => songTags("pop"));
    deps.getAudio = async () => {
      throw new Error("Spotify changed something");
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { songs } = await scanSongs([track("a")], deps);
    expect(songs[0]).toMatchObject({ tagStatus: "song", audio: null });
  });
});

describe("tagStatusOf / summarize", () => {
  test.each([
    [[{ name: "pop", weight: 1, source: "track" }], "song"],
    [[{ name: "pop", weight: 1, source: "track" }, { name: "x", weight: 0.5, source: "artist" }], "song"],
    [[{ name: "pop", weight: 0.5, source: "artist" }], "artist"],
    [[], "none"],
  ])("%j -> %s", (tags, status) => {
    expect(tagStatusOf(tags as any)).toBe(status);
  });

  test("summarize counts each kind", () => {
    const base = { uri: "u", name: "n", artists: [], tags: [] };
    expect(
      summarize([
        { ...base, tagStatus: "song", audio: bpm },
        { ...base, tagStatus: "artist", audio: null },
        { ...base, tagStatus: "none", audio: bpm },
        { ...base, tagStatus: "error", audio: null },
      ])
    ).toEqual({ total: 4, songTags: 1, artistOnly: 1, noTags: 1, failed: 1, withBpm: 2 });
  });
});

describe("timeLeftText", () => {
  const p = (done: number, total: number, fromCache = 0) => ({ done, total, fromCache, failed: 0 });

  test.each([
    ["too few lookups to guess", p(4, 100), 4_000, null],
    ["cached songs don't count as lookups", p(50, 100, 46), 4_000, null],
    ["10 songs in 10 s, 90 left -> 90 s", p(10, 100), 10_000, "about 2 min left"],
    ["under a minute", p(90, 100), 90_000, "less than a minute left"],
    ["911 songs at 1 s each", p(11, 911), 11_000, "about 15 min left"],
  ])("%s", (_label, progress, elapsed, expected) => {
    expect(timeLeftText(progress, elapsed)).toBe(expected);
  });
});

describe("shareArtistLookups", () => {
  test("one Last.fm request per artist, even when asked at the same moment", async () => {
    const fetchArtistTags = vi.fn(async () => [{ name: "pop", count: 100 }]);
    const shared = shareArtistLookups({ fetchTrackTags: vi.fn(), fetchArtistTags });
    await Promise.all([shared.fetchArtistTags("SZA"), shared.fetchArtistTags("sza"), shared.fetchArtistTags("SZA")]);
    expect(fetchArtistTags).toHaveBeenCalledTimes(1); // capitals don't matter
    await shared.fetchArtistTags("Drake");
    expect(fetchArtistTags).toHaveBeenCalledTimes(2);
  });

  test("a failed lookup is forgotten, so it can be retried", async () => {
    let calls = 0;
    const fetchArtistTags = vi.fn(async () => {
      if (++calls === 1) throw new LastfmError(29, "slow down");
      return [{ name: "pop", count: 100 }];
    });
    const shared = shareArtistLookups({ fetchTrackTags: vi.fn(), fetchArtistTags });
    await expect(shared.fetchArtistTags("SZA")).rejects.toThrow();
    await expect(shared.fetchArtistTags("SZA")).resolves.toHaveLength(1);
  });
});
