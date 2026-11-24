// Unit tests for the library panel theme (pure parts). Run with: npm test

import { describe, expect, test } from "vitest";
import { isLikedSongsPage, panelBackground, rowBackground, rowSkyHtml } from "../src/theme/libraryTheme";

// A fixed "random" so the HTML is the same every run.
const fixed = () => 0.5;

describe("panelBackground", () => {
  test("northern lights and bubble nebula use the top glow", () => {
    expect(panelBackground("aurora")).toContain("at 30% 0%, #8ff7cf");
    expect(panelBackground("nebula")).toContain("at 30% 0%, #f6a6c8");
  });
  test("starry night uses the rising dusk", () => {
    expect(panelBackground("stars")).toContain("at 50% 110%");
    expect(panelBackground("stars")).toContain("#2a1d52");
  });
});

describe("isLikedSongsPage", () => {
  test("Liked Songs page", () => {
    expect(isLikedSongsPage("/collection/tracks")).toBe(true);
    expect(isLikedSongsPage("/collection/tracks/")).toBe(true);
  });
  test("other pages", () => {
    expect(isLikedSongsPage("/playlist/4Gt7ro1pcxWSRED2XPOCLI")).toBe(false);
    expect(isLikedSongsPage("/collection/albums")).toBe(false);
    expect(isLikedSongsPage(undefined)).toBe(false);
  });
});

describe("rowSkyHtml", () => {
  test("northern lights = two soft veils, no streaks", () => {
    const html = rowSkyHtml("aurora", fixed);
    expect(html.match(/prism-lib-veil/g)).toHaveLength(2);
    expect(html).not.toContain("ray");
  });
  test("starry night = sparkle stars", () => {
    expect(rowSkyHtml("stars", fixed).match(/prism-lib-star/g)).toHaveLength(7);
  });
  test("bubble nebula = clouds and bubbles", () => {
    const html = rowSkyHtml("nebula", fixed);
    expect(html.match(/prism-lib-cloud/g)).toHaveLength(3);
    expect(html.match(/prism-lib-bubble/g)).toHaveLength(6);
  });
  test("same random numbers = same HTML", () => {
    expect(rowSkyHtml("stars", fixed)).toBe(rowSkyHtml("stars", fixed));
  });
  test("every theme has a row colour", () => {
    for (const t of ["aurora", "stars", "nebula"] as const) expect(rowBackground(t)).toBeTruthy();
  });
});
