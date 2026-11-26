// The SEVEN NEWER PLAYLIST THEMES' skies (developer's picks 2026-11-25, after
// several mockup rounds): Twilight (Prism's own page sky, with its sparkles),
// Afterglow ("S2"), Misty morning ("M8, fogged glass"), Milky Way ("M2", with a
// detailed band and shooting stars), Window rain (city lights + drops on the
// glass), Blossom canopy ("B2", petals at three depths in four shapes) and
//
// Same building blocks as the first three themes in playlistTheme.ts: a
// background plus absolutely placed <span>s (".prism-pl-sky *" is
// position:absolute), animated only with transform/opacity. Things that should
// pop up somewhere new each time (raindrops, petals, shooting stars) move to a random
// spot on "animationiteration" (wireSky), like the sparkle stars do.
//
// Densities scale with the window (`scale`, 1 = the 680px mockup). Reduced
// motion is handled by playlistTheme.ts (".prism-pl-sky *" stops animating).

import type { PlaylistThemeId } from "../theme/playlistTheme";
import { startRainGlass } from "./rainGlass";

export type NewSkyTheme = "twilight" | "afterglow" | "mist" | "milkyway" | "rain" | "blossom";
export const NEW_SKY_THEMES: NewSkyTheme[] = ["twilight", "afterglow", "mist", "milkyway", "rain", "blossom"];
export const isNewSkyTheme = (theme: PlaylistThemeId): theme is NewSkyTheme => (NEW_SKY_THEMES as string[]).includes(theme);

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const f1 = (x: number) => x.toFixed(1);
const timing = (minD: number, maxD: number) => `--d:${f1(rand(minD, maxD))}s;--l:${f1(-rand(0, maxD))}s`;

// A soft round glow (radial gradient), drifting slowly with one of the
// prism-pl-float-* loops.
function glow(left: number, top: number, size: number, colour: string, opacity: number, loop: number, seconds: number): string {
  return (
    `<span class="prism-pl-float prism-pl-float-${loop}" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;` +
    `background:radial-gradient(closest-side,${colour},transparent);opacity:${opacity};--d:${seconds}s"></span>`
  );
}

function dots(count: number, colour = "#fff", top = [0, 100]): string {
  let html = "";
  for (let i = 0; i < count; i++) {
    const size = f1(rand(1, 2.4));
    html += `<span class="prism-pl-dot" style="left:${f1(rand(0, 100))}%;top:${f1(rand(top[0], top[1]))}%;width:${size}px;height:${size}px;background:${colour};${timing(2, 6)}"></span>`;
  }
  return html;
}

// A fluffy cloud: three blurred ovals that glide sideways together.
function cloud(left: number, top: number, width: number, colour: string, seconds: number, delay: number): string {
  const puff = (l: number, t: number, w: number, h: number) =>
    `<span style="left:${l}%;top:${t}%;width:${w}%;height:${h}%;border-radius:50%;background:${colour};filter:blur(${Math.round(width / 22)}px)"></span>`;
  return (
    `<span class="prism-pl-glide" style="left:${left}%;top:${top}%;width:${width}px;height:${Math.round(width * 0.32)}px;--d:${seconds}s;--l:${delay}s">` +
    puff(0, 0, 100, 100) + puff(18, -35, 45, 90) + puff(45, -20, 38, 75) +
    `</span>`
  );
}

export function newSkyHtml(theme: NewSkyTheme, width: number, scale: number): { background: string; html: string } {
  const n = (count: number) => Math.round(count * scale);
  const px = (size: number) => Math.round((size / 680) * width); // mockup px -> this window

  if (theme === "twilight") {
    // Prism's own page sky (styles.ts .prism-cosmos): 3 drifting glows, 3
    // wavy rainbow light bands and the page's twinkling 4-point sparkles
    // (sparkles added back 2026-11-25, developer's request: "same as the homepage").
    let sparkles = "";
    for (let i = 0; i < n(14); i++) {
      const size = Math.round(rand(11, 22));
      sparkles += `<span class="prism-pl-tw" style="left:${f1(rand(2, 96))}%;top:${f1(rand(3, 94))}%;width:${size}px;height:${size}px;animation-duration:${f1(rand(4.6, 8.2))}s;animation-delay:${f1(-rand(0, 8))}s"></span>`;
    }
    return {
      background: "linear-gradient(100deg, #150e22 0%, #21143d 32%, #33195a 62%, #4d2270 85%, #6e2f7e 100%)",
      html:
        glow(95, 5, px(520), "#d06ad0", 0.24, 1, 40) +
        glow(5, 100, px(600), "#6a3fc0", 0.5, 2, 50) +
        glow(90, 105, px(500), "#8a3fb8", 0.4, 3, 46) +
        `<span class="prism-pl-wave prism-pl-wave-1"></span><span class="prism-pl-wave prism-pl-wave-2"></span><span class="prism-pl-wave prism-pl-wave-3"></span>` +
        sparkles,
    };
  }

  if (theme === "afterglow") {
    // "S2": the sun has just set; cloud streaks lit pink from below.
    const clouds = [
      cloud(-5, 46, px(130), "rgba(255,150,170,.5)", 60, 0),
      cloud(50, 34, px(170), "rgba(240,130,170,.42)", 75, -20),
      cloud(18, 60, px(120), "rgba(255,180,150,.45)", 55, -10),
      cloud(70, 55, px(110), "rgba(255,165,160,.4)", 65, -35),
    ].join("");
    return {
      background: "linear-gradient(180deg, #1c1238 0%, #331a4d 40%, #592a5c 70%, #7a3a5e 88%, #8c4660 100%)",
      html:
        `<span class="prism-pl-breathe" style="left:-20%;right:-20%;bottom:-38%;height:55%;border-radius:50%;background:radial-gradient(closest-side,#ffb08a,transparent);opacity:.32;--d:10s"></span>` +
        dots(n(14), "#ffe6f0", [0, 45]) +
        clouds,
    };
  }

  if (theme === "mist") {
    // "M8, fogged glass" (developer's pick 2026-11-25, replacing "D2"): soft
    // pastel glows (pink, sky, peach, lavender, mint) drifting slowly behind a
    // misted-up window, each also slowly brightening and dimming.
    const GLOWS: [string, number][] = [["#f0a8c4", 0.75], ["#9fd8e6", 0.62], ["#ffd2a6", 0.55], ["#c3a8f0", 0.6], ["#a8e6cf", 0.45], ["#f0a8c4", 0.6]];
    let html = "";
    GLOWS.forEach(([colour, opacity], i) => {
      const size = px(rand(320, 520));
      html +=
        `<span class="prism-pl-fogglow prism-pl-float-${(i % 3) + 1}" style="left:${f1(rand(-10, 100))}%;top:${f1(rand(-10, 100))}%;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;` +
        `background:radial-gradient(closest-side,${colour},transparent);--o:${opacity};--d:${Math.round(rand(24, 40))}s;--b:${f1(rand(9, 16))}s;--l:${f1(-rand(0, 16))}s"></span>`;
    });
    html += `<span style="inset:0;background:rgba(220,210,240,.12)"></span>`;
    return { background: "linear-gradient(170deg, #4a4282 0%, #423a76 55%, #3a3368 100%)", html };
  }

  if (theme === "milkyway") {
    // "M2": a galaxy band across a deep blue night. More detail (2026-11-25,
    // developer's request): a wide soft glow, a warm bright core, pink and blue
    // wisps, dark dust lanes along it, and dense small stars. Everything sits
    // in one tilted strip, positioned in % along it.
    const bandHeight = px(240);
    let band =
      `<span class="prism-pl-breathe" style="left:0;width:100%;top:20%;height:60%;background:radial-gradient(ellipse at center,rgba(190,175,255,.38),rgba(150,135,225,.16) 45%,transparent 72%);filter:blur(${px(12)}px);--d:12s"></span>` +
      `<span style="left:30%;width:40%;top:30%;height:40%;background:radial-gradient(ellipse at center,rgba(255,225,200,.42),rgba(255,200,220,.16) 50%,transparent 75%);filter:blur(${px(10)}px)"></span>`;
    const WISPS = ["rgba(255,170,215,.26)", "rgba(150,200,255,.24)", "rgba(220,190,255,.26)", "rgba(255,210,190,.2)"];
    for (let i = 0; i < 9; i++) {
      const w = rand(10, 22);
      band += `<span style="left:${f1(rand(0, 95 - w))}%;width:${f1(w)}%;top:${f1(rand(28, 50))}%;height:${f1(rand(18, 32))}%;border-radius:50%;background:radial-gradient(ellipse,${pick(WISPS)},transparent 70%);filter:blur(${px(8)}px)"></span>`;
    }
    for (let i = 0; i < 7; i++) {
      // Dust lanes: dark, thin, slightly wavy streaks along the middle.
      const w = rand(8, 20);
      band += `<span style="left:${f1(rand(5, 95 - w))}%;width:${f1(w)}%;top:${f1(rand(42, 54))}%;height:${f1(rand(4, 9))}%;border-radius:50%;background:rgba(7,10,32,.55);filter:blur(${px(5)}px);transform:rotate(${f1(rand(-6, 6))}deg)"></span>`;
    }
    for (let i = 0; i < n(110); i++) {
      // Dense small stars, most of them near the middle of the band.
      const spread = (Math.random() + Math.random() + Math.random()) / 3; // bunched in the middle
      const size = f1(rand(0.6, 1.6));
      band += `<span style="left:${f1(rand(0, 100))}%;top:${f1(18 + spread * 64)}%;width:${size}px;height:${size}px;border-radius:50%;background:${Math.random() < 0.15 ? "#ffe6c8" : "#fff"};opacity:${f1(rand(0.35, 0.95))}"></span>`;
    }
    for (let i = 0; i < n(6); i++) {
      // A few brighter stars with a glow.
      const size = f1(rand(2, 3));
      band += `<span class="prism-pl-dot" style="left:${f1(rand(5, 95))}%;top:${f1(rand(30, 70))}%;width:${size}px;height:${size}px;box-shadow:0 0 6px 2px rgba(220,215,255,.6);${timing(3, 6)}"></span>`;
    }
    return {
      background: "linear-gradient(180deg, #070a20 0%, #0f1438 100%)",
      html:
        dots(n(60)) +
        `<span style="left:-30%;width:160%;top:calc(50% - ${bandHeight / 2}px);height:${bandHeight}px;transform:rotate(-24deg)">${band}</span>` +
        shootingStars(3, px), // ~one every 5 s somewhere, all the same way
    };
  }

  if (theme === "rain") {
    // "R1": a rainy night behind a window (reworked 2026-11-25 after the
    // developer's reference video "Raindrops on Window Loop", but calmer):
    // out-of-focus city lights (a few small ones, many big ones of every size,
    // each now and then dimming) behind glass with lumpy drops that land,
    // merge and slide from drop to drop, leaving trails that dry up
    // (a small simulation, src/ui/rainGlass.ts).
    const LIGHTS = ["#ffd59e", "#ffb37a", "#fff1d6", "#f6a6c8", "#a9d4ff", "#ff8f8f", "#9fe3d0"];
    const light = (size: number, top: number, opacity: number) =>
      `<span class="prism-pl-citylight" style="left:${f1(rand(0, 100))}%;top:${f1(top)}%;width:${size}px;height:${size}px;margin:${-size / 2}px;background:radial-gradient(closest-side,${pick(LIGHTS)},transparent);--o:${f1(opacity)};--d:${f1(rand(9, 22))}s;--l:${f1(-rand(0, 22))}s"></span>`;
    let html = "";
    for (let i = 0; i < n(8); i++) html += light(px(rand(10, 20)), rand(55, 98), rand(0.35, 0.6));
    for (let i = 0; i < n(12); i++) {
      const size = px(rand(40, 240));
      html += light(size, rand(20, 100), size > px(150) ? rand(0.1, 0.18) : rand(0.16, 0.3));
    }
    // The glass: drops landing, merging and sliding, with fading trails
    // (src/ui/rainGlass.ts, started by wireSky).
    html += `<canvas class="prism-pl-glass" style="inset:0;width:100%;height:100%"></canvas>`;
    return { background: "linear-gradient(180deg, #141a2e 0%, #1f2340 60%, #2d2552 100%)", html };
  }

  // blossom (the last one)
  {
    // "B2": a canopy of blossoms along the top, petals drifting down from it.
    let html = "";
    // Blurred, dark branch shadows reaching in from the top corners, behind
    // the blossoms, gently swaying (2026-11-25, developer's request).
    html +=
      `<span class="prism-pl-branches" style="left:0;top:0;width:100%;height:${px(200)}px;filter:blur(${px(3)}px)">` +
      `<svg viewBox="0 0 680 200" preserveAspectRatio="none" style="width:100%;height:100%"><g fill="none" stroke="rgba(38,14,40,.55)" stroke-linecap="round">` +
      `<path d="M-10 20 C80 40 150 30 230 70 S330 110 380 95" stroke-width="9"/><path d="M120 38 C140 70 170 90 160 130" stroke-width="5"/>` +
      `<path d="M230 70 C250 40 290 25 320 30" stroke-width="4"/><path d="M300 100 C310 130 300 150 315 175" stroke-width="3"/>` +
      `<path d="M690 10 C610 30 560 70 480 80 S400 70 360 50" stroke-width="8"/><path d="M560 62 C570 95 600 115 590 150" stroke-width="4"/>` +
      `<path d="M480 80 C470 110 440 125 430 160" stroke-width="3.5"/><path d="M420 72 C400 40 380 20 350 15" stroke-width="3"/>` +
      `</g></svg></span>`;
    // The canopy: soft, slightly blurred PETALS (not round blobs; 2026-11-25,
    // developer's request), each turned its own way, swaying.
    for (let i = 0; i < n(90); i++) {
      const size = px(rand(12, 30));
      html += `<span class="prism-pl-sway prism-pl-canopy is-${pick(PETAL_SHAPES)}" style="left:${f1(rand(-5, 100))}%;top:${f1(rand(-5, 9))}%;width:${size}px;height:${Math.round(size * 0.8)}px;rotate:${Math.round(rand(0, 360))}deg;background:${pick(["#ffd0e2", "#f6a6c8", "#fde6ef"])};filter:blur(${f1(rand(0.8, 2.5))}px);opacity:${f1(rand(0.55, 0.9))};${timing(6, 9)}"></span>`;
    }
    // Petals at three depths (far = small, faint, slow; near = big, blurred,
    // fast) and in three petal shapes (2026-11-25, developer's request): plain,
    // notched cherry petal and oval. (A five-petal flower was tried and dropped.)
    const PETALS = ["#f6a6c8", "#ffd0e2", "#fde6ef"];
    const petal = (w: number, blur: number, opacity: number, drift: number, minD: number, maxD: number) => {
      const shape = pick(PETAL_SHAPES);
      const h = w * (shape === "notched" ? 1.15 : 0.66);
      return `<span class="prism-pl-petal is-${shape}" style="left:${f1(rand(0, 95))}%;top:${f1(rand(-4, 10))}%;width:${f1(w)}px;height:${f1(h)}px;background:${pick(PETALS)};${blur ? `filter:blur(${f1(blur)}px);` : ""}--o:${opacity};--x:${Math.round(rand(-drift, drift * 1.5))}px;--rot:${Math.round(rand(200, 480))}deg;${timing(minD, maxD)}"></span>`;
    };
    for (let i = 0; i < n(14); i++) html += petal(rand(4, 6), 0, 0.55, 30, 18, 28);
    for (let i = 0; i < n(12); i++) html += petal(rand(8, 11), 0, 0.9, 50, 12, 20);
    for (let i = 0; i < n(5); i++) html += petal(rand(18, 28), rand(2, 3.5), 0.85, 120, 7, 12);
    return { background: "linear-gradient(180deg, #5a2d58 0%, #7a4069 45%, #3a2049 100%)", html };
  }

}

// Petal shapes for Blossom canopy (masks in NEW_SKY_CSS).
const PETAL_SHAPES = ["plain", "notched", "notched", "oval"];

// Milky Way's shooting stars: a thin streak with a bright head that flashes
// across now and then (hidden most of its loop), each time somewhere new
// (wireSky). Added 2026-11-25 at the developer's request.
function shootingStars(count: number, px: (size: number) => number): string {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `<span class="prism-pl-shoot" style="${shootPlace()};width:${px(rand(90, 150))}px;--dist:${px(rand(160, 260))}px;${timing(12, 22)}"></span>`;
  }
  return html;
}
// A random start in the upper part. All of them head the same way (down to
// the left, like a meteor shower; developer's request), with a little wobble.
function shootPlace(): string {
  const angle = rand(146, 154);
  return `left:${f1(rand(5, 85))}%;top:${f1(rand(4, 55))}%;--a:${Math.round(angle)}deg`;
}

// Raindrops, petals and shooting stars start again somewhere new
// each time round.
export function wireSky(sky: HTMLElement): void {
  sky.querySelectorAll<HTMLCanvasElement>("canvas.prism-pl-glass").forEach((canvas) => startRainGlass(canvas));
  sky.querySelectorAll<HTMLElement>(".prism-pl-shoot").forEach((el) =>
    el.addEventListener("animationiteration", () => {
      const [l, t, a] = shootPlace().split(";").map((part) => part.split(":")[1]);
      el.style.left = l;
      el.style.top = t;
      el.style.setProperty("--a", a);
    })
  );
  sky.querySelectorAll<HTMLElement>(".prism-pl-petal").forEach((el) =>
    el.addEventListener("animationiteration", () => {
      el.style.left = `${f1(rand(0, 98))}%`;
    })
  );
}

export const NEW_SKY_CSS = `
/* ----- The newer themes' skies (src/ui/themeSkies.ts) ----- */
.prism-pl-float { border-radius: 50%; will-change: transform; animation: var(--d) ease-in-out infinite alternate; }
.prism-pl-float-1 { animation-name: prism-pl-float-1; }
.prism-pl-float-2 { animation-name: prism-pl-float-2; }
.prism-pl-float-3 { animation-name: prism-pl-float-3; }
@keyframes prism-pl-float-1 { to { transform: translate(-12%, 10%) scale(1.15); } }
@keyframes prism-pl-float-2 { to { transform: translate(14%, -9%) scale(1.1); } }
@keyframes prism-pl-float-3 { to { transform: translate(-10%, -12%) scale(0.9); } }
/* Twilight's rainbow light bands (the same as Prism's page, styles.ts). */
.prism-pl-wave { top: -50%; left: -100%; width: 300%; height: 200%; will-change: transform; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.prism-pl-wave-1 { background: linear-gradient(105deg, transparent 41%, rgba(255, 150, 200, 0.21) 44%, rgba(255, 190, 140, 0.21) 46.5%, rgba(255, 240, 150, 0.19) 49%, rgba(150, 240, 190, 0.19) 51.5%, rgba(140, 200, 255, 0.21) 54%, rgba(190, 160, 255, 0.21) 56.5%, transparent 59.5%); animation-name: prism-pl-wave-a; animation-duration: 26s; }
.prism-pl-wave-2 { background: linear-gradient(125deg, transparent 40%, rgba(190, 160, 255, 0.16) 43.5%, rgba(140, 200, 255, 0.16) 46.5%, rgba(150, 240, 190, 0.14) 49.5%, rgba(255, 240, 150, 0.14) 52.5%, rgba(255, 190, 140, 0.16) 55.5%, rgba(255, 150, 200, 0.16) 58.5%, transparent 62%); animation-name: prism-pl-wave-b; animation-duration: 34s; animation-delay: -9s; }
.prism-pl-wave-3 { background: linear-gradient(80deg, transparent 45%, rgba(255, 150, 200, 0.13) 47%, rgba(255, 240, 150, 0.13) 49%, rgba(150, 240, 190, 0.13) 51%, rgba(140, 200, 255, 0.13) 53%, transparent 55%); animation-name: prism-pl-wave-c; animation-duration: 21s; animation-delay: -5s; }
@keyframes prism-pl-wave-a { 0%, 100% { transform: translate(-22%, 0) rotate(0deg); } 25% { transform: translate(6%, 8%) rotate(5deg); } 50% { transform: translate(24%, -5%) rotate(-3deg); } 75% { transform: translate(-4%, -9%) rotate(4deg); } }
@keyframes prism-pl-wave-b { 0%, 100% { transform: translate(18%, -6%) rotate(0deg); } 30% { transform: translate(-12%, 7%) rotate(-6deg); } 55% { transform: translate(-24%, -3%) rotate(3deg); } 80% { transform: translate(8%, 9%) rotate(-2deg); } }
@keyframes prism-pl-wave-c { 0%, 100% { transform: translate(0, 8%) rotate(2deg); } 20% { transform: translate(-20%, -4%) rotate(-4deg); } 60% { transform: translate(22%, 4%) rotate(5deg); } 85% { transform: translate(6%, -8%) rotate(-2deg); } }
/* Twilight's sparkles: the same as Prism's page (styles.ts .prism-star). */
.prism-pl-tw {
  background: #f3e8ff;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  opacity: 0;
  animation: prism-pl-tw ease-in-out infinite;
}
@keyframes prism-pl-tw {
  0%, 45%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg); }
  72%           { opacity: 0.95; transform: scale(1) rotate(45deg); }
}
/* Milky Way's shooting stars: hidden for ~92% of the loop, then a quick
   streak along angle --a for --dist pixels. The head is the bright right end. */
.prism-pl-shoot {
  height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, transparent, rgba(220, 210, 255, 0.5) 60%, #fff);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
  transform-origin: right center;
  opacity: 0;
  will-change: transform, opacity;
  animation: prism-pl-shoot var(--d) var(--l) linear infinite;
}
@keyframes prism-pl-shoot {
  0%, 92% { opacity: 0; transform: rotate(var(--a)) translateX(0) scaleX(0.3); }
  93% { opacity: 1; transform: rotate(var(--a)) translateX(0) scaleX(1); }
  98%, 100% { opacity: 0; transform: rotate(var(--a)) translateX(var(--dist)) scaleX(0.6); }
}
/* Window rain: city lights that now and then dim (the drops on the glass
   are a canvas, src/ui/rainGlass.ts). */
.prism-pl-citylight { border-radius: 50%; opacity: var(--o); animation: prism-pl-citylight var(--d) var(--l) ease-in-out infinite; }
@keyframes prism-pl-citylight {
  0%, 62%, 100% { opacity: var(--o); transform: scale(1); }
  72% { opacity: calc(var(--o) * 0.3); transform: scale(0.97); }
  82% { opacity: var(--o); transform: scale(1.03); }
}
/* Misty morning ("M8, fogged glass"): glows drift (prism-pl-float-*) and
   slowly brighten and dim. */
.prism-pl-fogglow { border-radius: 50%; opacity: var(--o); animation: var(--d) ease-in-out infinite alternate, prism-pl-fogdim var(--b) var(--l) ease-in-out infinite; }
.prism-pl-fogglow.prism-pl-float-1 { animation-name: prism-pl-float-1, prism-pl-fogdim; }
.prism-pl-fogglow.prism-pl-float-2 { animation-name: prism-pl-float-2, prism-pl-fogdim; }
.prism-pl-fogglow.prism-pl-float-3 { animation-name: prism-pl-float-3, prism-pl-fogdim; }
@keyframes prism-pl-fogdim { 0%, 100% { opacity: var(--o); } 50% { opacity: calc(var(--o) * 0.55); } }
/* Blossom canopy's branch shadows: a slow sway. */
.prism-pl-branches { transform-origin: 50% 0; animation: prism-pl-branches 11s ease-in-out infinite; }
@keyframes prism-pl-branches { 0%, 100% { transform: translateX(-4px) rotate(-0.4deg); } 50% { transform: translateX(4px) rotate(0.4deg); } }
/* Blossom petal shapes (falling petals and the canopy): plain, oval, and
   the notched cherry petal (a mask). */
.prism-pl-petal.is-plain, .prism-pl-canopy.is-plain { border-radius: 70% 0 70% 0; }
.prism-pl-petal.is-oval, .prism-pl-canopy.is-oval { border-radius: 50%; }
.prism-pl-petal.is-notched, .prism-pl-canopy.is-notched { border-radius: 0; -webkit-mask: var(--shape) center / contain no-repeat; mask: var(--shape) center / contain no-repeat; }
.prism-pl-petal.is-notched, .prism-pl-canopy.is-notched { --shape: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 24'%3E%3Cpath d='M10 24C3 18 0 11 2 5C4 1 7 0 8 2L10 5L12 2C13 0 16 1 18 5C20 11 17 18 10 24Z'/%3E%3C/svg%3E"); }
.prism-pl-petal.is-flower { --shape: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg%3E%3Ccircle cx='12' cy='5.5' r='5'/%3E%3Ccircle cx='18.2' cy='10' r='5'/%3E%3Ccircle cx='15.8' cy='17.3' r='5'/%3E%3Ccircle cx='8.2' cy='17.3' r='5'/%3E%3Ccircle cx='5.8' cy='10' r='5'/%3E%3C/g%3E%3C/svg%3E"); }
/* Soft breathing glow (Afterglow's horizon, Milky Way's band). */
.prism-pl-breathe { animation: prism-pl-breathe var(--d) ease-in-out infinite; }
/* Clouds gliding sideways (Afterglow). */
.prism-pl-glide { will-change: transform; animation: prism-pl-glide var(--d) var(--l) ease-in-out infinite alternate; }
@keyframes prism-pl-glide { from { transform: translateX(-12vw); } to { transform: translateX(12vw); } }
/* Mist bands drifting (Misty morning). */
.prism-pl-mist { will-change: transform; animation: prism-pl-mist var(--d) var(--l) ease-in-out infinite alternate; }
@keyframes prism-pl-mist { from { transform: translateX(-15%); } to { transform: translateX(15%); } }
/* Blossoms swaying in the canopy, petals falling from it (Blossom canopy). */
.prism-pl-sway { animation: prism-pl-sway var(--d) var(--l) ease-in-out infinite; }
@keyframes prism-pl-sway { 0%, 100% { transform: rotate(-4deg) translateX(-3px); } 50% { transform: rotate(4deg) translateX(3px); } }
.prism-pl-petal { border-radius: 70% 0 70% 0; will-change: transform; animation: prism-pl-fall var(--d) var(--l) linear infinite; }
@keyframes prism-pl-fall { 0% { transform: translate(0, 0) rotate(0); opacity: 0; } 8% { opacity: var(--o, 1); } 100% { transform: translate(var(--x), 100vh) rotate(var(--rot)); opacity: 0; } }
`;
