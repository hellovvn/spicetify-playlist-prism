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
    expect(css.match(/\{/g)).toHaveLength(2); // the purple layer + the rim, each covering every playlist
  });

  test("a duplicate URI makes no difference", () => {
    expect(prismRowCss([A, A])).toBe(prismRowCss([A]));
  });

  test("anything that isn't a playlist URI is ignored (no broken CSS)", () => {
    expect(prismRowCss(['spotify:playlist:bad"] *{', "spotify:track:67tkxIkfGGzwALICOLsGUz"])).toBe("");
  });
});
