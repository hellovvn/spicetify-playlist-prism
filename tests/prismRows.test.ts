// Unit tests for the sidebar hover CSS for Prism playlists. Run with: npm test

import { describe, expect, test } from "vitest";
import { prismRowCss } from "../src/ui/prismRows";

const A = "spotify:playlist:67tkxIkfGGzwALICOLsGUz";
const B = "spotify:playlist:6k5zro6HdrvUnkFZORNhev";

describe("prismRowCss", () => {
  test("no Prism playlists: no CSS", () => {
    expect(prismRowCss([])).toBe("");
  });

  test("hover rules covering each playlist's sidebar row", () => {
    const css = prismRowCss([A, B]);
    expect(css).toContain(`[role="row"]:has([aria-labelledby^="listrow-title-${A}"]):hover`);
    expect(css).toContain(`[role="row"]:has([aria-labelledby^="listrow-title-${B}"]):hover`);
    // One purple + rays layer and one rim rule, each covering every playlist (no rule per playlist).
    expect(css.split("::after {")).toHaveLength(3); // the glow, plus its "animations off" version
    expect(css).toContain("box-shadow");
  });

  test("the rainbow rays drift, except for people who turn animations off", () => {
    const css = prismRowCss([A]);
    expect(css).toContain("animation: prism-row-rays");
    expect(css).toContain("@keyframes prism-row-rays");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });

  test("a duplicate URI makes no difference", () => {
    expect(prismRowCss([A, A])).toBe(prismRowCss([A]));
  });

  test("anything that isn't a playlist URI is ignored (no broken CSS)", () => {
    expect(prismRowCss(['spotify:playlist:bad"] *{', "spotify:track:67tkxIkfGGzwALICOLsGUz"])).toBe("");
  });
});
