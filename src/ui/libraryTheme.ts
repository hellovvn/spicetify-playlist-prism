// LIBRARY PANEL THEME on Spotify's left panel ("Your Library"), with a
// playlist theme on (Settings > "Playlist theme"). The panel gets a STILL
// background in the theme's colours; only the OPEN playlist's row moves
// (a small copy of the theme behind its text). Spotify's green in the panel
// (Liked Songs title, the playing speaker icon) becomes Prism pink. Hovering
// any row shows the "rainbow edge" (the old Prism-only purple hover is gone).
//
// Spotify marks the open playlist's row with aria-selected="true" (Liked
// Songs is the exception, see isLikedSongsPage). The open row's box gets the
// class prism-lib-open. Its
// inner [data-encore-id="listRow"] box (6px corners) gets our layer as a
// child, behind the text (isolation + z-index -1). Spotify redraws rows while
// scrolling, so a MutationObserver keeps the layer on the right row.
//
// Pure parts (colours, the row's HTML): src/theme/libraryTheme.ts.

import { loadPlaylistThemeOverrides, loadPlaylistThemeSetting } from "../storage";
import { effectiveTheme, parsePlaylistTheme, parseThemeOverrides, PLAYLIST_THEME_CHANGED_EVENT, type PlaylistThemeId } from "../theme/playlistTheme";
import { isLikedSongsPage, LIKED_SONGS_COVER, panelBackground, rowBackground, rowSkyHtml } from "../theme/libraryTheme";

const STYLE_ID = "prism-library-theme";
const THEME_ATTR = "data-prism-lib-theme"; // on .Root__nav-bar while a theme is on
const SIDE_ATTR = "data-prism-side-theme"; // on <html> while a theme is on (right panel)
const SKY_CLASS = "prism-lib-sky";
const SELECTED_BOX = '[role="row"][aria-selected="true"] [data-encore-id="listRow"]';
const OPEN_CLASS = "prism-lib-open"; // on the open row's box (Spotify's selected row, or Liked Songs)

// Animations shared by all themes (the backgrounds are set per theme below).
const BASE_CSS = `
/* ----- Library panel theme (src/ui/libraryTheme.ts) ----- */
.Root__nav-bar[${THEME_ATTR}] {
  --text-bright-accent: #f6a6c8;
  --essential-bright-accent: #f6a6c8;
}
.Root__nav-bar[${THEME_ATTR}] .main-yourLibraryX-libraryContainer { background: none !important; }
.Root__nav-bar[${THEME_ATTR}] .${OPEN_CLASS} {
  isolation: isolate;
  background-color: transparent !important;
}
/* Hover ("rainbow edge", developer's pick 2026-11-24): EVERY row, Prism-made
   or not, gets light lavender glass, slides 3px right and shows a pastel
   rainbow bar on its left. Spotify paints its grey hover on the box's
   ::after layer, so the glass goes there; the bar is ::before. */
.Root__nav-bar[${THEME_ATTR}] [data-encore-id="listRow"] { transition: transform 0.15s ease; }
.Root__nav-bar[${THEME_ATTR}] [data-encore-id="listRow"]::before {
  content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; z-index: 1;
  border-radius: 3px; background: linear-gradient(#f6a6c8, #b9a7ff, #9fe3d0);
  opacity: 0; transition: opacity 0.15s ease; pointer-events: none;
}
.Root__nav-bar[${THEME_ATTR}] [role="row"]:hover [data-encore-id="listRow"] { transform: translateX(3px); }
.Root__nav-bar[${THEME_ATTR}] [role="row"]:hover [data-encore-id="listRow"]::before { opacity: 1; box-shadow: 0 0 8px #b9a7ff; }
.Root__nav-bar[${THEME_ATTR}] [role="row"]:hover [data-encore-id="listRow"]::after { background: rgba(205, 184, 255, 0.08) !important; }
.${SKY_CLASS} {
  position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none;
  border-radius: inherit; box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.3);
}
.${SKY_CLASS} > * { position: absolute; }
.prism-lib-dot { border-radius: 50%; background: #fff; animation: prism-lib-twinkle var(--d) var(--l) infinite; }
@keyframes prism-lib-twinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.7; } }
.prism-lib-veil { border-radius: 50%; filter: blur(14px); animation: prism-lib-drift var(--d) var(--l) ease-in-out infinite alternate; }
@keyframes prism-lib-drift { from { transform: translateX(-18%) scaleY(0.9); } to { transform: translateX(18%) scaleY(1.1); } }
.prism-lib-star {
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  animation: prism-lib-sparkle var(--d) var(--l) ease-in-out infinite;
}
@keyframes prism-lib-sparkle { 0%, 100% { opacity: 0; transform: scale(0.2) rotate(0); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
.prism-lib-cloud { width: 110px; height: 70px; border-radius: 50%; filter: blur(12px); animation: prism-lib-cloud var(--d) var(--l) ease-in-out infinite; }
@keyframes prism-lib-cloud { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -20px) rotate(8deg) scale(1.1); } }
.prism-lib-bubble { bottom: -16px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.3); animation: prism-lib-rise var(--d) var(--l) linear infinite; }
@keyframes prism-lib-rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 0.9; } 100% { transform: translate(6px, -80px); opacity: 0; } }
/* The newer themes' row pieces (2026-11-25). */
.prism-lib-band { left: -60%; top: -40%; width: 220%; height: 180%; background: linear-gradient(105deg, transparent 40%, rgba(255, 150, 200, 0.3) 44%, rgba(255, 240, 150, 0.26) 49%, rgba(150, 240, 190, 0.26) 52%, rgba(140, 200, 255, 0.3) 56%, transparent 60%); animation: prism-lib-drift var(--d) var(--l) ease-in-out infinite alternate; }
.prism-lib-galaxy { left: -20%; top: 10%; width: 140%; height: 60%; transform: rotate(-12deg); background: radial-gradient(ellipse, rgba(200, 180, 255, 0.4), transparent 70%); filter: blur(6px); animation: prism-lib-twinkle 8s ease-in-out infinite; }
.prism-lib-petal { top: -8px; width: 8px; height: 5px; border-radius: 70% 0 70% 0; animation: prism-lib-fall var(--d) var(--l) linear infinite; }
@keyframes prism-lib-fall { 0% { transform: translate(0, 0) rotate(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translate(14px, 70px) rotate(300deg); opacity: 0; } }
.prism-lib-ripple { top: 50%; margin-top: -25px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.55); opacity: 0; animation: prism-lib-ripple var(--d) var(--l) cubic-bezier(0.15, 0.6, 0.35, 1) infinite; }
@keyframes prism-lib-ripple { 0% { transform: scale(0.1); opacity: 0; } 4% { opacity: 0.8; } 40% { transform: scale(1); opacity: 0; } 100% { opacity: 0; } }
/* Window rain's drops on the glass (look "D1") and the one that slides. */
.prism-lib-wdrop {
  background: radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.9) 0 12%, transparent 20%), radial-gradient(circle at 50% 65%, rgba(225, 230, 255, 0.38), rgba(190, 200, 245, 0.1) 55%, rgba(14, 16, 38, 0.4) 100%);
  box-shadow: 0 1.5px 0.5px rgba(6, 8, 26, 0.55), inset 0 -1px 1px rgba(230, 235, 255, 0.25);
}
.prism-lib-wrunner { top: -10px; opacity: 0; animation: prism-lib-wrunner var(--d) var(--l) linear infinite; }
@keyframes prism-lib-wrunner {
  0%, 20% { opacity: 0; transform: translateY(0); }
  24% { opacity: 1; transform: translateY(14px); }
  40% { transform: translateY(18px); }
  60% { transform: translateY(46px); }
  68% { transform: translateY(50px); }
  88% { opacity: 1; transform: translateY(84px); }
  100% { opacity: 0; transform: translateY(84px); }
}
/* The sliding drop's trail ("wiped path", like the page): a clean, slightly
   darker channel with faint glossy edges, its top faded. It grows behind
   the drop (same steps as prism-lib-wrunner) and dries up afterwards. */
.prism-lib-wtrail {
  top: -10px; width: 5px; height: 94px; margin-left: 1.5px;
  background: linear-gradient(90deg, rgba(225, 232, 255, 0.28) 0 1px, rgba(10, 12, 30, 0.28) 1px calc(100% - 1px), rgba(225, 232, 255, 0.28) calc(100% - 1px));
  -webkit-mask: linear-gradient(180deg, transparent, #000 35%);
  mask: linear-gradient(180deg, transparent, #000 35%);
  transform-origin: top;
  opacity: 0;
  animation: prism-lib-wtrail var(--d) var(--l) linear infinite;
}
@keyframes prism-lib-wtrail {
  0%, 20% { opacity: 0; transform: scaleY(0); }
  24% { opacity: 1; transform: scaleY(0.15); }
  40% { transform: scaleY(0.19); }
  60% { transform: scaleY(0.49); }
  68% { transform: scaleY(0.53); }
  88% { opacity: 1; transform: scaleY(0.9); }
  100% { opacity: 0; transform: scaleY(0.9); }
}
@media (prefers-reduced-motion: reduce) {
  .${SKY_CLASS} > * { animation: none !important; }
  .Root__nav-bar[${THEME_ATTR}] [role="row"]:hover [data-encore-id="listRow"] { transform: none; }
  .${SKY_CLASS} > .prism-lib-star { opacity: 0.8; }
}
`;

// RIGHT PANEL (developer's pick 2026-11-25, option 2 "mirror left"): the same
// still background as the left panel (the MAIN theme, like the left panel),
// flipped left-right so its glow sits on the outer edge and the two panels frame
// the page. Spotify paints Quiet night's #151029 (chromeTheme.ts) on three
// stacked boxes; the outer one (.Root__right-sidebar-peek: position relative,
// 8px corners) gets the theme on a flipped ::before layer, the inner ones are
// cleared. The extra attribute in the selector outweighs chromeTheme's rules.
// Prism's own stats in that panel (#prism-panel-stats, panelHost.tsx) cover
// Spotify's panel, so they get the SAME flipped background on their host
// (developer's request 2026-11-26: consistent with the left panel); with No
// theme they keep their twilight.
const SIDE = `html[data-prism-chrome][${SIDE_ATTR}] .Root__right-sidebar`;
function rightPanelCss(theme: Exclude<PlaylistThemeId, "none">): string {
  return `
${SIDE} .Root__right-sidebar-peek { background: transparent !important; isolation: isolate; }
${SIDE} .Root__right-sidebar-peek::before {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  border-radius: inherit; background: ${panelBackground(theme)}; transform: scaleX(-1);
}
${SIDE} aside,
${SIDE} aside::before,
${SIDE} .main-nowPlayingView-container aside > div,
${SIDE} .main-nowPlayingView-container { background: transparent !important; }
${SIDE} #prism-panel-stats { background: none !important; isolation: isolate; }
${SIDE} #prism-panel-stats::before {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  border-radius: inherit; background: ${panelBackground(theme)}; transform: scaleX(-1);
}
${SIDE} #prism-panel-stats > .prism-cosmos { background: transparent; }
`;
}

function themeCss(theme: Exclude<PlaylistThemeId, "none">): string {
  return `${BASE_CSS}
.Root__nav-bar[${THEME_ATTR}] .main-yourLibraryX-entryPoints.main-yourLibraryX-library { background: ${panelBackground(theme)} !important; }
${rightPanelCss(theme)}`;
}

export function startLibraryTheme(): void {
  let theme = parsePlaylistTheme(loadPlaylistThemeSetting());
  let overrides = parseThemeOverrides(loadPlaylistThemeOverrides()); // themes for single playlists (14b)
  let scheduled = false;

  const update = () => {
    scheduled = false;
    const nav = document.querySelector(".Root__nav-bar");
    let style = document.getElementById(STYLE_ID);
    if (theme === "none" || !nav) {
      style?.remove();
      nav?.removeAttribute(THEME_ATTR);
      document.documentElement.removeAttribute(SIDE_ATTR);
      document.querySelectorAll(`.${SKY_CLASS}`).forEach((el) => el.remove());
      document.querySelectorAll(`.${OPEN_CLASS}`).forEach((el) => el.classList.remove(OPEN_CLASS));
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    const css = themeCss(theme);
    if (style.textContent !== css) style.textContent = css;
    if (nav.getAttribute(THEME_ATTR) !== theme) nav.setAttribute(THEME_ATTR, theme);
    const root = document.documentElement;
    if (root.getAttribute(SIDE_ATTR) !== theme) root.setAttribute(SIDE_ATTR, theme);

    // The moving layer: only in the open playlist's row. A playlist with its
    // own theme (14b) shows THAT theme in its row (developer's choice
    // 2026-11-25: "row only"; the rest of the panel keeps the main theme).
    const path = Spicetify.Platform.History.location?.pathname ?? "";
    const openPlaylist = /^\/playlist\/([A-Za-z0-9]+)/.exec(path)?.[1];
    const rowTheme = effectiveTheme(theme, overrides, openPlaylist ? `spotify:playlist:${openPlaylist}` : null);
    let box = nav.querySelector(SELECTED_BOX);
    if (!box && isLikedSongsPage(Spicetify.Platform.History.location?.pathname)) {
      box = nav.querySelector(`[data-encore-id="listRow"]:has(${LIKED_SONGS_COVER})`);
    }
    nav.querySelectorAll(`.${SKY_CLASS}`).forEach((sky) => {
      if (sky.parentElement !== box || (sky as HTMLElement).dataset.theme !== rowTheme) sky.remove();
    });
    nav.querySelectorAll(`.${OPEN_CLASS}`).forEach((el) => {
      if (el !== box) el.classList.remove(OPEN_CLASS);
    });
    if (box && !box.classList.contains(OPEN_CLASS)) box.classList.add(OPEN_CLASS);
    if (box && rowTheme !== "none" && !box.querySelector(`:scope > .${SKY_CLASS}`)) {
      const sky = document.createElement("div");
      sky.className = SKY_CLASS;
      sky.dataset.theme = rowTheme;
      sky.setAttribute("aria-hidden", "true");
      sky.style.background = rowBackground(rowTheme);
      sky.innerHTML = rowSkyHtml(rowTheme);
      // Each sparkle star moves to a new spot after it fades out (like the page sky).
      sky.querySelectorAll<HTMLElement>(".prism-lib-star").forEach((star) =>
        star.addEventListener("animationiteration", () => {
          star.style.left = `${(Math.random() * 96).toFixed(1)}%`;
          star.style.top = `${(Math.random() * 90).toFixed(1)}%`;
        })
      );
      box.prepend(sky);
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };

  const isOurs = (node: Node) => (node as Element).matches?.(`.${SKY_CLASS}, .${SKY_CLASS} *`);
  const observer = new MutationObserver((mutations) => {
    // Ignore our own changes, or we'd loop.
    const ours = mutations.every((m) => isOurs(m.target) || (m.type === "childList" && [...m.addedNodes, ...m.removedNodes].every(isOurs)));
    if (!ours) schedule();
  });
  const watchNav = () => {
    const nav = document.querySelector(".Root__nav-bar");
    if (nav && !(nav as any).__prismLibWatched) {
      (nav as any).__prismLibWatched = true;
      observer.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    }
  };

  watchNav();
  schedule();
  Spicetify.Platform.History.listen(() => schedule()); // Liked Songs has no aria-selected change
  window.addEventListener(PLAYLIST_THEME_CHANGED_EVENT, () => {
    theme = parsePlaylistTheme(loadPlaylistThemeSetting());
    overrides = parseThemeOverrides(loadPlaylistThemeOverrides());
    schedule();
  });
  window.setInterval(() => {
    watchNav(); // Spotify may rebuild its left panel
    schedule();
  }, 1500);
}
