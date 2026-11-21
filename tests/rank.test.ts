// Unit tests for ranking and default picks. Run with: npm test

import { describe, expect, test } from "vitest";
import { defaultPicks, rankSongs, songKey } from "../src/scoring/rank";
import type { ScannedSong } from "../src/scan/scan";
import type { SourcedTag } from "../src/tags/combineTags";

const t = (name: string, weight = 1): SourcedTag => ({ name, weight, source: "track" });
const song = (id: string, name: string, artist: string, tags: SourcedTag[], bpm = 100): ScannedSong => ({
  uri: `spotify:track:${id}`,
  name,
  artists: [artist],
  tags,
  audio: { bpm, key: "C", mode: "minor", camelot: "8A" },
  mood: null,
  tagStatus: tags.length ? "song" : "none",
});

const seed = {
  uri: "spotify:track:seed",
  name: "Often",
  artists: ["The Weeknd"],
  tags: [t("r&b"), t("dark", 0.5)],
  audio: { bpm: 100, key: "C", mode: "minor" as const, camelot: "8A" },
  mood: null,
};

describe("rankSongs", () => {
  test("best match first; songs with no shared tags are left out and counted", () => {
    const { matches, noMatch } = rankSongs(seed, [
      song("a", "Only Dark", "X", [t("dark")]),
      song("b", "Both", "Y", [t("r&b"), t("dark")]),
      song("c", "Country", "Z", [t("country")]),
      song("d", "No Tags", "W", []),
    ]);
    expect(matches.map((s) => s.name)).toEqual(["Both", "Only Dark"]);
    expect(noMatch).toBe(2);
  });

  test("the seed itself is never a candidate (it goes first anyway)", () => {
    const { matches } = rankSongs(seed, [song("seed", "Often", "The Weeknd", [t("r&b")])]);
    expect(matches).toEqual([]);
  });

  test("other versions of the seed are skipped too", () => {
    const { matches } = rankSongs(seed, [song("x", "Often - Kygo Remix", "The Weeknd", [t("r&b")])]);
    expect(matches).toEqual([]);
  });

  test("two versions of the same song: only the better-scoring one is kept", () => {
    const { matches } = rankSongs(seed, [
      song("v1", "Snooze", "SZA", [t("r&b")], 150), // far tempo
      song("v2", "Snooze (Acoustic)", "SZA", [t("r&b")], 100), // same tempo
    ]);
    expect(matches.map((s) => s.uri)).toEqual(["spotify:track:v2"]);
  });

  test("each match carries its details (for the 'why' in the preview)", () => {
    const { matches } = rankSongs(seed, [song("b", "Both", "Y", [t("r&b"), t("dark")])]);
    expect(matches[0].match.matchedTags).toEqual(["r&b", "dark"]);
    expect(matches[0].match.score).toBeCloseTo(1);
  });
});

describe("songKey", () => {
  test("ignores versions, featured artists and capitals; keeps the main artist", () => {
    expect(songKey({ name: "Snooze (Acoustic) (feat. Justin Bieber)", artists: ["SZA", "Justin Bieber"] })).toBe(
      songKey({ name: "SNOOZE", artists: ["sza"] })
    );
    expect(songKey({ name: "Snooze", artists: ["SZA"] })).not.toBe(songKey({ name: "Snooze", artists: ["Someone Else"] }));
  });
});

describe("defaultPicks", () => {
  const ranked = rankSongs(seed, [
    song("a", "A", "1", [t("r&b"), t("dark")]), // ~1.0
    song("b", "B", "2", [t("r&b")]), // ~0.8
    song("c", "C", "3", [t("dark", 0.05)], 160), // ~0.12 (tags 3%, tempo 0, key 100%): below the floor
  ]).matches;

  test("recommends the best by rank, skipping very weak matches (under 15%)", () => {
    expect(defaultPicks(ranked)).toEqual(["spotify:track:a", "spotify:track:b"]);
  });

  test("recommends at most 30 by default", () => {
    const many = rankSongs(
      seed,
      Array.from({ length: 40 }, (_, i) => song(`s${i}`, `Song ${i}`, `Artist ${i}`, [t("r&b")]))
    ).matches;
    expect(defaultPicks(many)).toHaveLength(30);
  });

  test("never more than `max`", () => {
    expect(defaultPicks(ranked, { max: 1 })).toEqual(["spotify:track:a"]);
  });
});
