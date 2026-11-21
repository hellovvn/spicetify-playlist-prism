// Unit tests for the BPM/key parser (the pure part of src/spotify/audio.ts).
// Run with: npm test

import { describe, expect, test } from "vitest";
import { formatAudio, parseAudioAttributes } from "../src/spotify/audio";
import fixtures from "./fixtures/audio-attributes.json";

describe("parseAudioAttributes on real Spotify data (fixtures)", () => {
  const expected: Record<string, string> = {
    Often: "133 BPM, G minor (6A)",
    "Couldn’t Make It Any Harder": "76 BPM, E major (12B)",
    "WHERE IS MY HUSBAND!": "116 BPM, A# minor (3A)",
    "Marvins Room": "84 BPM, A minor (8A)",
    "(a podcast episode)": "no BPM/key",
  };

  test.each(fixtures.songs)("$title", (song) => {
    expect(formatAudio(parseAudioAttributes(song.raw))).toBe(expected[song.title]);
  });

  test("keeps the exact BPM (rounding is only for display)", () => {
    expect(parseAudioAttributes(fixtures.songs[0].raw)?.bpm).toBe(133.365);
  });
});

describe("parseAudioAttributes rules", () => {
  const valid = { bpm: 100, key: { key: "C", mode: 2, camelotKey: { value: "8B" } } };

  test("minor/major comes from the Camelot letter, not Spotify's mode number", () => {
    // Even with a contradicting mode number, A = minor and B = major.
    expect(parseAudioAttributes({ bpm: 100, key: { key: "A", mode: 2, camelotKey: { value: "8A" } } })?.mode).toBe("minor");
    expect(parseAudioAttributes({ bpm: 100, key: { key: "C", mode: 1, camelotKey: { value: "8B" } } })?.mode).toBe("major");
  });

  test("accepts Camelot numbers 1 to 12", () => {
    for (const value of ["1A", "9B", "10A", "12B"]) {
      expect(parseAudioAttributes({ ...valid, key: { ...valid.key, camelotKey: { value } } })).not.toBeNull();
    }
  });

  test.each([
    ["null (no data)", null],
    ["undefined", undefined],
    ["missing bpm", { key: valid.key }],
    ["bpm 0", { ...valid, bpm: 0 }],
    ["bpm NaN", { ...valid, bpm: Number.NaN }],
    ["bpm as text", { ...valid, bpm: "100" }],
    ["missing key", { bpm: 100 }],
    ["empty key name", { ...valid, key: { ...valid.key, key: "" } }],
    ["missing camelot", { bpm: 100, key: { key: "C", mode: 2 } }],
    ["camelot 0A", { ...valid, key: { ...valid.key, camelotKey: { value: "0A" } } }],
    ["camelot 13B", { ...valid, key: { ...valid.key, camelotKey: { value: "13B" } } }],
    ["camelot 5C", { ...valid, key: { ...valid.key, camelotKey: { value: "5C" } } }],
  ])("returns null for %s", (_label, raw) => {
    expect(parseAudioAttributes(raw)).toBeNull();
  });
});
