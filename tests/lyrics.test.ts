// Tests for reading lyrics, with a FAKE Spicetify.CosmosAsync (no network).
// The "lyrics" are made-up lines, never real song lyrics.

import { afterEach, describe, expect, test, vi } from "vitest";
import { getLyricsMood, LyricsError, pausingLyricsMood } from "../src/spotify/lyrics";

const SAD_LINES = ["I cry alone", "tears and goodbye", "so lonely, so lost", "you left me broken"];
const answer = (language = "en", lines = SAD_LINES) => ({ lyrics: { language, lines: lines.map((words) => ({ words })) } });

// Installs a fake Spotify whose lyrics request returns (or throws) what we say.
function fakeSpotify(get: () => Promise<any>) {
  const spy = vi.fn(get);
  (globalThis as any).Spicetify = { CosmosAsync: { get: spy } };
  return spy;
}
afterEach(() => delete (globalThis as any).Spicetify);

describe("getLyricsMood", () => {
  test("lyrics -> mood profile; asks for the right song", async () => {
    const get = fakeSpotify(async () => answer());
    expect(await getLyricsMood("spotify:track:abc")).toEqual({ heartbreak: 1 });
    expect(get.mock.calls[0][0]).toContain("/color-lyrics/v2/track/abc?");
  });

  test("non-English lyrics -> null", async () => {
    fakeSpotify(async () => answer("ko"));
    expect(await getLyricsMood("spotify:track:abc")).toBeNull();
  });

  test("404 RETURNED as an answer = no lyrics -> null", async () => {
    fakeSpotify(async () => ({ code: 404, error: "", message: "Failed to fetch" }));
    expect(await getLyricsMood("spotify:track:abc")).toBeNull();
  });

  test("404 THROWN = no lyrics -> null", async () => {
    fakeSpotify(async () => Promise.reject({ code: 404 }));
    expect(await getLyricsMood("spotify:track:abc")).toBeNull();
  });

  test.each([
    ["returned 429", async () => ({ code: 429, message: "Too many requests" })],
    ["thrown 500", async () => Promise.reject({ code: 500 })],
    ["empty answer", async () => ({})],
  ])("other failures (%s) THROW, so they're never cached as 'no lyrics'", async (_label, get) => {
    fakeSpotify(get as () => Promise<any>);
    await expect(getLyricsMood("spotify:track:abc")).rejects.toBeInstanceOf(LyricsError);
  });
});

describe("pausingLyricsMood", () => {
  test("after a 429, pauses: fails at once WITHOUT asking Spotify, then resumes", async () => {
    let time = 0;
    const read = vi.fn(async (uri: string) => {
      if (uri === "busy") throw new LyricsError(429, "too many");
      return { love: 1 };
    });
    const get = pausingLyricsMood(() => time, 60_000, read);

    expect(await get("a")).toEqual({ love: 1 });
    await expect(get("busy")).rejects.toBeInstanceOf(LyricsError);
    time = 30_000; // still paused
    await expect(get("b")).rejects.toThrow("paused");
    expect(read).toHaveBeenCalledTimes(2); // "b" never reached Spotify
    time = 61_000; // pause over
    expect(await get("b")).toEqual({ love: 1 });
  });

  test("other errors don't pause", async () => {
    const read = vi.fn(async (uri: string) => {
      if (uri === "bad") throw new LyricsError(500, "server");
      return { love: 1 };
    });
    const get = pausingLyricsMood(() => 0, 60_000, read);
    await expect(get("bad")).rejects.toBeInstanceOf(LyricsError);
    expect(await get("a")).toEqual({ love: 1 });
  });
});
