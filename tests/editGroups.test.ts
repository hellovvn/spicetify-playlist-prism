// Unit tests for editing Organize's groups (step 13c). Run with: npm test

import { describe, expect, test } from "vitest";
import {
  addSongs,
  editableGroups,
  mergeGroups,
  moveSong,
  removeSong,
  renameGroup,
  songsInNoGroup,
  type EditableGroup,
} from "../src/organize/editGroups";

const start = (): EditableGroup[] => [
  { id: "g1", name: "R&B · Love", songs: ["a", "b", "c"] },
  { id: "g2", name: "Hip Hop · Party", songs: ["d", "e"] },
  { id: "g3", name: "Jazz", songs: ["f"] },
];

describe("editing groups", () => {
  test("editableGroups gives ids and copies the song lists", () => {
    const summary = { tags: [], moods: [], tempo: { slow: 0, mid: 0, fast: 0, averageBpm: null }, keys: [], untagged: 0 };
    const source = [{ name: "A", songs: ["x"], summary }];
    const groups = editableGroups(source);
    expect(groups).toEqual([{ id: "g1", name: "A", songs: ["x"] }]);
    groups[0].songs.push("y");
    expect(source[0].songs).toEqual(["x"]); // the original isn't changed
  });

  test("rename trims, and a blank name keeps the old one", () => {
    expect(renameGroup(start(), "g2", "  Hype  ")[1].name).toBe("Hype");
    expect(renameGroup(start(), "g2", "   ")[1].name).toBe("Hip Hop · Party");
  });

  test("moving a song takes it out of one group and adds it to the other", () => {
    const groups = moveSong(start(), "b", "g1", "g3");
    expect(groups[0].songs).toEqual(["a", "c"]);
    expect(groups[2].songs).toEqual(["f", "b"]);
  });

  test("moving to a group that already has the song (overlap) doesn't duplicate it", () => {
    const overlap = start();
    overlap[2].songs.push("b");
    const groups = moveSong(overlap, "b", "g1", "g3");
    expect(groups[2].songs).toEqual(["f", "b"]);
    expect(groups[0].songs).toEqual(["a", "c"]);
  });

  test("removing a song takes it out of that group only", () => {
    const groups = removeSong(start(), "d", "g2");
    expect(groups[1].songs).toEqual(["e"]);
    expect(groups[0].songs).toEqual(["a", "b", "c"]);
  });

  test("merging joins the songs (each once), keeps the first name, drops the other group", () => {
    const overlap = start();
    overlap[1].songs.push("a");
    const groups = mergeGroups(overlap, "g1", "g2");
    expect(groups.map((g) => g.id)).toEqual(["g1", "g3"]);
    expect(groups[0]).toEqual({ id: "g1", name: "R&B · Love", songs: ["a", "b", "c", "d", "e"] });
  });

  test("merging a group with itself changes nothing", () => {
    expect(mergeGroups(start(), "g1", "g1")).toEqual(start());
  });

  test("edits never change the groups they were given", () => {
    const before = start();
    moveSong(before, "a", "g1", "g2");
    removeSong(before, "a", "g1");
    mergeGroups(before, "g1", "g2");
    renameGroup(before, "g1", "New");
    expect(before).toEqual(start());
  });

  test("songsInNoGroup lists songs that were removed from every group", () => {
    const groups = removeSong(start(), "f", "g3");
    expect(songsInNoGroup(groups, ["a", "b", "c", "d", "e", "f"])).toEqual(["f"]);
  });
  test("addSongs puts left-out songs back into the picked groups, each once", () => {
    const groups = addSongs(start(), [
      { uri: "x", toId: "g3" },
      { uri: "y", toId: "g1" },
      { uri: "x", toId: "g3" }, // same song twice: added once
      { uri: "a", toId: "g1" }, // already there: skipped
      { uri: "z", toId: "nope" }, // no such group: ignored
    ]);
    expect(groups.map((g) => g.songs)).toEqual([["a", "b", "c", "y"], ["d", "e"], ["f", "x"]]);
    expect(start()[0].songs).toEqual(["a", "b", "c"]); // the old groups aren't changed
    const untouched = start();
    expect(addSongs(untouched, [])[1]).toBe(untouched[1]); // groups with nothing added stay the same object
  });
});
