// PLAYLIST THEMES on Spotify's own playlist pages (developer's picks
// 2026-11-24: mockups H1 "Northern lights", H2 "Starry night", H3 "Bubble
// nebula", plus "No theme"). Picked in Prism Settings.
//
// With a theme on, EVERY playlist page gets:
//   - a moving background (the "sky") behind the whole page,
//   - the COLOUR RAIL: a thin glowing bar down the left of the song list,
//     each song's part in its main genre's colour (the playing song pulses;
//     songs Prism hasn't scanned get a faint lavender part),
//   - the GENRE MIX bar under the title (top genres of the scanned songs).
//
// Spotify draws the page, so we can't change its code: a <style> tag clears
// Spotify's own cover-colour backgrounds, and our elements are added into
// its page and re-checked whenever the page changes (Spotify reuses row
// elements while you scroll, so a rail part must follow the SONG). Same
// approach as the Tone view (src/ui/toneRows.ts).
//
// READ-ONLY: it reads the playlist's songs and Prism's tag cache only.
// Nothing is sent to Last.fm for this, and the playlist is never touched.
// Pure parts: src/theme/playlistTheme.ts (tests/playlistTheme.test.ts).

import { loadPlaylistThemeSetting, loadTagCacheText } from "../storage";
import { getSourceTracks } from "../spotify/read";
import { TagCache } from "../scan/tagCache";
import { LOG_PREFIX } from "../log";
import { genreColours, genreMix, mainGenre, mixCaption, parsePlaylistTheme, PLAYLIST_THEME_CHANGED_EVENT, type PlaylistThemeId } from "../theme/playlistTheme";
import { playlistUriFromPath } from "./toneView";

const STYLE_ID = "playlist-prism-playlist-theme";
const THEME_ATTR = "data-prism-theme"; // on .Root__main-view while a themed playlist shows
const SKY_CLASS = "prism-pl-sky";
const RAIL_CLASS = "prism-rail";
const MIX_ATTR = "data-prism-genre-mix";
const UNKNOWN_COLOUR = "rgba(205, 184, 255, 0.28)"; // songs Prism hasn't scanned
const RELOAD_GAP_MS = 5000; // at most one re-read of the playlist this often
const CACHE_REFRESH_MS = 30000; // re-read the tag cache (new scans) this often

// The playlist's own song list (not Spotify's "Recommended" list under it).
const ROW_SELECTOR = '.Root__main-view .main-trackList-indexable [role="row"]';

const CSS = `
/* ----- Playlist themes (src/ui/playlistTheme.ts) ----- */
/* The sky sits behind everything in the main view: isolation makes the view
   its own layer stack, so z-index -1 is above the view's background but
   below all of Spotify's content. */
.Root__main-view[${THEME_ATTR}] { isolation: isolate; background-color: #1a1333 !important; }
.${SKY_CLASS} { position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; border-radius: inherit; }
.${SKY_CLASS} * { position: absolute; }
/* Spotify's cover-colour washes (header, action bar, page) go see-through. */
[${THEME_ATTR}] .main-entityHeader-backgroundColor,
[${THEME_ATTR}] .playlist-playlist-actionBarBackground-background { background: none !important; }
[${THEME_ATTR}] .playlist-playlist-playlistContent { background-color: transparent !important; }
/* While scrolling, two bars stick to the top: Spotify's top bar and the song
   list's column header (# / Title / Album, solid grey in Spotify). Both get
   the same twilight glass so they read as one panel (nearly solid: the sky
   behind them is darker at the top, and see-through glass looked black there). */
[${THEME_ATTR}] .main-topBar-background,
[${THEME_ATTR}] .main-trackList-trackListHeader { background-color: rgba(38, 26, 76, 0.94) !important; backdrop-filter: blur(16px); }
[${THEME_ATTR}] .main-trackList-trackListHeader { border-bottom-color: rgba(205, 184, 255, 0.18) !important; }

/* Spotify's green accent -> Prism pastels (mockup play button): the big play
   buttons get the pink-to-lavender gradient with a dark purple triangle, and
   every other green (liked ticks, the playing song's title, toggled icons)
   reads Spotify's --text-bright-accent / --essential-bright-accent, so those
   are swapped for Prism pink. The playing song's animated equaliser is a
   green picture, so it's hue-shifted to pink. */
[${THEME_ATTR}] {
  --text-bright-accent: #f6a6c8;
  --essential-bright-accent: #f6a6c8;
}
[${THEME_ATTR}] .main-playButton-PlayButton .encore-bright-accent-set,
[${THEME_ATTR}] [data-testid="action-bar-row"] .encore-bright-accent-set {
  background: linear-gradient(135deg, #f6a6c8, #b9a7ff) !important;
  color: #2b1d52 !important;
  box-shadow: 0 0 18px rgba(205, 184, 255, 0.45);
}
[${THEME_ATTR}] .main-trackList-playingIcon { filter: hue-rotate(190deg) saturate(0.7) brightness(1.25); }

/* The colour rail: one part per song row, touching the rows above/below.
   It sits on the row's outer element, outside Spotify's own row content. */
[${THEME_ATTR}] .main-trackList-indexable [role="row"] { position: relative; }
.${RAIL_CLASS} {
  position: absolute; left: -12px; top: 0; bottom: 0; width: 6px; /* in the page margin, clear of the song numbers */
  background: var(--c); box-shadow: 0 0 10px var(--c);
  pointer-events: none;
}
.${RAIL_CLASS}.first { border-radius: 6px 6px 0 0; }
.${RAIL_CLASS}.last { border-radius: 0 0 6px 6px; }
.${RAIL_CLASS}.first.last { border-radius: 6px; }
.${RAIL_CLASS}.unknown { box-shadow: none; }
.${RAIL_CLASS}.playing { animation: prism-pl-pulse 2s ease-in-out infinite; }
@keyframes prism-pl-pulse {
  0%, 100% { box-shadow: 0 0 6px var(--c); }
  50% { box-shadow: 0 0 18px var(--c), 0 0 4px #fff; }
}

/* The genre mix under the title. */
[${MIX_ATTR}] { margin-top: 8px; color: #c9bde8; font-size: 12px; }
[${MIX_ATTR}] .prism-mix-bar {
  display: flex; width: 260px; max-width: 100%; height: 12px; margin-bottom: 4px;
  border-radius: 999px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* Northern lights */
.prism-pl-ray { border-radius: 50%; transform-origin: bottom; will-change: transform, opacity; animation: prism-pl-ray var(--d) var(--l) ease-in-out infinite; }
.prism-pl-curtain { inset: 0; animation: prism-pl-sway var(--d) ease-in-out infinite; will-change: transform; }
@keyframes prism-pl-ray { 0%, 100% { opacity: 0.35; transform: scaleY(0.9); } 50% { opacity: 0.9; transform: scaleY(1.08); } }
@keyframes prism-pl-sway { 0%, 100% { transform: translateX(0) skewX(0); } 50% { transform: translateX(-30px) skewX(-6deg); } }
@keyframes prism-pl-breathe { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
/* Tiny dots (aurora sky, nebula) */
.prism-pl-dot { border-radius: 50%; background: #fff; animation: prism-pl-twinkle var(--d) var(--l) infinite; }
@keyframes prism-pl-twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
/* Sparkle stars (the Prism four-point sparkle) */
.prism-pl-star {
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  animation: prism-pl-sparkle var(--d) var(--l) ease-in-out infinite;
}
@keyframes prism-pl-sparkle { 0%, 100% { opacity: 0; transform: scale(0.2) rotate(0); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
/* Bubble nebula */
.prism-pl-cloud { border-radius: 50%; filter: blur(24px); will-change: transform; animation: prism-pl-cloud var(--d) var(--l) ease-in-out infinite; }
@keyframes prism-pl-cloud { 0%, 100% { transform: translate(0, 0) rotate(0) scale(1); } 50% { transform: translate(30px, -20px) rotate(8deg) scale(1.1); } }
.prism-pl-bubble { bottom: -50px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.25); will-change: transform; animation: prism-pl-rise var(--d) var(--l) linear infinite; }
@keyframes prism-pl-rise {
  0% { transform: translate(0, 0); opacity: 0; }
  10% { opacity: 0.85; }
  50% { transform: translate(14px, -55vh); }
  100% { transform: translate(-6px, -115vh); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .${SKY_CLASS} *, .${RAIL_CLASS} { animation: none !important; }
}
`;

// ----- The skies (random each time, like the mockups) -----

const PASTELS = ["#f6a6c8", "#b9a7ff", "#9fe3d0", "#ffd59e", "#a9d4ff"];
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const timing = (minD: number, maxD: number) => `--d:${rand(minD, maxD).toFixed(1)}s;--l:${(-rand(0, maxD)).toFixed(1)}s`;

function dotsHtml(count: number): string {
  let html = "";
  for (let i = 0; i < count; i++) {
    const size = rand(1, 2.5).toFixed(1);
    html += `<span class="prism-pl-dot" style="left:${rand(0, 100).toFixed(1)}%;top:${rand(0, 100).toFixed(1)}%;width:${size}px;height:${size}px;${timing(2, 5)}"></span>`;
  }
  return html;
}

function starsHtml(count: number, maxSize: number): string {
  let html = "";
  for (let i = 0; i < count; i++) {
    const size = rand(5, maxSize).toFixed(1);
    const colour = Math.random() < 0.25 ? pick(PASTELS) : "#fff";
    html += `<span class="prism-pl-star" style="left:${rand(0, 98).toFixed(1)}%;top:${rand(0, 98).toFixed(1)}%;width:${size}px;height:${size}px;background:${colour};filter:drop-shadow(0 0 4px ${colour});${timing(2.5, 5.5)}"></span>`;
  }
  return html;
}

// One aurora curtain: many soft, blurred light streaks along a gentle wave.
// baseY = where the curtain's bright bottom edge sits (% of the height).
function curtainHtml(baseY: number, amplitude: number, phase: number, topColour: string, count: number, blur: number, opacity: number, swaySeconds: number): string {
  let rays = "";
  for (let k = 0; k < count; k++) {
    const x = (k / (count - 1)) * 110 - 5;
    const y = baseY + Math.sin((x / 100) * Math.PI * 2.4 + phase) * amplitude;
    // Sizes are % of the page, so the curtain looks the same on any window size.
    const height = rand(14, 26);
    const width = (110 / count) * rand(1, 2);
    rays +=
      `<span class="prism-pl-ray" style="left:${x.toFixed(1)}%;top:${(y - height).toFixed(1)}%;height:${height.toFixed(1)}%;width:${width.toFixed(2)}%;` +
      `background:linear-gradient(0deg,transparent 0,#8ff7cf 10%,#6fe6c0aa 35%,${topColour}66 70%,transparent);filter:blur(${blur}px);${timing(3, 7)}"></span>`;
  }
  return `<div class="prism-pl-curtain" style="opacity:${opacity};--d:${swaySeconds}s">${rays}</div>`;
}

// The mockups were 680 x 500 px; a real playlist page is often 3-5 times
// that. `scale` (1 to 4) multiplies the counts so a big window isn't sparse,
// and `width` sizes the nebula clouds like in the mockup.
function skyHtml(theme: PlaylistThemeId, width: number, scale: number): { background: string; html: string } {
  const n = (count: number) => Math.round(count * scale);
  if (theme === "aurora") {
    return {
      background: "linear-gradient(180deg, #0f0d28, #171338 50%, #1b1335)",
      html:
        dotsHtml(n(50)) +
        `<div style="left:-10%;right:-10%;top:8%;height:200px;background:radial-gradient(ellipse at 50% 60%,#7ff5c833,transparent 65%);filter:blur(30px);animation:prism-pl-breathe 8s ease-in-out infinite"></div>` +
        curtainHtml(26, 3.5, 0, "#c49bff", 46, 10, 0.85, 18) +
        curtainHtml(30, 2.5, 2, "#f6a6c8", 34, 14, 0.55, 24) +
        `<div style="left:0;right:0;bottom:0;height:52%;background:linear-gradient(transparent,#150f2cdd)"></div>`,
    };
  }
  if (theme === "stars") {
    return { background: "radial-gradient(ellipse at 70% 0%, #3d2878, #1a1333 70%)", html: starsHtml(n(28), 16) };
  }
  // nebula
  const clouds: [string, number, number, number, number][] = [
    ["#f6a6c8", -8, 5, 380, 26],
    ["#b9a7ff", 30, -8, 420, 32],
    ["#9fe3d0", 50, 35, 360, 28],
    ["#a9d4ff", -5, 55, 340, 30],
    ["#ffd59e", 65, 70, 260, 24],
  ];
  let html = clouds
    .map(([c, x, y, size, d], i) => [c, x, y, Math.round((size / 680) * width), d] as const)
    .map(([c, x, y, size, d], i) => `<span class="prism-pl-cloud" style="left:${x}%;top:${y}%;width:${size}px;height:${Math.round(size * 0.7)}px;background:radial-gradient(ellipse at 40% 45%,${c}88,${c}33 45%,transparent 70%);--d:${d}s;--l:${-i * 4}s"></span>`)
    .join("");
  html += `<span style="left:30%;top:10%;width:${Math.round((280 / 680) * width)}px;height:${Math.round((120 / 680) * width)}px;background:radial-gradient(ellipse,rgba(255,255,255,.18),transparent 70%);filter:blur(14px);transform:rotate(-20deg)"></span>`;
  html += dotsHtml(n(45)) + starsHtml(n(5), 12);
  for (let i = 0; i < n(14); i++) {
    const c = PASTELS[i % PASTELS.length];
    const size = rand(14, 42).toFixed(0);
    html +=
      `<span class="prism-pl-bubble" style="left:${rand(0, 95).toFixed(1)}%;width:${size}px;height:${size}px;` +
      `background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.75) 0 8%,transparent 12%),radial-gradient(circle,${c}11 55%,${c}99 100%);box-shadow:0 0 14px ${c}66;${timing(12, 22)}"></span>`;
  }
  return { background: "#1a1335", html };
}

function buildSky(theme: PlaylistThemeId, main: Element): HTMLElement {
  const sky = document.createElement("div");
  sky.className = SKY_CLASS;
  sky.dataset.theme = theme;
  const { width, height } = main.getBoundingClientRect();
  const scale = Math.min(4, Math.max(1, (width * height) / (680 * 500)));
  const { background, html } = skyHtml(theme, Math.max(680, width), scale);
  sky.style.background = background;
  sky.innerHTML = html;
  // Each sparkle star moves to a new random spot after it fades out.
  sky.querySelectorAll<HTMLElement>(".prism-pl-star").forEach((star) =>
    star.addEventListener("animationiteration", () => {
      star.style.left = `${rand(0, 98).toFixed(1)}%`;
      star.style.top = `${rand(0, 98).toFixed(1)}%`;
    })
  );
  return sky;
}

// ----- Song data (main genres) for the open playlist -----

interface PlaylistData {
  uri: string;
  mains: Map<string, string | null>; // song URI -> main genre
  colours: Map<string, string>;
  mixHtml: string;
  loadedAt: number;
  loading: boolean;
  notInPlaylist: Set<string>; // rows that aren't the playlist's songs
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function mixHtmlFor(songMains: (string | null)[], colours: Map<string, string>): string {
  const mix = genreMix(songMains);
  let bar = "";
  if (mix.scanned > 0) {
    const segments = mix.rows.map((r) => `<span style="flex:${r.count};background:${colours.get(r.name)}" title="${escapeHtml(r.name)}"></span>`);
    if (mix.otherCount > 0) segments.push(`<span style="flex:${mix.otherCount};background:rgba(205,184,255,.35)" title="other"></span>`);
    bar = `<div class="prism-mix-bar">${segments.join("")}</div>`;
  }
  return bar + `<div>${escapeHtml(mixCaption(mix))}</div>`;
}

// The song URI of one of Spotify's track rows, from React's data on it
// (same as the Tone view: there's no song ID in the page's HTML).
function trackUriOfRow(row: Element): string | null {
  const key = Object.keys(row).find((k) => k.startsWith("__reactFiber"));
  let fiber = key ? (row as any)[key] : null;
  for (let depth = 0; fiber && depth < 25; depth++, fiber = fiber.return) {
    const uri = fiber.memoizedProps?.uri;
    if (typeof uri === "string" && uri.startsWith("spotify:track:")) return uri;
  }
  return null;
}

export function startPlaylistTheme(): void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  let theme = parsePlaylistTheme(loadPlaylistThemeSetting());
  let data: PlaylistData | null = null;
  let scheduled = false;

  const load = (uri: string) => {
    const mine: PlaylistData = data?.uri === uri ? data : { uri, mains: new Map(), colours: new Map(), mixHtml: "", loadedAt: 0, loading: false, notInPlaylist: new Set() };
    data = mine;
    if (mine.loading) return;
    mine.loading = true;
    getSourceTracks(uri)
      .then((tracks) => {
        const cache = new TagCache(loadTagCacheText());
        const now = Date.now();
        const mains = new Map<string, string | null>();
        for (const t of tracks) mains.set(t.uri, mainGenre(cache.get(t.uri, now)?.tags));
        const songMains = tracks.map((t) => mains.get(t.uri) ?? null);
        mine.mains = mains;
        mine.colours = genreColours(songMains);
        mine.mixHtml = mixHtmlFor(songMains, mine.colours);
      })
      .catch((error) => console.warn(`${LOG_PREFIX} playlist theme: couldn't read the playlist`, error))
      .then(() => {
        mine.loading = false;
        mine.loadedAt = Date.now();
        schedule();
      });
  };

  const clear = (main: Element | null) => {
    main?.removeAttribute(THEME_ATTR);
    document.querySelectorAll(`.${SKY_CLASS}, .${RAIL_CLASS}, [${MIX_ATTR}]`).forEach((el) => el.remove());
  };

  const update = () => {
    scheduled = false;
    const main = document.querySelector(".Root__main-view");
    const uri = playlistUriFromPath(Spicetify.Platform.History.location?.pathname);
    if (!main || !uri || theme === "none") {
      clear(main);
      if (!uri) data = null;
      return;
    }

    // The sky (rebuilt only when the theme changes).
    if (main.getAttribute(THEME_ATTR) !== theme) main.setAttribute(THEME_ATTR, theme);
    let sky = main.querySelector(`:scope > .${SKY_CLASS}`) as HTMLElement | null;
    if (sky && sky.dataset.theme !== theme) {
      sky.remove();
      sky = null;
    }
    if (!sky) main.insertBefore(buildSky(theme, main), main.firstChild);

    // Song data: on a new playlist, and again now and then (new scans).
    if (data?.uri !== uri || (!data.loading && Date.now() - data.loadedAt > CACHE_REFRESH_MS)) load(uri);
    const current = data!;
    if (current.loadedAt === 0) return; // first load still running

    // The genre mix under the title.
    const meta = main.querySelector(".main-entityHeader-metaData");
    let mix = main.querySelector(`[${MIX_ATTR}]`) as HTMLElement | null;
    if (meta && (!mix || mix.previousElementSibling !== meta)) {
      mix?.remove();
      mix = document.createElement("div");
      mix.setAttribute(MIX_ATTR, "");
      meta.after(mix);
    }
    if (mix && mix.innerHTML !== current.mixHtml) mix.innerHTML = current.mixHtml;

    // The rail: a part in every visible song row.
    const playing = Spicetify.Player?.data?.item?.uri;
    const rowCount = Number(main.querySelector(".main-trackList-indexable")?.getAttribute("aria-rowcount") ?? 0);
    const missing: string[] = [];
    main.querySelectorAll(ROW_SELECTOR).forEach((row) => {
      if (!row.querySelector(".main-trackList-trackListRow")) return; // the header row
      const songUri = trackUriOfRow(row);
      let rail = row.querySelector(`:scope > .${RAIL_CLASS}`) as HTMLElement | null;
      if (!songUri || !current.mains.has(songUri)) {
        if (songUri && !current.notInPlaylist.has(songUri)) missing.push(songUri);
        rail?.remove();
        return;
      }
      if (!rail) {
        rail = document.createElement("span");
        rail.setAttribute("aria-hidden", "true");
        row.appendChild(rail);
      }
      const genre = current.mains.get(songUri);
      const colour = (genre && current.colours.get(genre)) || UNKNOWN_COLOUR;
      const index = Number(row.getAttribute("aria-rowindex"));
      const classes = [RAIL_CLASS, genre ? "" : "unknown", index === 2 ? "first" : "", index === rowCount ? "last" : "", songUri === playing ? "playing" : ""].filter(Boolean).join(" ");
      // Only touch the DOM when something changed (Spotify reuses rows).
      if (rail.className !== classes) rail.className = classes;
      if (rail.style.getPropertyValue("--c") !== colour) rail.style.setProperty("--c", colour);
      const label = genre ?? "not scanned by Prism yet";
      if (rail.title !== label) rail.title = label;
    });

    // Songs added since the last read: read the playlist again (rate-limited).
    // Songs still missing after that aren't the playlist's songs.
    if (missing.length > 0 && !current.loading && Date.now() - current.loadedAt > RELOAD_GAP_MS) {
      const before = current.loadedAt;
      load(uri);
      const check = () => {
        if (current.loadedAt === before) return void setTimeout(check, 200);
        missing.filter((m) => !current.mains.has(m)).forEach((m) => current.notInPlaylist.add(m));
      };
      check();
    }
  };

  // Many changes come at once while Spotify draws or scrolls: handle them
  // together on the next frame.
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };

  const isOurs = (node: Node) => (node as Element).matches?.(`.${SKY_CLASS}, .${SKY_CLASS} *, .${RAIL_CLASS}, [${MIX_ATTR}], [${MIX_ATTR}] *`);
  const observer = new MutationObserver((mutations) => {
    // Ignore our own changes, or we'd loop.
    const ours = mutations.every((m) => isOurs(m.target) || (m.type === "childList" && [...m.addedNodes, ...m.removedNodes].every(isOurs)));
    if (!ours) schedule();
  });
  const watchMainView = () => {
    const main = document.querySelector(".Root__main-view");
    if (main && !(main as any).__prismThemeWatched) {
      (main as any).__prismThemeWatched = true;
      observer.observe(main, { childList: true, subtree: true });
    }
  };

  watchMainView();
  schedule();
  Spicetify.Platform.History.listen(() => schedule());
  Spicetify.Player?.addEventListener?.("songchange", () => schedule());
  window.addEventListener(PLAYLIST_THEME_CHANGED_EVENT, () => {
    theme = parsePlaylistTheme(loadPlaylistThemeSetting());
    schedule();
  });
  window.setInterval(() => {
    watchMainView(); // Spotify may rebuild its main view
    schedule();
  }, 1500);
}
