// Unit tests for the live extra stats (artists, eras, key). Run with: npm test

import { describe, expect, test } from "vitest";
import { playlistExtras, yearFromRelease, type ExtraSong } from "../src/stats/playlistExtras";

const songs: ExtraSong[] = [
  { name: "Grown Up", artists: ["Nic Dean"], year: 2023, key: "G", mode: "minor" },
  { name: "Trouble", artists: ["Friday Santana", "Nic Dean"], year: 2021, key: "G", mode: "minor" },
  { name: "Crazy in Love", artists: ["Sofia Karlberg"], year: 2015, key: "D", mode: "major" },
  { name: "Old One", artists: ["Someone"], year: 1998 },
  { name: "No Date", artists: ["Nic Dean", "Nic Dean"] },
];

describe("playlistExtras", () => {
  const extras = playlistExtras(songs);

  test("artists: different artists, and who appears most (once per song)", () => {
    expect(extras.artistCount).toBe(4);
    expect(extras.topArtists[0]).toEqual(["Nic Dean", 3]);
  });

  test("eras: songs per decade, oldest first, with the oldest and newest song", () => {
    expect(extras.decades).toEqual([
      ["1990s", 1],
      ["2010s", 1],
      ["2020s", 2],
    ]);
    expect(extras.oldest).toEqual({ name: "Old One", year: 1998 });
    expect(extras.newest).toEqual({ name: "Grown Up", year: 2023 });
  });

  test("key: major vs minor and the most common key; unknown keys are skipped", () => {
    expect(extras.major).toBe(1);
    expect(extras.minor).toBe(2);
    expect(extras.topKey).toBe("G minor");
  });

  test("nothing known: empty but safe", () => {
    const empty = playlistExtras([]);
    expect(empty.artistCount).toBe(0);
    expect(empty.decades).toEqual([]);
    expect(empty.oldest).toBeNull();
    expect(empty.topKey).toBeNull();
  });

  test("odd years (0, far future) are ignored", () => {
    const odd = playlistExtras([{ name: "x", artists: ["a"], year: 0 }, { name: "y", artists: ["b"], year: 3000 }]);
    expect(odd.decades).toEqual([]);
  });
});

describe("yearFromRelease", () => {
  test("reads the year from Spotify's release date", () => {
    expect(yearFromRelease("2023-05-12T00:00:00.000Z")).toBe(2023);
    expect(yearFromRelease(undefined)).toBeUndefined();
    expect(yearFromRelease("soon")).toBeUndefined();
  });
});
