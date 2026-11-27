// Unit tests for the two kinds of Grow seed (a song or a playlist). Run with: npm test

import { describe, expect, test } from "vitest";
import { growScorer, seedExclusions, seedName, seedTrackUris, type PlaylistSeedData, type SongSeedData } from "../src/scoring/growSeed";
import { songKey } from "../src/scoring/rank";
import { buildRecord } from "../src/stats/playlistStats";
import { panelSubtitle } from "../src/ui/sidePanel";
import type { ScannedSong } from "../src/scan/scan";
import type { SourcedTag } from "../src/tags/combineTags";

const t = (name: string): SourcedTag => ({ name, weight: 1, source: "track" });
const audio = (bpm: number) => ({ bpm, key: "C", mode: "minor" as const, camelot: "8A" });
const song = (uri: string, name: string, tags: SourcedTag[], bpm = 100): ScannedSong => ({
  uri,
  name,
  artists: ["A"],
  tags,
  audio: audio(bpm),
  mood: null,
  tagStatus: tags.length ? "song" : "none",
});

const songSeed: SongSeedData = {
  kind: "song",
  track: { uri: "spotify:track:seed", name: "Often", artists: ["The Weeknd"] } as SongSeedData["track"],
  tags: [t("r&b")],
  audio: audio(100),
  mood: null,
};

const playlistSeed: PlaylistSeedData = {
  kind: "playlist",
  playlist: { uri: "spotify:playlist:p", name: "Late night", cover: null },
  songs: [song("spotify:track:a", "Alpha", [t("r&b")], 70), song("spotify:local:x", "Local file", [t("r&b")], 70)],
  tags: [{ ...t("r&b"), count: 2 }],
  mood: null,
};

describe("seed helpers", () => {
  test("names and the songs that go first", () => {
    expect(seedName(songSeed)).toBe("Often");
    expect(seedName(playlistSeed)).toBe("Late night");
    expect(seedTrackUris(songSeed)).toEqual(["spotify:track:seed"]);
    // Local files can't be added to a playlist by Prism: left out.
    expect(seedTrackUris(playlistSeed)).toEqual(["spotify:track:a"]);
  });

  test("every seed song is excluded from the matches", () => {
    const excluded = seedExclusions(playlistSeed);
    expect([...excluded.uris]).toEqual(["spotify:track:a", "spotify:local:x"]);
    expect(excluded.keys.has(songKey({ name: "Alpha", artists: ["A"] }))).toBe(true);
  });

  test("a playlist seed compares tempo with its closest songs", () => {
    const score = growScorer(playlistSeed, [t("r&b")]);
    const slow = score({ tags: [t("r&b")], audio: audio(70), mood: null });
    const fast = score({ tags: [t("r&b")], audio: audio(140 * 1.15), mood: null });
    expect(slow.bpmScore).toBe(1);
    expect(fast.score).toBeLessThan(slow.score);
  });
});

describe("stats record for a playlist seed", () => {
  test("seed is null, grownFrom names the playlist, seed songs count", () => {
    const record = buildRecord({
      uri: "spotify:playlist:new",
      name: "Prism · Late night",
      createdAt: 1,
      seed: { playlist: { uri: "spotify:playlist:p", name: "Late night" }, songs: playlistSeed.songs },
      keptTags: [t("r&b")],
      songs: [{ ...song("spotify:track:b", "Beta", [t("r&b")]), match: { score: 0.5 } }],
    });
    expect(record.seed).toBeNull();
    expect(record.grownFrom).toEqual({ uri: "spotify:playlist:p", name: "Late night" });
    expect(record.songCount).toBe(3);
    expect(panelSubtitle(record)).toBe('Grown from the playlist "Late night"');
  });
});
