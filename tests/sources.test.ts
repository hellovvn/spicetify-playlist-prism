// Unit tests for the source (playlist) list. Run with: npm test

import { describe, expect, test } from "vitest";
import {
  allShownSelected,
  clearShown,
  filterSources,
  flattenRootlist,
  selectedSongCount,
  selectShown,
} from "../src/sources/sources";

// Shaped like Spotify's real RootlistAPI.getContents() items (checked in the
// running app), trimmed to the fields we use.
const rootItems = [
  { type: "playlist", uri: "spotify:playlist:dark", name: "Night Drive", totalLength: 25, owner: { displayName: "Alex" } },
  {
    type: "folder",
    name: "Kpop",
    items: [
      { type: "playlist", uri: "spotify:playlist:kpop", name: "Kpop", totalLength: 55, owner: { displayName: "Alex" } },
      { type: "playlist", uri: "spotify:playlist:2am", name: "mood: 3 AM", totalLength: 32, owner: { displayName: "Alex" } },
      { type: "folder", name: "Old", items: [{ type: "playlist", uri: "spotify:playlist:old", name: "2019", totalLength: 3, owner: { username: "someone" } }] },
    ],
  },
  { type: "playlist", uri: "spotify:playlist:empty", name: "My Playlist #18", totalLength: 0, owner: { displayName: "Alex" } },
  { type: "playlist", uri: "spotify:playlist:top", name: "Today’s Top Hits", totalLength: 50, owner: { displayName: "Spotify" } },
];

describe("flattenRootlist", () => {
  const flat = flattenRootlist(rootItems);

  test("lists every non-empty playlist, in Spotify's order", () => {
    expect(flat.map((s) => s.name)).toEqual(["Night Drive", "Kpop", "mood: 3 AM", "2019", "Today’s Top Hits"]);
  });

  test("remembers the folder, including folders inside folders", () => {
    expect(flat.find((s) => s.name === "Night Drive")?.folder).toBeNull();
    expect(flat.find((s) => s.name === "mood: 3 AM")?.folder).toBe("Kpop");
    expect(flat.find((s) => s.name === "2019")?.folder).toBe("Kpop / Old");
  });

  test("skips empty playlists (nothing to scan)", () => {
    expect(flat.some((s) => s.name === "My Playlist #18")).toBe(false);
  });

  test("owner falls back to username when there's no display name", () => {
    expect(flat.find((s) => s.name === "2019")?.owner).toBe("someone");
  });

  test("survives missing or odd data", () => {
    expect(flattenRootlist([])).toEqual([]);
    expect(flattenRootlist(undefined as any)).toEqual([]);
    expect(flattenRootlist([null, { type: "playlist" }, { type: "folder" }])).toEqual([]);
  });
});

describe("filterSources", () => {
  const flat = flattenRootlist(rootItems);

  test("empty search shows everything", () => {
    expect(filterSources(flat, "  ")).toHaveLength(5);
  });

  test("matches names, ignoring capitals", () => {
    expect(filterSources(flat, "NIGHT").map((s) => s.name)).toEqual(["Night Drive"]);
  });

  test("matches folder names too", () => {
    expect(filterSources(flat, "old").map((s) => s.name)).toEqual(["2019"]);
  });
});

describe("select all / clear", () => {
  const flat = flattenRootlist(rootItems);
  const all = flat.map((s) => s.uri);
  const kpopFolder = filterSources(flat, "kpop"); // Kpop, mood: 3 AM, 2019

  test("select all ticks every shown source", () => {
    expect(selectShown(flat, []).sort()).toEqual([...all].sort());
    expect(allShownSelected(flat, selectShown(flat, []))).toBe(true);
  });

  test("select all keeps existing ticks and adds no duplicates", () => {
    const result = selectShown(flat, ["spotify:playlist:dark"]);
    expect(result).toHaveLength(all.length);
    expect(result[0]).toBe("spotify:playlist:dark");
  });

  test("with a search typed, only the matching sources are ticked", () => {
    expect(selectShown(kpopFolder, [])).toEqual(["spotify:playlist:kpop", "spotify:playlist:2am", "spotify:playlist:old"]);
  });

  test("clear unticks only what's shown; hidden ticks stay", () => {
    const ticked = ["spotify:playlist:dark", "spotify:playlist:kpop"];
    expect(clearShown(kpopFolder, ticked)).toEqual(["spotify:playlist:dark"]);
    expect(clearShown(flat, ticked)).toEqual([]);
  });

  test("allShownSelected is false when something shown is unticked, or nothing is shown", () => {
    expect(allShownSelected(flat, ["spotify:playlist:dark"])).toBe(false);
    expect(allShownSelected([], all)).toBe(false);
  });
});

describe("selectedSongCount", () => {
  const flat = flattenRootlist(rootItems);

  test("adds up the songs in the selected sources only", () => {
    expect(selectedSongCount(flat, ["spotify:playlist:dark", "spotify:playlist:2am"])).toBe(57);
    expect(selectedSongCount(flat, [])).toBe(0);
  });
});
