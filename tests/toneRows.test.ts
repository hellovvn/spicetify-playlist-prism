// Unit tests for the pure parts of the Tone view (src/ui/toneView.ts). Run with: npm test

import { describe, expect, test } from "vitest";
import { playlistUriFromPath, ringSvg, stripStatus } from "../src/ui/toneView";

describe("playlistUriFromPath", () => {
  test("a playlist page", () => {
    expect(playlistUriFromPath("/playlist/4Gt7ro1pcxWSRED2XPOCLI")).toBe("spotify:playlist:4Gt7ro1pcxWSRED2XPOCLI");
  });
  test("anything else", () => {
    expect(playlistUriFromPath("/album/4Gt7ro1pcxWSRED2XPOCLI")).toBeNull();
    expect(playlistUriFromPath("/playlist/short")).toBeNull();
    expect(playlistUriFromPath(undefined)).toBeNull();
  });
});

describe("ringSvg", () => {
  test("shows the rounded %", () => {
    expect(ringSvg(0.876)).toContain(">88</text>");
  });
  test("partial = the same ring at half strength", () => {
    expect(ringSvg(0.64, true)).toContain('opacity="0.5"');
    expect(ringSvg(0.64)).not.toContain("opacity");
  });
  test("under 50% = grey ring and grey %", () => {
    expect(ringSvg(0.3)).toContain("rgba(255,255,255,0.38)");
    expect(ringSvg(0.3)).not.toContain('stroke="url(#prism-tone-fill)"');
    expect(ringSvg(0.6)).toContain('stroke="url(#prism-tone-fill)"');
  });
  test("unknown = dashed ring with a dash", () => {
    const svg = ringSvg(null);
    expect(svg).toContain("stroke-dasharray=\"3 4\"");
    expect(svg).toContain("–");
  });
});

describe("stripStatus", () => {
  test("off = nothing", () => {
    expect(stripStatus(false, { loading: { done: 1, total: 2 }, failed: false })).toBe("");
  });
  test("loading shows progress", () => {
    expect(stripStatus(true, { loading: { done: 12, total: 39 }, failed: false })).toBe("Scoring songs: 12 of 39…");
    expect(stripStatus(true, { loading: { done: 0, total: 0 }, failed: false })).toBe("Scoring songs…");
  });
  test("loaded = nothing (the rings say it all)", () => {
    expect(stripStatus(true, { loading: null, failed: false })).toBe("");
  });
  test("failed", () => {
    expect(stripStatus(true, { loading: null, failed: true })).toBe("Couldn't score the songs");
  });
});
