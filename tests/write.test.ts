// Unit tests for the ONLY module that writes to Spotify, using a FAKE Spotify.
// No real account is touched. Run with: npm test

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  addSongToPlaylist,
  addToNewPlaylistForTests,
  PrismWriteError,
  assertCreatedThisSession,
  createPrismPlaylist,
  resetSessionForTests,
  WriteGuardError,
  type WriteApi,
} from "../src/spotify/write";

const song = (n: number) => `spotify:track:song${n}`;

// A fake Spotify that records every call.
function fakeSpotify(newUri: string | null = "spotify:playlist:NEW") {
  const api: WriteApi = {
    createPlaylist: vi.fn(async () => newUri),
    addToPlaylist: vi.fn(async () => {}),
  };
  return api;
}

beforeEach(() => resetSessionForTests());

describe("createPrismPlaylist", () => {
  test("creates ONE playlist and adds the songs to it, in order", async () => {
    const api = fakeSpotify();
    const uri = await createPrismPlaylist("Prism · Often", [song(1), song(2), song(3)], api);
    expect(uri).toBe("spotify:playlist:NEW");
    expect(api.createPlaylist).toHaveBeenCalledTimes(1);
    expect(api.createPlaylist).toHaveBeenCalledWith("Prism · Often");
    expect(api.addToPlaylist).toHaveBeenCalledWith("spotify:playlist:NEW", [song(1), song(2), song(3)]);
  });

  test("every add goes to the NEW playlist, nothing else", async () => {
    const api = fakeSpotify();
    await createPrismPlaylist("x", Array.from({ length: 250 }, (_, i) => song(i)), api);
    const targets = vi.mocked(api.addToPlaylist).mock.calls.map(([target]) => target);
    expect(new Set(targets)).toEqual(new Set(["spotify:playlist:NEW"]));
  });

  test("adds in batches of 100, keeping the order", async () => {
    const api = fakeSpotify();
    const songs = Array.from({ length: 250 }, (_, i) => song(i));
    await createPrismPlaylist("x", songs, api);
    const batches = vi.mocked(api.addToPlaylist).mock.calls.map(([, uris]) => uris);
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(songs);
  });

  test("removes duplicate songs (first copy keeps its place)", async () => {
    const api = fakeSpotify();
    await createPrismPlaylist("x", [song(1), song(2), song(1)], api);
    expect(api.addToPlaylist).toHaveBeenCalledWith("spotify:playlist:NEW", [song(1), song(2)]);
  });

  test("trims the name", async () => {
    const api = fakeSpotify();
    await createPrismPlaylist("  My vibe  ", [song(1)], api);
    expect(api.createPlaylist).toHaveBeenCalledWith("My vibe");
  });

  test.each([
    ["an empty name", "   ", [song(1)], "needs a name"],
    ["no songs", "x", [], "no songs"],
    ["something that isn't a song", "x", ["spotify:episode:abc"], "Only Spotify songs"],
  ])("refuses %s BEFORE creating anything", async (_label, name, songs, message) => {
    const api = fakeSpotify();
    await expect(createPrismPlaylist(name, songs, api)).rejects.toThrow(message);
    expect(api.createPlaylist).not.toHaveBeenCalled();
    expect(api.addToPlaylist).not.toHaveBeenCalled();
  });

  test("if Spotify doesn't create the playlist, nothing is added anywhere", async () => {
    const api = fakeSpotify(null);
    await expect(createPrismPlaylist("x", [song(1)], api)).rejects.toThrow("didn't create");
    expect(api.addToPlaylist).not.toHaveBeenCalled();
  });

  test("if adding fails AFTER creating, the error says so honestly", async () => {
    const api = fakeSpotify();
    vi.mocked(api.addToPlaylist).mockRejectedValueOnce(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createPrismPlaylist("My vibe", [song(1)], api)).rejects.toThrow(
      'The new playlist "My vibe" was created, but adding the songs failed'
    );
  });

  test("a strange answer from Spotify (not a playlist URI) is treated as a failure", async () => {
    const api = fakeSpotify("spotify:collection:tracks");
    await expect(createPrismPlaylist("x", [song(1)], api)).rejects.toThrow("didn't create");
    expect(api.addToPlaylist).not.toHaveBeenCalled();
  });
});

describe("the guard: only playlists created in this session", () => {
  test.each([
    ["Liked Songs", "spotify:collection:tracks"],
    ["an existing playlist", "spotify:playlist:TestPlaylistId00000003"],
  ])("refuses to add to %s", async (_label, target) => {
    const api = fakeSpotify();
    await expect(addToNewPlaylistForTests(target, [song(1)], api)).rejects.toThrow(WriteGuardError);
    expect(api.addToPlaylist).not.toHaveBeenCalled();
  });

  test("a playlist created earlier IS allowed; others still aren't", async () => {
    const api = fakeSpotify();
    const uri = await createPrismPlaylist("x", [song(1)], api);
    expect(() => assertCreatedThisSession(uri)).not.toThrow();
    expect(() => assertCreatedThisSession("spotify:playlist:OTHER")).toThrow(WriteGuardError);
  });
});

describe("addSongToPlaylist (Add with Prism)", () => {
  const target = { uri: "spotify:playlist:MINE", name: "Mine", canAdd: true, hasSong: false };

  test("adds exactly one song to that playlist", async () => {
    const api = fakeSpotify();
    await addSongToPlaylist(target, song(1), api);
    expect(api.addToPlaylist).toHaveBeenCalledTimes(1);
    expect(api.addToPlaylist).toHaveBeenCalledWith("spotify:playlist:MINE", [song(1)]);
    expect(api.createPlaylist).not.toHaveBeenCalled();
  });

  test.each([
    [{ ...target, canAdd: false }, song(1)],
    [{ ...target, hasSong: true }, song(1)],
    [{ ...target, uri: "spotify:collection:tracks" }, song(1)],
    [target, "spotify:episode:abc"],
  ])("refuses %o without calling Spotify", async (t, uri) => {
    const api = fakeSpotify();
    await expect(addSongToPlaylist(t, uri, api)).rejects.toBeInstanceOf(PrismWriteError);
    expect(api.addToPlaylist).not.toHaveBeenCalled();
  });

  test("a Spotify failure becomes a friendly error", async () => {
    const api = fakeSpotify();
    vi.mocked(api.addToPlaylist).mockRejectedValueOnce(new Error("boom"));
    await expect(addSongToPlaylist(target, song(1), api)).rejects.toThrow(/didn't add/);
  });
});
