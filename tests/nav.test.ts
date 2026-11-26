import { describe, expect, test } from "vitest";
import { isPlaylistUri, pageUrl, parsePageRequest, parseTrackLink } from "../src/nav";

const ID = "4PhsKqMdgMEUSstTDAmMpg";

describe("pageUrl / parsePageRequest", () => {
  test("start request survives the round trip", () => {
    const url = pageUrl({ go: "start", seed: `spotify:track:${ID}` }, "7");
    expect(url.startsWith("/prism?")).toBe(true);
    expect(parsePageRequest(url.split("?")[1])).toEqual({ request: { go: "start", seed: `spotify:track:${ID}` }, requestId: "7" });
  });

  test("stats request survives the round trip", () => {
    const url = pageUrl({ go: "stats", playlist: `spotify:playlist:${ID}` }, "9");
    expect(parsePageRequest(url.split("?")[1])).toEqual({ request: { go: "stats", playlist: `spotify:playlist:${ID}` }, requestId: "9" });
  });

  test("tone request survives the round trip", () => {
    const url = pageUrl({ go: "tone", playlist: `spotify:playlist:${ID}` }, "4");
    expect(parsePageRequest(url.split("?")[1])).toEqual({ request: { go: "tone", playlist: `spotify:playlist:${ID}` }, requestId: "4" });
    expect(parsePageRequest(`go=tone&playlist=spotify:track:${ID}&r=1`)).toBeNull();
  });

  test.each(["settings", "home", "demo-scan", "demo-stats"] as const)("%s request", (go) => {
    expect(parsePageRequest(pageUrl({ go }, "1").split("?")[1])?.request).toEqual({ go });
  });

  test.each([
    ["nothing", ""],
    ["no request id", "go=home"],
    ["unknown request", "go=delete&r=1"],
    ["start without a seed", "go=start&r=1"],
    ["start with a playlist, not a song", "go=start&seed=spotify:playlist:37i9dQZF1DXcBWIGoYBM5M&r=1"],
    ["stats without a playlist", "go=stats&r=1"],
    ["stats for a song, not a playlist", `go=stats&playlist=spotify:track:${ID}&r=1`],
  ])("%s -> null", (_label, search) => {
    expect(parsePageRequest(search)).toBeNull();
  });
});

describe("parseTrackLink", () => {
  test.each([
    [`spotify:track:${ID}`],
    [`https://open.spotify.com/track/${ID}`],
    [`https://open.spotify.com/track/${ID}?si=abc123`],
    [`https://open.spotify.com/intl-de/track/${ID}`],
    [`  https://open.spotify.com/track/${ID}  `],
  ])("%s -> song URI", (text) => {
    expect(parseTrackLink(text)).toBe(`spotify:track:${ID}`);
  });

  test.each([
    ["an album link", `https://open.spotify.com/album/${ID}`],
    ["a playlist URI", `spotify:playlist:${ID}`],
    ["another website", `https://example.com/track/${ID}`],
    ["a too-short ID", "spotify:track:abc"],
    ["plain text", "Often by The Weeknd"],
  ])("%s -> null", (_label, text) => {
    expect(parseTrackLink(text)).toBeNull();
  });
});

describe("isPlaylistUri", () => {
  test("a playlist URI", () => expect(isPlaylistUri(`spotify:playlist:${ID}`)).toBe(true));
  test.each([`spotify:track:${ID}`, "spotify:playlist:short", `spotify:playlist:${ID}:extra`, ""])("%s -> false", (text) => {
    expect(isPlaylistUri(text)).toBe(false);
  });
});

describe("addto requests (Add with Prism)", () => {
  test("round-trips with and without a song", () => {
    const song = "spotify:track:4uLU6hMCjMI75M1A2tKUQC";
    const withSong = new URL(pageUrl({ go: "addto", song }, "1"), "https://x").search;
    expect(parsePageRequest(withSong)?.request).toEqual({ go: "addto", song });
    const without = new URL(pageUrl({ go: "addto" }, "2"), "https://x").search;
    expect(parsePageRequest(without)?.request).toEqual({ go: "addto" });
    expect(parsePageRequest("?go=addto&song=spotify:playlist:x&r=3")).toBeNull();
  });
});
