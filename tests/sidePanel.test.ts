// Unit tests for the side-panel stats helpers. Run with: npm test

import { describe, expect, test } from "vitest";
import { artworkUrls, formatClock, formatLength, imageUrl, isPanelStatsOn, panelRecordFor, panelSubtitle, playlistUriFromPath } from "../src/ui/sidePanel";
import { SAMPLE_RECORD } from "../src/stats/playlistStats";

const ID = "4cCN2s73MfFCG1Rti184H2";

describe("isPanelStatsOn", () => {
  test("on unless explicitly off", () => {
    expect(isPanelStatsOn(null)).toBe(true);
    expect(isPanelStatsOn("on")).toBe(true);
    expect(isPanelStatsOn("off")).toBe(false);
  });
});

describe("playlistUriFromPath", () => {
  test("a playlist page", () => {
    expect(playlistUriFromPath(`/playlist/${ID}`)).toBe(`spotify:playlist:${ID}`);
    expect(playlistUriFromPath(`/playlist/${ID}/`)).toBe(`spotify:playlist:${ID}`);
  });
  test("other pages", () => {
    expect(playlistUriFromPath("/")).toBeNull();
    expect(playlistUriFromPath("/playlist-prism")).toBeNull();
    expect(playlistUriFromPath(`/album/${ID}`)).toBeNull();
    expect(playlistUriFromPath("/playlist/short")).toBeNull();
  });
});

describe("panelRecordFor", () => {
  const record = { ...SAMPLE_RECORD, uri: `spotify:playlist:${ID}` };
  const records = { [record.uri]: record };
  test("finds the open playlist's saved record", () => {
    expect(panelRecordFor(`/playlist/${ID}`, records)).toBe(record);
  });
  test("nothing for playlists Prism didn't make, or other pages", () => {
    expect(panelRecordFor("/playlist/0000000000000000000001", records)).toBeNull();
    expect(panelRecordFor("/search", records)).toBeNull();
  });
});

describe("artworkUrls", () => {
  test("a mosaic of four covers, a single image, or nothing", () => {
    expect(artworkUrls("spotify:mosaic:aa01:bb02:cc03:dd04")).toEqual([
      "https://i.scdn.co/image/aa01",
      "https://i.scdn.co/image/bb02",
      "https://i.scdn.co/image/cc03",
      "https://i.scdn.co/image/dd04",
    ]);
    expect(artworkUrls("spotify:image:ab67")).toEqual(["https://i.scdn.co/image/ab67"]);
    expect(artworkUrls(null)).toEqual([]);
  });
});

describe("small formatters", () => {
  test("imageUrl", () => {
    expect(imageUrl("spotify:image:ab67616d00001e02")).toBe("https://i.scdn.co/image/ab67616d00001e02");
    expect(imageUrl("https://i.scdn.co/image/x")).toBe("https://i.scdn.co/image/x");
    expect(imageUrl(undefined)).toBeNull();
    expect(imageUrl("javascript:alert(1)")).toBeNull();
  });
  test("formatClock", () => {
    expect(formatClock(146000)).toBe("2:26");
    expect(formatClock(61000)).toBe("1:01");
  });
  test("formatLength", () => {
    expect(formatLength(5280000)).toBe("1 h 28 min");
    expect(formatLength(840000)).toBe("14 min");
  });
  test("panelSubtitle: made, organized, or neither", () => {
    expect(panelSubtitle({ ...SAMPLE_RECORD, seed: { uri: "s", name: "Grown Up", artists: ["Nic Dean"] } })).toBe('Grown from "Grown Up" · Nic Dean');
    // The source playlists aren't named (they may be deleted later).
    expect(panelSubtitle({ ...SAMPLE_RECORD, seed: null, organized: { from: ["Dark Romance", "sc"] } })).toBe("Organized with Prism");
    expect(panelSubtitle({ ...SAMPLE_RECORD, seed: null, organized: undefined, songCount: 12 })).toBe("12 songs");
  });
});
