// Unit tests for chip on/off logic. Run with: npm test

import { describe, expect, test } from "vitest";
import { canContinue, keptTags, seedStatus, splitBySource, toggleTag } from "../src/ui/tagSelection";
import type { SourcedTag } from "../src/tags/combineTags";

// Real tags from testing: "Базовый минимум" (song tags + artist tags).
const tags: SourcedTag[] = [
  { name: "nanaetoiles", weight: 1, source: "track" },
  { name: "russian pop", weight: 1, source: "track" },
  { name: "ambient", weight: 0.5, source: "artist" },
  { name: "idm", weight: 0.4, source: "artist" },
];

describe("toggleTag", () => {
  test("switches a tag off, then back on", () => {
    const off = toggleTag([], "nanaetoiles");
    expect(off).toEqual(["nanaetoiles"]);
    expect(toggleTag(off, "nanaetoiles")).toEqual([]);
  });

  test("returns a NEW list and leaves the old one unchanged (React needs this)", () => {
    const before = ["idm"];
    const after = toggleTag(before, "ambient");
    expect(after).not.toBe(before);
    expect(before).toEqual(["idm"]);
  });
});

describe("keptTags", () => {
  test("all tags are on by default", () => {
    expect(keptTags(tags, [])).toEqual(tags);
  });

  test("drops switched-off tags and keeps the original order", () => {
    expect(keptTags(tags, ["nanaetoiles", "idm"]).map((t) => t.name)).toEqual(["russian pop", "ambient"]);
  });

  test("everything switched off -> []", () => {
    expect(keptTags(tags, tags.map((t) => t.name))).toEqual([]);
  });
});

describe("seedStatus: can the user continue?", () => {
  const songTag = tags[0]; // source "track"
  const artistTags = tags.slice(2); // source "artist"

  test.each([
    ["song tags kept -> ok, can continue", tags, tags, "ok", true],
    ["only song tags kept -> ok", tags, [songTag], "ok", true],
    ["mix of song + artist kept -> ok (no warning)", tags, [songTag, ...artistTags], "ok", true],
    ["only artist tags kept -> warned but allowed", tags, artistTags, "artist-only", true],
    ["song had ONLY artist tags to begin with -> warned but allowed", artistTags, artistTags, "artist-only", true],
    ["every tag switched off -> blocked", tags, [], "all-off", false],
    ["no tags at all for song or artist -> blocked", [], [], "no-tags", false],
  ])("%s", (_label, all, kept, kind, allowed) => {
    const status = seedStatus(all as SourcedTag[], kept as SourcedTag[]);
    expect(status.kind).toBe(kind);
    expect(canContinue(status)).toBe(allowed);
  });

  test("blocked and warned states always explain why", () => {
    for (const status of [seedStatus(tags, []), seedStatus([], []), seedStatus(tags, artistTags)]) {
      expect("message" in status && status.message.length > 10).toBe(true);
    }
  });
});

describe("splitBySource", () => {
  test("separates song tags from artist tags", () => {
    const { song, artist } = splitBySource(tags);
    expect(song.map((t) => t.name)).toEqual(["nanaetoiles", "russian pop"]);
    expect(artist.map((t) => t.name)).toEqual(["ambient", "idm"]);
  });
});
