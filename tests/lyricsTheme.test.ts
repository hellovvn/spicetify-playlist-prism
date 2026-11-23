// Unit tests for the lyrics-theme switch and its CSS. Run with: npm test

import { describe, expect, test } from "vitest";
import { isLyricsThemeOn, LYRICS_THEME_CSS } from "../src/ui/lyricsTheme";

describe("isLyricsThemeOn", () => {
  test("on by default (nothing saved yet)", () => {
    expect(isLyricsThemeOn(null)).toBe(true);
  });
  test("saved choices", () => {
    expect(isLyricsThemeOn("on")).toBe(true);
    expect(isLyricsThemeOn("off")).toBe(false);
  });
  test("anything unexpected counts as on (keeps the Prism look)", () => {
    expect(isLyricsThemeOn("")).toBe(true);
    expect(isLyricsThemeOn("OFF ")).toBe(true);
  });
});

describe("LYRICS_THEME_CSS", () => {
  test("only restyles; never hides lyric lines", () => {
    expect(LYRICS_THEME_CSS).not.toMatch(/lyrics-lyricsContent[^{]*\{[^}]*display:\s*none/);
  });
  test("keeps both bars in immersive mode and hides the full screen buttons", () => {
    expect(LYRICS_THEME_CSS).toContain(".Root__cinema-view.Root__cinema-view--controls-hidden");
    expect(LYRICS_THEME_CSS).toContain('[data-testid="now-playing-bar"]');
    expect(LYRICS_THEME_CSS).toContain('[data-testid="fullscreen-mode-button"]');
  });
});
