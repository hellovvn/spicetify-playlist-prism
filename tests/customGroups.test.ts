// Unit tests for Organize's "Start from scratch" groups (step 13c-2). Run with: npm test

import { describe, expect, test } from "vitest";
import {
  addCustomGroup,
  autoName,
  blankGroups,
  checkCustomGroups,
  fitScore,
  labelChoices,
  matchCount,
  removeCustomGroup,
  renameCustomGroup,
  sortIntoGroups,
  toggleLabel,
  type CustomGroup,
} from "../src/organize/customGroups";
import type { SongToGroup } from "../src/organize/grouping";
import type { SourcedTag } from "../src/tags/combineTags";
import type { MoodProfile } from "../src/mood/lyricsMood";

const t = (name: string, weight = 1, source: "track" | "artist" = "track"): SourcedTag => ({ name, weight, source });
const song = (id: string, tags: SourcedTag[], bpm: number | null, mood: MoodProfile | null): SongToGroup => ({
  uri: `spotify:track:${id}`,
  name: `Song ${id}`,
  tags,
  audio: bpm === null ? null : { bpm, key: "A", mode: "minor", camelot: "8A" },
  mood,
});
const uri = (id: string) => `spotify:track:${id}`;

const rnb1 = song("r1", [t("r&b"), t("soul", 0.6)], 70, { love: 0.8, heartbreak: 0.2 });
const rnb2 = song("r2", [t("R&B", 0.7)], 74, { love: 1 });
const rap1 = song("h1", [t("hip hop"), t("rap", 0.8)], 140, { party: 0.9, desire: 0.1 });
const sad = song("s1", [t("indie")], 80, { heartbreak: 0.9, numb: 0.1 });
// No tags and no mood word matches; only a fast BPM and a party mood.
const fastUntagged = song("u1", [], 142, { party: 1 });
const slowUntagged = song("u2", [], 72, null);
const all = [rnb1, rnb2, rap1, sad, fastUntagged, slowUntagged];

const group = (id: string, genres: string[], moods: CustomGroup["moods"] = [], name = id): CustomGroup => ({
  id,
  name,
  named: true,
  genres,
  moods,
});

describe("labelChoices", () => {
  test("lists genres (once per song, any capitals) and main moods, most common first", () => {
    const { genres, moods } = labelChoices(all);
    expect(genres[0]).toEqual({ name: "r&b", songs: 2 });
    expect(genres.map((g) => g.name)).toEqual(["r&b", "hip hop", "indie", "rap", "soul"]);
    // heartbreak: r1 (0.2 counts as main) + s1; love: r1 + r2; party: h1 + u1.
    expect(moods).toEqual([
      { name: "heartbreak", songs: 2 },
      { name: "love", songs: 2 },
      { name: "party", songs: 2 },
    ]);
  });

  test("skips personal junk tags", () => {
    const { genres } = labelChoices([song("x", [t("my top songs"), t("jazz")], null, null)]);
    expect(genres.map((g) => g.name)).toEqual(["jazz"]);
  });
});

describe("building groups", () => {
  test("blankGroups makes 2 to 10 empty groups called Group 1, 2...", () => {
    expect(blankGroups(3).map((g) => g.name)).toEqual(["Group 1", "Group 2", "Group 3"]);
    expect(blankGroups(1)).toHaveLength(2);
    expect(blankGroups(50)).toHaveLength(10);
  });

  test("toggling labels names an unnamed group after them, and turns them off again", () => {
    let groups = blankGroups(2);
    groups = toggleLabel(groups, "c1", "genre", "R&B");
    groups = toggleLabel(groups, "c1", "mood", "love");
    expect(groups[0]).toMatchObject({ name: "R&B · Love", genres: ["r&b"], moods: ["love"] });
    groups = toggleLabel(groups, "c1", "genre", "r&b");
    groups = toggleLabel(groups, "c1", "mood", "love");
    expect(groups[0]).toMatchObject({ name: "Group 1", genres: [], moods: [] });
    expect(groups[1].name).toBe("Group 2");
  });

  test("a typed name sticks when labels change; a blank one goes back to automatic", () => {
    let groups = renameCustomGroup(blankGroups(2), "c1", "  Late night  ");
    groups = toggleLabel(groups, "c1", "genre", "soul");
    expect(groups[0].name).toBe("Late night");
    groups = renameCustomGroup(groups, "c1", "   ");
    expect(groups[0]).toMatchObject({ name: "Soul", named: false });
  });

  test("autoName uses the first two labels", () => {
    expect(autoName({ genres: ["hip hop", "rap", "trap"], moods: [] })).toBe("Hip Hop · Rap");
    expect(autoName({ genres: [], moods: [] })).toBe("");
  });

  test("adding and removing groups keeps 2 to 10, with ids never reused", () => {
    let groups = addCustomGroup(blankGroups(2));
    expect(groups.map((g) => g.id)).toEqual(["c1", "c2", "c3"]);
    groups = removeCustomGroup(groups, "c2");
    groups = addCustomGroup(groups);
    expect(new Set(groups.map((g) => g.id)).size).toBe(3);
    expect(removeCustomGroup(removeCustomGroup(groups, "c1"), "c3")).toHaveLength(2);
    expect(addCustomGroup(blankGroups(10))).toHaveLength(10);
  });

  test("edits never change the groups they were given", () => {
    const before = blankGroups(3);
    toggleLabel(before, "c1", "genre", "jazz");
    renameCustomGroup(before, "c2", "X");
    removeCustomGroup(before, "c3");
    addCustomGroup(before);
    expect(before).toEqual(blankGroups(3));
  });

  test("checkCustomGroups says what's missing", () => {
    expect(checkCustomGroups([group("a", ["jazz"])])).toMatch(/at least 2/);
    expect(checkCustomGroups([group("a", ["jazz"]), group("b", [], [], "Empty one")])).toMatch(/"Empty one" has no genres/);
    expect(checkCustomGroups([group("a", ["jazz"]), group("b", [], ["love"])])).toBeNull();
  });
});

describe("fitting songs", () => {
  test("matchCount counts songs with any of the group's genres or main moods", () => {
    expect(matchCount(all, { genres: ["r&b"], moods: [] })).toBe(2);
    expect(matchCount(all, { genres: [], moods: ["party"] })).toBe(2);
    expect(matchCount(all, { genres: ["indie"], moods: ["love"] })).toBe(3);
  });

  test("fitScore: more of the group's genres = better; artist tags count half", () => {
    const g = { genres: ["r&b", "soul"], moods: [] };
    expect(fitScore(rnb1, g, "balanced")).toBe(1); // 1 + 0.6, capped at 1
    expect(fitScore(rnb2, g, "balanced")).toBeCloseTo(0.7);
    const artistOnly = song("a", [t("r&b", 1, "artist")], null, null);
    expect(fitScore(artistOnly, g, "balanced")).toBeCloseTo(0.5);
  });
});

describe("sortIntoGroups", () => {
  const groups = [group("rnb", ["r&b", "soul"], [], "R&B"), group("hype", ["hip hop"], ["party"], "Hype"), group("sad", [], ["heartbreak"], "Sad")];

  test("one each: every song lands in exactly one group, the one it fits best", () => {
    const result = sortIntoGroups(all, groups, { overlap: false, focus: "balanced" });
    expect(result.groups.map((g) => g.name)).toEqual(["R&B", "Hype", "Sad"]);
    expect(result.groups[0].songs).toEqual([uri("r1"), uri("r2"), uri("u2")]); // best fit first, forced last
    expect(result.groups[1].songs).toEqual([uri("h1"), uri("u1")]);
    expect(result.groups[2].songs).toEqual([uri("s1")]);
    const every = result.groups.reduce<string[]>((acc, g) => acc.concat(g.songs), []);
    expect(every.sort()).toEqual(all.map((s) => s.uri).sort());
  });

  test("songs matching nothing are placed by mood + BPM, and listed", () => {
    // u1 matches "party" directly; u2 has no tags or mood: placed by BPM (72,
    // near the R&B songs) and reported as force-sorted.
    const result = sortIntoGroups(all, groups, { overlap: false, focus: "balanced" });
    expect(result.placedByMoodTempo).toEqual([uri("u2")]);
    const fastNoMood = song("f", [], 141, null);
    const placed = sortIntoGroups([...all, fastNoMood], groups, { overlap: false, focus: "balanced" });
    expect(placed.groups[1].songs).toContain(uri("f"));
  });

  test("overlap: a song also joins another group it fits nearly as well", () => {
    // r1 is R&B (fit 1) and has heartbreak only at 0.2: not near enough.
    // A song that's R&B AND heartbreak-heavy joins both.
    const both = song("b", [t("r&b")], 70, { heartbreak: 1 });
    const off = sortIntoGroups([...all, both], groups, { overlap: false, focus: "balanced" });
    const on = sortIntoGroups([...all, both], groups, { overlap: true, focus: "balanced" });
    expect(off.groups.filter((g) => g.songs.includes(uri("b")))).toHaveLength(1);
    expect(on.groups.filter((g) => g.songs.includes(uri("b"))).map((g) => g.name)).toEqual(["R&B", "Sad"]);
    expect(on.groups[2].songs).not.toContain(uri("r1"));
  });

  test("a tie goes to the group higher in the list", () => {
    const twins = [group("a", ["jazz"], [], "A"), group("b", ["jazz"], [], "B")];
    const result = sortIntoGroups([song("j", [t("jazz")], 100, null)], twins, { overlap: false, focus: "balanced" });
    expect(result.groups.map((g) => g.songs.length)).toEqual([1, 0]);
  });

  test("the same name twice gets a number, so playlist names differ", () => {
    const result = sortIntoGroups(all, [group("a", ["r&b"], [], "Mine"), group("b", ["indie"], [], "Mine")], {
      overlap: false,
      focus: "balanced",
    });
    expect(result.groups.map((g) => g.name)).toEqual(["Mine", "Mine 2"]);
  });

  test("same songs in any order give the same groups", () => {
    const a = sortIntoGroups(all, groups, { overlap: true, focus: "genre" });
    const b = sortIntoGroups([...all].reverse(), groups, { overlap: true, focus: "genre" });
    expect(b.groups.map((g) => g.songs)).toEqual(a.groups.map((g) => g.songs));
  });
});
