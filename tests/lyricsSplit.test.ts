import { describe, expect, it } from "vitest";
import { listPathFor, parseLyricsLayout } from "../src/ui/lyricsSplit";

describe("parseLyricsLayout", () => {
  it("defaults to side by side", () => {
    expect(parseLyricsLayout(null)).toBe("split");
    expect(parseLyricsLayout("split")).toBe("split");
    expect(parseLyricsLayout("odd")).toBe("split");
  });
  it("only 'full' means full", () => {
    expect(parseLyricsLayout("full")).toBe("full");
  });
});

describe("listPathFor", () => {
  it("finds playlist and album pages", () => {
    expect(listPathFor("spotify:playlist:abc")).toBe("/playlist/abc");
    expect(listPathFor("spotify:album:xyz")).toBe("/album/xyz");
  });
  it("sends Liked Songs to its page", () => {
    expect(listPathFor("spotify:user:me:collection")).toBe("/collection/tracks");
  });
  it("gives null for things that aren't lists", () => {
    expect(listPathFor(undefined)).toBeNull();
    expect(listPathFor("")).toBeNull();
    expect(listPathFor("spotify:artist:a")).toBeNull();
    expect(listPathFor("spotify:station:track:a")).toBeNull();
    expect(listPathFor("spotify:playlist:")).toBeNull();
  });
});
