// Unit tests for Organize's grouping (step 13b). Run with: npm test

import { describe, expect, test } from "vitest";
import { groupSongs, titleCase, type GroupingSettings, type SongToGroup } from "../src/organize/grouping";
import type { SourcedTag } from "../src/tags/combineTags";
import type { MoodProfile } from "../src/mood/lyricsMood";

const t = (name: string, weight = 1, source: "track" | "artist" = "track"): SourcedTag => ({ name, weight, source });
const song = (
  id: string,
  tags: SourcedTag[],
  bpm: number | null,
  mood: MoodProfile | null,
  camelot = "8A"
): SongToGroup => ({
  uri: `spotify:track:${id}`,
  name: `Song ${id}`,
  tags,
  audio: bpm === null ? null : { bpm, key: "A", mode: "minor", camelot },
  mood,
});

// Three clearly different kinds of songs, 4 of each.
const rnb = ["r1", "r2", "r3", "r4"].map((id, i) => song(id, [t("r&b"), t("soul", 0.6)], 68 + i * 3, { love: 0.8, heartbreak: 0.2 }));
const hiphop = ["h1", "h2", "h3", "h4"].map((id, i) => song(id, [t("hip hop"), t("rap", 0.8)], 138 + i * 3, { party: 0.9, desire: 0.1 }, "4B"));
const jazz = ["j1", "j2", "j3", "j4"].map((id, i) => song(id, [t("jazz"), t("chill", 0.7)], 98 + i * 3, { hopeful: 0.7, numb: 0.3 }, "11A"));
const all = [...rnb, ...hiphop, ...jazz];

const settings = (over: Partial<GroupingSettings> = {}): GroupingSettings => ({ count: 3, overlap: false, focus: "balanced", ...over });
const groupOf = (result: ReturnType<typeof groupSongs>, id: string) =>
  result.groups.findIndex((g) => g.songs.includes(`spotify:track:${id}`));
const ids = (list: SongToGroup[]) => list.map((s) => s.uri).sort();

describe("groupSongs", () => {
  test("splits clearly different songs into their own groups", () => {
    const result = groupSongs(all, settings());
    expect(result.groups).toHaveLength(3);
    for (const kind of [rnb, hiphop, jazz]) {
      const group = result.groups[groupOf(result, kind[0].uri.split(":")[2])];
      expect([...group.songs].sort()).toEqual(ids(kind));
    }
  });

  test("the same songs in any order give the same groups (no randomness)", () => {
    const a = groupSongs(all, settings());
    const b = groupSongs([...all].reverse(), settings());
    expect(b.groups.map((g) => [...g.songs].sort())).toEqual(a.groups.map((g) => [...g.songs].sort()));
  });

  test("Auto finds the 3 natural groups", () => {
    expect(groupSongs(all, settings({ count: "auto" })).groups).toHaveLength(3);
  });

  test("without overlap, every song is in exactly one group", () => {
    const result = groupSongs(all, settings({ count: 5 }));
    const every = result.groups.reduce<string[]>((acc, g) => acc.concat(g.songs), []);
    expect(every.sort()).toEqual(ids(all));
  });

  test("never makes more groups than there are songs", () => {
    expect(groupSongs(rnb.slice(0, 2), settings({ count: 8 })).groups.length).toBeLessThanOrEqual(2);
  });

  test("a song with no tags is placed by mood and tempo (closest group)", () => {
    const untagged = song("u1", [], 70, { love: 0.85, heartbreak: 0.15 });
    const result = groupSongs([...all, untagged], settings());
    expect(groupOf(result, "u1")).toBe(groupOf(result, "r1"));
    expect(result.groups[groupOf(result, "u1")].summary.untagged).toBe(1);
  });

  test("a song with no signals at all still gets a group (the biggest)", () => {
    const blank = song("x1", [], null, null);
    const result = groupSongs([...all, blank], settings());
    expect(groupOf(result, "x1")).toBeGreaterThanOrEqual(0);
  });

  test("overlap lets an in-between song join every group it fits well", () => {
    // Half r&b love, half hip hop party, tempo halfway (r&b ~70, hip hop ~140).
    const both = song("b1", [t("r&b"), t("hip hop"), t("soul", 0.3), t("rap", 0.3)], 108, { love: 0.5, party: 0.5 });
    const songs = [...rnb, ...hiphop, both];
    const without = groupSongs(songs, settings({ count: 2 }));
    const withOverlap = groupSongs(songs, settings({ count: 2, overlap: true }));
    const count = (r: ReturnType<typeof groupSongs>) => r.groups.filter((g) => g.songs.includes("spotify:track:b1")).length;
    expect(count(without)).toBe(1);
    expect(count(withOverlap)).toBe(2);
  });

  test("Energy focus splits same-genre songs by tempo", () => {
    const slow = ["s1", "s2", "s3"].map((id, i) => song(id, [t("pop")], 70 + i, { love: 1 }));
    const fast = ["f1", "f2", "f3"].map((id, i) => song(id, [t("pop")], 140 + i, { love: 1 }));
    const result = groupSongs([...slow, ...fast], settings({ count: 2, focus: "energy" }));
    expect(groupOf(result, "s1")).toBe(groupOf(result, "s3"));
    expect(groupOf(result, "f1")).toBe(groupOf(result, "f3"));
    expect(groupOf(result, "s1")).not.toBe(groupOf(result, "f1"));
  });

  test("group names come from the group's typical tags and moods", () => {
    const names = groupSongs(all, settings({ focus: "genre" })).groups.map((g) => g.name);
    expect(names).toContain("R&B · Soul");
    expect(names).toContain("Hip Hop · Rap");
    const moodNames = groupSongs(all, settings({ focus: "mood" })).groups.map((g) => g.name);
    expect(moodNames.some((n) => n.startsWith("Love"))).toBe(true);
  });

  test("long descriptive tags never name a group", () => {
    const wordy = ["w1", "w2", "w3"].map((id) => song(id, [t("a vocal centric aesthetic", 1), t("c pop", 0.6)], 120, { desire: 1 }));
    const names = groupSongs([...all, ...wordy], settings({ count: 4, focus: "genre" })).groups.map((g) => g.name);
    expect(names.some((n) => n.includes("Aesthetic"))).toBe(false);
    expect(names).toContain("C Pop");
  });

  test("group names are all different", () => {
    const names = groupSongs(all, settings({ count: 6 })).groups.map((g) => g.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("the summary shows genres, moods, tempo and keys (key is shown, not used)", () => {
    const r = groupSongs(all, settings());
    const hip = r.groups[groupOf(r, "h1")].summary;
    expect(hip.tags[0]).toEqual(["hip hop", 4]);
    expect(hip.moods[0]).toEqual(["party", 4]);
    expect(hip.tempo.fast).toBe(4);
    expect(hip.keys).toEqual([["4B", 4]]);
  });

  test("no songs gives no groups", () => {
    expect(groupSongs([], settings()).groups).toEqual([]);
  });
});

describe("titleCase", () => {
  test.each([
    ["r&b", "R&B"],
    ["hip hop", "Hip Hop"],
    ["heartbreak", "Heartbreak"],
  ])("%s -> %s", (input, output) => expect(titleCase(input)).toBe(output));
});

describe("naming with artists", () => {
  test("a tag only one artist in the group has doesn't name the group", () => {
    const songs = [
      { ...song("a1", [t("alternative"), t("oddfantag", 1)], 70, { heartbreak: 1 }), artists: ["Artist One"] },
      { ...song("a2", [t("alternative"), t("oddfantag", 1)], 72, { heartbreak: 1 }), artists: ["Artist One"] },
      { ...song("a3", [t("alternative"), t("indie", 0.5)], 71, { heartbreak: 1 }), artists: ["Artist Two"] },
      { ...song("a4", [t("alternative"), t("indie", 0.5)], 73, { heartbreak: 1 }), artists: ["Artist Three"] },
    ];
    const [group] = groupSongs(songs, { count: 1, overlap: false, focus: "genre" }).groups;
    expect(group.name).not.toMatch(/Oddfantag/);
    expect(group.name).toMatch(/Alternative/);
  });
});
