// Unit tests for the saved Prism playlist records. Run with: npm test

import { describe, expect, test } from "vitest";
import {
  SAMPLE_RECORD,
  addRecord,
  buildRecord,
  chartRows,
  estimateRecord,
  lengthSummary,
  matchSpread,
  parseRecords,
  tempoSpread,
  topMood,
} from "../src/stats/playlistStats";
import type { SourcedTag } from "../src/tags/combineTags";
import type { MoodProfile } from "../src/mood/lyricsMood";

const t = (name: string): SourcedTag => ({ name, weight: 1, source: "track" });
const audio = (bpm: number) => ({ bpm, key: "C", mode: "minor", camelot: "5A" });
const heartbreak = { heartbreak: 0.7, love: 0.3 } as MoodProfile;

const seed = { uri: "spotify:track:seed", name: "Often", artists: ["The Weeknd"], tags: [t("r&b"), t("dark")], audio: audio(100), mood: heartbreak };

function record() {
  return buildRecord({
    uri: "spotify:playlist:new",
    name: "  Prism · Often ",
    createdAt: 1000,
    seed,
    keptTags: [t("r&b")],
    songs: [
      { uri: "a", tags: [t("r&b"), t("pop")], audio: audio(120), mood: null },
      { uri: "b", tags: [t("R&B"), t("r&b"), t("soul")], audio: null, mood: heartbreak },
    ],
  });
}

describe("buildRecord", () => {
  test("counts each tag once per song, biggest first, ignoring capitals", () => {
    expect(record().tagCounts).toEqual([
      ["r&b", 3],
      ["dark", 1],
      ["pop", 1],
      ["soul", 1],
    ]);
  });

  test("counts the seed in the song total", () => {
    expect(record().songCount).toBe(3);
  });

  test("averages the BPMs it has", () => {
    expect(record().averageBpm).toBe(110);
  });

  test("counts the main lyrics moods", () => {
    expect(record().moodCounts).toEqual([
      ["heartbreak", 2],
      ["love", 2],
    ]);
  });

  test("keeps the kept tags, the seed and a trimmed name", () => {
    const r = record();
    expect(r.keptTags).toEqual(["r&b"]);
    expect(r.seed).toEqual({ uri: "spotify:track:seed", name: "Often", artists: ["The Weeknd"] });
    expect(r.name).toBe("Prism · Often");
  });

  test("no BPMs at all gives null", () => {
    const r = buildRecord({ uri: "u", name: "n", createdAt: 0, seed: { ...seed, audio: null }, keptTags: [], songs: [] });
    expect(r.averageBpm).toBeNull();
  });
});

describe("saved records", () => {
  test("missing or broken text reads as no records", () => {
    expect(parseRecords(null)).toEqual({});
    expect(parseRecords("not json")).toEqual({});
    expect(parseRecords("[1,2]")).toEqual({});
  });

  test("a record saved and read back is the same", () => {
    const records = addRecord({}, record());
    expect(parseRecords(JSON.stringify(records))["spotify:playlist:new"]).toEqual(record());
  });
});

describe("for the stats page", () => {
  test("chartRows: biggest first, share of the whole playlist, at most `max`", () => {
    const rows = chartRows(record(), 2);
    expect(rows).toEqual([
      { name: "r&b", count: 3, share: 1 },
      { name: "dark", count: 1, share: 1 / 3 },
    ]);
  });

  test("chartRows on the sample shows 8 rows, all bars within 0..1", () => {
    const rows = chartRows(SAMPLE_RECORD);
    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.share > 0 && row.share <= 1)).toBe(true);
  });

  test("topMood: most common mood, or null", () => {
    expect(topMood(SAMPLE_RECORD)).toBe("heartbreak");
    expect(topMood({ ...SAMPLE_RECORD, moodCounts: [] })).toBeNull();
  });
});

describe("estimateRecord (playlists with no saved record)", () => {
  const estimate = () =>
    estimateRecord({
      uri: "spotify:playlist:old",
      name: "Old mix",
      songs: [
        { uri: "a", tags: [t("r&b"), t("soul")], audio: audio(90), mood: heartbreak },
        { uri: "b", tags: [t("r&b")], audio: audio(110), mood: null },
        { uri: "c", tags: null, audio: audio(130), mood: null }, // never scanned
      ],
    });

  test("counts genres only from scanned songs, and says how many", () => {
    const r = estimate();
    expect(r.tagCounts).toEqual([
      ["r&b", 2],
      ["soul", 1],
    ]);
    expect(r.estimate).toEqual({ scanned: 2 });
    expect(r.songCount).toBe(3);
  });

  test("BPM covers every song with a BPM, scanned or not", () => {
    expect(estimate().averageBpm).toBe(110);
  });

  test("seed, date and built-from tags are unknown", () => {
    const r = estimate();
    expect([r.seed, r.createdAt, r.keptTags]).toEqual([null, null, []]);
  });

  test("bars are shares of the scanned songs", () => {
    expect(chartRows(estimate())[0]).toEqual({ name: "r&b", count: 2, share: 1 });
  });
});

describe("tempo, length and match spread", () => {
  const song = (name: string, bpm: number | null, durationMs?: number) => ({
    name,
    durationMs,
    tags: [],
    audio: bpm === null ? null : audio(bpm),
    mood: null,
  });

  test("tempoSpread: slow < 90 <= mid < 120 <= fast, with slowest and fastest", () => {
    const spread = tempoSpread([song("A", 72), song("B", 90), song("C", 119.6), song("D", 134), song("E", null)]);
    expect(spread).toEqual({
      slow: 1,
      mid: 1,
      fast: 2, // 119.6 rounds to 120
      slowest: { name: "A", value: 72 },
      fastest: { name: "D", value: 134 },
    });
  });

  test("tempoSpread with no BPMs has no slowest/fastest", () => {
    expect(tempoSpread([song("A", null)])).toEqual({ slow: 0, mid: 0, fast: 0, slowest: null, fastest: null });
  });

  test("lengthSummary: total, how many known, longest and shortest", () => {
    expect(lengthSummary([song("A", null, 200000), song("B", null, 100000), song("C", null)])).toEqual({
      totalMs: 300000,
      known: 2,
      longest: { name: "A", value: 200000 },
      shortest: { name: "B", value: 100000 },
    });
  });

  test("matchSpread: average, bands (best first) and best song", () => {
    const spread = matchSpread([
      { name: "A", score: 0.71 },
      { name: "B", score: 0.6 },
      { name: "C", score: 0.45 },
      { name: "D", score: 0.1 },
    ])!;
    expect(spread.average).toBeCloseTo(0.465);
    expect(spread.bands).toEqual([
      ["60%+", 2],
      ["40–59%", 1],
      ["20–39%", 0],
      ["under 20%", 1],
    ]);
    expect(spread.best).toEqual({ name: "A", value: 0.71 });
  });

  test("matchSpread of nothing is undefined (nothing to show)", () => {
    expect(matchSpread([])).toBeUndefined();
  });

  test("buildRecord saves tempo, length and match spread", () => {
    const r = buildRecord({
      uri: "u",
      name: "n",
      createdAt: 0,
      seed: { ...seed, durationMs: 150000 },
      keptTags: [],
      songs: [{ uri: "a", name: "Pick", durationMs: 100000, tags: [], audio: audio(130), mood: null, match: { score: 0.5 } }],
    });
    expect(r.tempo?.fast).toBe(1);
    expect(r.length?.totalMs).toBe(250000);
    expect(r.match?.best).toEqual({ name: "Pick", value: 0.5 });
  });

  test("an estimate has tempo and length but no match spread", () => {
    const r = estimateRecord({ uri: "u", name: "n", songs: [{ uri: "a", name: "A", durationMs: 1000, tags: null, audio: audio(80), mood: null }] });
    expect(r.tempo?.slow).toBe(1);
    expect(r.length?.known).toBe(1);
    expect(r.match).toBeUndefined();
  });
});
