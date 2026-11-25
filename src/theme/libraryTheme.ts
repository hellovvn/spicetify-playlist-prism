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

// The newer themes (2026-11-25): the panel stays STILL in the theme's own
// colours, the open row gets a small moving piece of it (rowSkyHtml).
const NEWER_PANELS: Partial<Record<Theme, string>> = {
  twilight:
    "radial-gradient(120% 45% at 30% 0%, #d06ad02e, transparent 70%), radial-gradient(90% 40% at 95% 8%, #b9a7ff24, transparent 70%), " +
    "linear-gradient(180deg, #21143d, #1a1130 60%, #150e22)",
  afterglow:
    "radial-gradient(140% 50% at 50% 110%, #ffb08a33, transparent 60%), radial-gradient(90% 35% at 90% 70%, #f096aa22, transparent 70%), " +
    "linear-gradient(180deg, #1c1238, #2b1745 55%, #3d1f55)",
  mist:
    "radial-gradient(90% 30% at 20% 10%, #f0a8c433, transparent 70%), radial-gradient(90% 30% at 90% 45%, #9fd8e62b, transparent 70%), " +
    "radial-gradient(90% 30% at 30% 85%, #ffd2a626, transparent 70%), linear-gradient(180deg, #4a4282, #423a76 60%, #3a3368)",
  milkyway:
    "linear-gradient(160deg, transparent 35%, #c8b4ff14 48%, #ffdcf010 52%, transparent 65%), " +
    "linear-gradient(180deg, #070a20, #0b1029 60%, #0f1438)",
  rain:
    "radial-gradient(40% 18% at 20% 90%, #ffd59e1f, transparent 70%), radial-gradient(40% 18% at 80% 75%, #f6a6c81a, transparent 70%), " +
    "linear-gradient(180deg, #141a2e, #1b1f3a 60%, #241f45)",
  blossom:
    "radial-gradient(140% 35% at 50% 0%, #f6a6c833, transparent 70%), radial-gradient(80% 25% at 10% 5%, #ffd0e224, transparent 70%), " +
    "linear-gradient(180deg, #3a2049, #301a3e 60%, #2b1838)",
};
const NEWER_ROWS: Partial<Record<Theme, string>> = {
  twilight: "linear-gradient(100deg, #21143d, #33195a 60%, #4d2270)",
  afterglow: "linear-gradient(180deg, #3d1f55, #6b2f60)",
  mist: "linear-gradient(170deg, #4a4282, #3a3368)",
  milkyway: "linear-gradient(180deg, #0b1029, #161c48)",
  rain: "linear-gradient(180deg, #1f2340, #2d2552)",
  blossom: "linear-gradient(180deg, #6a3462, #4a2650)",
};

// The panel's still background (a CSS background value).
export function panelBackground(theme: Theme): string {
  const newer = NEWER_PANELS[theme];
  if (newer) return newer;
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
  const newer = NEWER_ROWS[theme];
  if (newer) return newer;
  if (theme === "aurora") return "linear-gradient(180deg, #151236, #1c1742)";
  if (theme === "stars") return "radial-gradient(ellipse at 70% 0%, #4a3290, #2a1d58 80%)";
  return "#2a1a4a";
}

// Liked Songs opens at /collection/tracks, but its row in Your Library is a
// separate pinned "spotify:playlist:..." item, so Spotify never marks that row
// as the open one (aria-selected stays false). Spotting its row by its cover
// (always Spotify's own liked-songs picture) works for every account and language.
export const LIKED_SONGS_PATH = "/collection/tracks";
export const LIKED_SONGS_COVER = 'img[src*="/liked-songs/"]';
export function isLikedSongsPage(pathname: string | null | undefined): boolean {
  return (pathname ?? "").replace(/\/+$/, "") === LIKED_SONGS_PATH;
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

  const veil = (left: number, top: number, width: number, colour: string, seconds: number, delay: number) =>
    `<span class="prism-lib-veil" style="left:${left}%;top:${top}%;width:${width}%;height:85%;background:radial-gradient(ellipse,${colour},transparent 70%);--d:${seconds}s;--l:${delay}s"></span>`;
  if (theme === "twilight") {
    // A rainbow light band drifting across, like Prism's page.
    return `<span class="prism-lib-band" style="--d:9s;--l:-3s"></span>` + veil(55, 0, 55, "#d06ad055", 8, -4);
  }
  if (theme === "afterglow") return veil(0, 20, 55, "#ff96aa66", 8, -2) + veil(45, 10, 55, "#ffb08a55", 10, -6) + dots(3);
  if (theme === "mist") return veil(-10, 15, 60, "#f0a8c466", 9, -1) + veil(45, 20, 60, "#9fd8e655", 12, -7);
  if (theme === "milkyway") return `<span class="prism-lib-galaxy"></span>` + dots(10);
  if (theme === "rain") {
    // City lights of different sizes, and drops on the glass like the page
    // (look "D1": lumpy, dark lower edge, glint), one of them now and then
    // sliding down through the row (2026-11-25, developer's request).
    let html = veil(8, 40, 22, "#ffd59e66", 7, -2) + veil(60, 20, 45, "#f6a6c844", 9, -5) + veil(35, 50, 14, "#a9d4ff66", 6, -3);
    const lumpy = () => {
      const v = () => Math.round(rand(38, 62));
      return `border-radius:${v()}% ${v()}% ${v()}% ${v()}% / ${v()}% ${v()}% ${v()}% ${v()}%;rotate:${Math.round(rand(-25, 25))}deg`;
    };
    for (let i = 0; i < 12; i++) {
      const size = rand(3.5, 8.5);
      html += `<span class="prism-lib-wdrop" style="left:${(4 + i * 9.5 + rand(-3, 3)).toFixed(1)}%;top:${rand(8, 82).toFixed(1)}%;width:${size.toFixed(1)}px;height:${(size * rand(0.9, 1.25)).toFixed(1)}px;${lumpy()}"></span>`;
    }
    // The sliding drop and its "wiped path" trail share one timing, so the
    // trail grows behind the drop and then dries up.
    const runnerLeft = rand(20, 80).toFixed(1);
    const runnerTiming = timing(9, 14);
    html +=
      `<span class="prism-lib-wtrail" style="left:${runnerLeft}%;${runnerTiming}"></span>` +
      `<span class="prism-lib-wdrop prism-lib-wrunner" style="left:${runnerLeft}%;width:8px;height:10px;${lumpy()};${runnerTiming}"></span>`;
    return html;
  }
  if (theme === "blossom") {
    let html = "";
    for (let i = 0; i < 6; i++) {
      html += `<span class="prism-lib-petal" style="left:${(4 + i * 16 + rand(-4, 4)).toFixed(1)}%;background:${i % 2 === 0 ? "#f6a6c8" : "#ffd0e2"};${timing(4, 7)}"></span>`;
    }
    return html;
  }
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
