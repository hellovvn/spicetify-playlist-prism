// Unit tests for Merge playlists: the dedupe, the suggested name, and the
// guarded "[merged] " rename (with a FAKE Spotify). Run with: npm test

import { beforeEach, describe, expect, test, vi } from "vitest";
import { defaultMergeName, mergeSongs } from "../src/merge/mergePlaylists";
import { createMergedPlaylist, mergedName, resetSessionForTests, type WriteApi } from "../src/spotify/write";
import { flattenRootlist } from "../src/sources/sources";
import type { ScanTrack } from "../src/scan/tracks";

const t = (id: string, name: string, artist = "SZA"): ScanTrack => ({ uri: `spotify:track:${id}`, name, artists: [artist] });

describe("mergeSongs", () => {
  test("joins playlists in the order picked and drops repeats of the same URI", () => {
    const plan = mergeSongs([
      [t("a", "Snooze"), t("b", "Kill Bill")],
      [t("b", "Kill Bill"), t("c", "Good Days")],
    ]);
    expect(plan.tracks.map((s) => s.uri)).toEqual(["spotify:track:a", "spotify:track:b", "spotify:track:c"]);
    expect(plan.total).toBe(4);
    expect(plan.duplicates).toBe(1);
  });

  test("the same song from another album or version counts as a duplicate", () => {
    const plan = mergeSongs([[t("single", "Snooze")], [t("album", "Snooze (Acoustic)"), t("other", "Snooze", "Someone Else")]]);
    expect(plan.tracks.map((s) => s.uri)).toEqual(["spotify:track:single", "spotify:track:other"]);
    expect(plan.duplicates).toBe(1);
  });

  test("repeats inside ONE playlist are dropped too", () => {
    expect(mergeSongs([[t("a", "Snooze"), t("a", "Snooze")]]).tracks).toHaveLength(1);
  });

  test("empty input", () => {
    expect(mergeSongs([])).toEqual({ tracks: [], total: 0, duplicates: 0, dropped: [] });
  });

  test("says which copy was left out and which was kept, with their playlists", () => {
    const plan = mergeSongs([[t("single", "Snooze"), t("x", "Kill Bill")], [t("album", "Snooze (Acoustic)"), t("x", "Kill Bill")]]);
    expect(plan.dropped.map((d) => [d.track.uri, d.from, d.kept.uri, d.keptFrom])).toEqual([
      ["spotify:track:album", 1, "spotify:track:single", 0],
      ["spotify:track:x", 1, "spotify:track:x", 0],
    ]);
  });
});

describe("defaultMergeName", () => {
  test("joins up to three names, shortens longer lists", () => {
    expect(defaultMergeName(["Dark Romance", "Late night"])).toBe("Dark Romance + Late night");
    expect(defaultMergeName(["A", "B", "C"])).toBe("A + B + C");
    expect(defaultMergeName(["A", "B", "C", "D", "E"])).toBe("A + B + 3 more");
  });
});

describe("mergedName", () => {
  test("adds the tag once", () => {
    expect(mergedName("Gym")).toBe("[merged] Gym");
    expect(mergedName("[merged] Gym")).toBe("[merged] Gym");
  });
});

describe("flattenRootlist canRename", () => {
  test("your own playlists can be renamed, followed ones can't", () => {
    const flat = flattenRootlist([
      // Real shape: Spotify's rootlist says canEditMetadata false even for your own.
      { type: "playlist", uri: "spotify:playlist:mine", name: "Mine", totalLength: 3, isOwnedBySelf: true, canEditMetadata: false },
      { type: "playlist", uri: "spotify:playlist:theirs", name: "Theirs", totalLength: 3, isOwnedBySelf: false, canEditMetadata: false },
    ]);
    expect(flat.map((s) => s.canRename)).toEqual([true, false]);
  });
});

describe("createMergedPlaylist", () => {
  beforeEach(() => resetSessionForTests());

  function fakeSpotify(renameFails: string[] = []) {
    const api: WriteApi = {
      createPlaylist: vi.fn(async () => "spotify:playlist:NEW"),
      addToPlaylist: vi.fn(async () => {}),
      renamePlaylist: vi.fn(async (uri: string) => {
        if (renameFails.includes(uri)) throw new Error("nope");
      }),
    };
    return api;
  }
  const songs = ["spotify:track:1", "spotify:track:2"];
  const sources = [
    { uri: "spotify:playlist:A", name: "Dark Romance", canRename: true },
    { uri: "spotify:playlist:B", name: "Followed one", canRename: false },
    { uri: "spotify:collection:tracks", name: "Liked Songs", canRename: false },
    { uri: "spotify:playlist:C", name: "[merged] Old", canRename: true },
  ];

  test("switch off: creates the playlist and renames nothing", async () => {
    const api = fakeSpotify();
    const result = await createMergedPlaylist("Mix", songs, sources, false, api);
    expect(result.uri).toBe("spotify:playlist:NEW");
    expect(api.addToPlaylist).toHaveBeenCalledWith("spotify:playlist:NEW", songs);
    expect(api.renamePlaylist).not.toHaveBeenCalled();
  });

  test("switch on: only the user's own playlists get the tag, once, AFTER the songs were added", async () => {
    const api = fakeSpotify();
    const result = await createMergedPlaylist("Mix", songs, sources, true, api);
    expect(vi.mocked(api.renamePlaylist!).mock.calls).toEqual([["spotify:playlist:A", "[merged] Dark Romance"]]);
    const addOrder = vi.mocked(api.addToPlaylist).mock.invocationCallOrder[0];
    const renameOrder = vi.mocked(api.renamePlaylist!).mock.invocationCallOrder[0];
    expect(renameOrder).toBeGreaterThan(addOrder);
    expect(result.renamed).toEqual(["Dark Romance"]);
    expect(result.notRenamed.map((n) => n.name)).toEqual(["Followed one", "Liked Songs", "[merged] Old"]);
  });

  test("a failed rename keeps the merged playlist and is reported", async () => {
    const api = fakeSpotify(["spotify:playlist:A"]);
    const result = await createMergedPlaylist("Mix", songs, sources.slice(0, 1), true, api);
    expect(result.uri).toBe("spotify:playlist:NEW");
    expect(result.notRenamed).toEqual([{ name: "Dark Romance", reason: "Spotify refused the rename" }]);
  });

  test("if creating fails, nothing is renamed", async () => {
    const api = fakeSpotify();
    vi.mocked(api.createPlaylist).mockResolvedValue(null);
    await expect(createMergedPlaylist("Mix", songs, sources, true, api)).rejects.toThrow();
    expect(api.renamePlaylist).not.toHaveBeenCalled();
  });
});
