// Unit tests for building the scan list. Run with: npm test

import { describe, expect, test } from "vitest";
import { mergeTracks, toScanTracks } from "../src/scan/tracks";

// Shaped like Spotify's real PlaylistAPI.getContents / LibraryAPI.getTracks items.
const item = (id: string, name: string, artist: string, extra = {}) => ({
  uri: `spotify:track:${id}`,
  name,
  artists: [{ name: artist }],
  isLocal: false,
  ...extra,
});

describe("toScanTracks", () => {
  test("keeps uri, name and all artist names", () => {
    expect(toScanTracks([{ ...item("a", "WRONG", "Chris Grey"), artists: [{ name: "A" }, { name: "B" }] }])).toEqual([
      { uri: "spotify:track:a", name: "WRONG", artists: ["A", "B"] },
    ]);
  });

  test("skips local files, podcast episodes and broken items", () => {
    const result = toScanTracks([
      item("ok", "Song", "Band"),
      item("local", "My MP3", "Me", { isLocal: true }),
      { uri: "spotify:episode:x", name: "A podcast" },
      { uri: "spotify:local:Me::My+MP3:200", name: "Local URI" },
      { name: "no uri" },
      null,
      { uri: "spotify:track:noname" },
    ]);
    expect(result.map((t) => t.uri)).toEqual(["spotify:track:ok"]);
  });

  test("handles missing input", () => {
    expect(toScanTracks(undefined as any)).toEqual([]);
  });
});

describe("mergeTracks", () => {
  const a = { uri: "spotify:track:a", name: "A", artists: ["X"] };
  const b = { uri: "spotify:track:b", name: "B", artists: ["Y"] };
  const c = { uri: "spotify:track:c", name: "C", artists: ["Z"] };

  test("a song in two playlists is scanned once, first copy kept", () => {
    expect(mergeTracks([[a, b], [b, c], [a]])).toEqual({ tracks: [a, b, c], duplicates: 2 });
  });

  test("no lists -> nothing", () => {
    expect(mergeTracks([])).toEqual({ tracks: [], duplicates: 0 });
  });
});
