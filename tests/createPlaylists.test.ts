// Unit tests for Organize's "create the playlists" step (13d). Run with: npm test
// No Spotify here: `create` is a fake that records what it was asked to do.

import { describe, expect, test } from "vitest";
import { createAll, planPlaylists, withPrefix, type PlannedPlaylist } from "../src/organize/createPlaylists";
import { buildOrganizeRecord } from "../src/stats/playlistStats";
import type { EditableGroup } from "../src/organize/editGroups";

const groups = (): EditableGroup[] => [
  { id: "g1", name: "Pop", songs: ["spotify:track:a", "spotify:track:b"] },
  { id: "g2", name: "Empty one", songs: [] },
  { id: "g3", name: "Prism · Love", songs: ["spotify:track:c"] },
];

describe("planning", () => {
  test("withPrefix adds 'Prism · ' once, and only when asked", () => {
    expect(withPrefix(" Pop ", true)).toBe("Prism · Pop");
    expect(withPrefix("Prism · Pop", true)).toBe("Prism · Pop");
    expect(withPrefix(" Pop ", false)).toBe("Pop");
  });

  test("one playlist per group with songs; empty groups are skipped and named", () => {
    const { planned, skipped } = planPlaylists(groups(), true);
    expect(planned).toEqual([
      { groupId: "g1", name: "Prism · Pop", songs: ["spotify:track:a", "spotify:track:b"] },
      { groupId: "g3", name: "Prism · Love", songs: ["spotify:track:c"] },
    ]);
    expect(skipped).toEqual(["Empty one"]);
  });

  test("the plan is a copy: changing it doesn't change the groups", () => {
    const source = groups();
    planPlaylists(source, false).planned[0].songs.push("x");
    expect(source[0].songs).toHaveLength(2);
  });
});

describe("createAll", () => {
  const planned: PlannedPlaylist[] = planPlaylists(groups(), true).planned;

  test("creates every playlist in order and reports each step", async () => {
    const made: string[] = [];
    const steps: string[] = [];
    const outcome = await createAll(
      planned,
      async (p) => {
        made.push(p.name);
        return `spotify:playlist:${p.groupId}`;
      },
      (id, status) => steps.push(`${id}:${status}`)
    );
    expect(made).toEqual(["Prism · Pop", "Prism · Love"]);
    expect(steps).toEqual(["g1:creating", "g1:created", "g3:creating", "g3:created"]);
    expect(outcome).toEqual({
      created: [
        { groupId: "g1", name: "Prism · Pop", uri: "spotify:playlist:g1" },
        { groupId: "g3", name: "Prism · Love", uri: "spotify:playlist:g3" },
      ],
      failed: null,
      notTried: [],
    });
  });

  test("stops at the first failure and says what exists and what wasn't tried", async () => {
    const three = [...planned, { groupId: "g4", name: "Prism · Late", songs: ["spotify:track:d"] }];
    const made: string[] = [];
    const outcome = await createAll(three, async (p) => {
      if (p.groupId === "g3") throw new Error("Spotify said no");
      made.push(p.name);
      return `spotify:playlist:${p.groupId}`;
    });
    expect(made).toEqual(["Prism · Pop"]); // g4 never attempted
    expect(outcome.created.map((c) => c.name)).toEqual(["Prism · Pop"]);
    expect(outcome.failed?.name).toBe("Prism · Love");
    expect((outcome.failed?.error as Error).message).toBe("Spotify said no");
    expect(outcome.notTried).toEqual(["Prism · Late"]);
  });
});

describe("buildOrganizeRecord", () => {
  test("has no seed, keeps the labels and source playlists, and counts the songs", () => {
    const record = buildOrganizeRecord({
      uri: "spotify:playlist:new",
      name: " Prism · Pop ",
      createdAt: 1000,
      labels: ["pop", "love"],
      from: ["Night Drive", "Liked Songs"],
      songs: [
        { uri: "a", name: "A", durationMs: 200000, tags: [{ name: "pop", weight: 1, source: "track" }], audio: { bpm: 100, key: "A", mode: "minor", camelot: "8A" }, mood: { love: 1 } },
        { uri: "b", name: "B", durationMs: 100000, tags: [], audio: null, mood: null },
      ],
    });
    expect(record).toMatchObject({
      uri: "spotify:playlist:new",
      name: "Prism · Pop",
      seed: null,
      keptTags: ["pop", "love"],
      songCount: 2,
      tagCounts: [["pop", 1]],
      averageBpm: 100,
      organized: { from: ["Night Drive", "Liked Songs"] },
    });
    expect(record.match).toBeUndefined(); // no seed, so no "how close to the seed"
    expect(record.estimate).toBeUndefined();
  });
});
