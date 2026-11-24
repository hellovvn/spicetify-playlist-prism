// LIBRARY PANEL THEME (developer's picks 2026-11-24, mockup rounds 1-4): with
// a playlist theme on, Spotify's left panel ("Your Library") gets a STILL
// background in the theme's colours, and only the OPEN playlist's row moves:
// it gets a small, moving copy of the theme behind its text.
//   - Northern lights: background "A, top glow" + row "soft veil" (two blurry
//     mint/lavender patches drifting; the first, streaky versions looked wrong).
//   - Starry night: background "C, rising dusk" + twinkling sparkle stars.
//   - Bubble nebula: background "A, top glow" + drifting clouds, rising bubbles.
//
// PURE (no Spotify, no DOM): tests/libraryTheme.test.ts. The page side is
// src/ui/libraryTheme.ts. Class names and keyframes live there.

import type { PlaylistThemeId } from "./playlistTheme";

type Theme = Exclude<PlaylistThemeId, "none">;

export const PASTELS = ["#f6a6c8", "#b9a7ff", "#9fe3d0", "#ffd59e", "#a9d4ff"];

// "Top glow": deep twilight with a soft glow in two theme colours at the top.
const topGlow = (first: string, second: string) =>
  `radial-gradient(120% 45% at 30% 0%, ${first}2e, transparent 70%), ` +
  `radial-gradient(90% 40% at 95% 8%, ${second}24, transparent 70%), ` +
  `linear-gradient(180deg, #1d1640, #141029 60%, #110d22)`;

// The panel's still background (a CSS background value).
export function panelBackground(theme: Theme): string {
  if (theme === "aurora") return topGlow("#8ff7cf", "#f6a6c8");
  if (theme === "nebula") return topGlow("#f6a6c8", "#9fe3d0");
  // stars: "rising dusk", dark at the top, lighter purple at the bottom.
  return (
    "radial-gradient(140% 60% at 50% 110%, #8a6cff33, transparent 60%), " +
    "radial-gradient(80% 35% at 0% 60%, #f6a6c81c, transparent 70%), " +
    "linear-gradient(180deg, #120e26, #1a1338 55%, #2a1d52)"
  );
}

// The selected row's base colour (under its moving parts).
export function rowBackground(theme: Theme): string {
  if (theme === "aurora") return "linear-gradient(180deg, #151236, #1c1742)";
  if (theme === "stars") return "radial-gradient(ellipse at 70% 0%, #4a3290, #2a1d58 80%)";
  return "#2a1a4a";
}

type Random = () => number;

// The selected row's moving parts (HTML). `random` is injectable for tests.
export function rowSkyHtml(theme: Theme, random: Random = Math.random): string {
  const rand = (min: number, max: number) => min + random() * (max - min);
  const timing = (minD: number, maxD: number) => `--d:${rand(minD, maxD).toFixed(1)}s;--l:${(-rand(0, maxD)).toFixed(1)}s`;
  const dots = (count: number) => {
    let html = "";
    for (let i = 0; i < count; i++) {
      const size = rand(1, 2).toFixed(1);
      html += `<span class="prism-lib-dot" style="left:${rand(0, 100).toFixed(1)}%;top:${rand(0, 100).toFixed(1)}%;width:${size}px;height:${size}px;${timing(3, 6)}"></span>`;
    }
    return html;
  };

  if (theme === "aurora") {
    return (
      `<span class="prism-lib-veil" style="left:5%;top:10%;width:60%;height:80%;background:radial-gradient(ellipse,#8ff7cf66,transparent 70%);--d:7s;--l:-2s"></span>` +
      `<span class="prism-lib-veil" style="left:40%;top:0;width:60%;height:90%;background:radial-gradient(ellipse,#b9a7ff55,transparent 70%);--d:9s;--l:-5s"></span>` +
      dots(4)
    );
  }
  if (theme === "stars") {
    let html = "";
    for (let i = 0; i < 7; i++) {
      const size = rand(5, 9).toFixed(1);
      const colour = random() < 0.25 ? PASTELS[Math.floor(random() * PASTELS.length)] : "#fff";
      html += `<span class="prism-lib-star" style="left:${rand(0, 96).toFixed(1)}%;top:${rand(0, 90).toFixed(1)}%;width:${size}px;height:${size}px;background:${colour};filter:drop-shadow(0 0 4px ${colour});${timing(2.5, 5.5)}"></span>`;
    }
    return html + dots(6);
  }
  // nebula
  const clouds: [string, number, number][] = [
    ["#f6a6c8", -5, -40],
    ["#b9a7ff", 45, -30],
    ["#9fe3d0", 75, 10],
  ];
  let html = clouds
    .map(([c, x, y], i) => `<span class="prism-lib-cloud" style="left:${x}%;top:${y}%;background:radial-gradient(ellipse,${c}88,${c}22 50%,transparent 70%);--d:${8 + i * 2}s;--l:${-i * 3}s"></span>`)
    .join("");
  for (let i = 0; i < 6; i++) {
    const c = PASTELS[i % PASTELS.length];
    const size = rand(7, 14).toFixed(0);
    html +=
      `<span class="prism-lib-bubble" style="left:${(8 + i * 15 + rand(-4, 4)).toFixed(1)}%;width:${size}px;height:${size}px;` +
      `background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.75) 0 8%,transparent 12%),radial-gradient(circle,${c}11 55%,${c}99 100%);box-shadow:0 0 8px ${c}66;${timing(3, 5)}"></span>`;
  }
  return html + dots(5);
}
