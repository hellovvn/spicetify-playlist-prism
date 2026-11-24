// LIBRARY PANEL THEME on Spotify's left panel ("Your Library"), with a
// playlist theme on (Settings > "Playlist theme"). The panel gets a STILL
// background in the theme's colours; only the OPEN playlist's row moves
// (a small copy of the theme behind its text). Spotify's green in the panel
// (Liked Songs title, the playing speaker icon) becomes Prism pink.
//
// Spotify marks the open playlist's row with aria-selected="true". Its
// inner [data-encore-id="listRow"] box (6px corners) gets our layer as a
// child, behind the text (isolation + z-index -1). Spotify redraws rows while
// scrolling, so a MutationObserver keeps the layer on the right row.
//
// Pure parts (colours, the row's HTML): src/theme/libraryTheme.ts.

import { loadPlaylistThemeSetting } from "../storage";
import { parsePlaylistTheme, PLAYLIST_THEME_CHANGED_EVENT, type PlaylistThemeId } from "../theme/playlistTheme";
import { panelBackground, rowBackground, rowSkyHtml } from "../theme/libraryTheme";

const STYLE_ID = "playlist-prism-library-theme";
const THEME_ATTR = "data-prism-lib-theme"; // on .Root__nav-bar while a theme is on
const SKY_CLASS = "prism-lib-sky";
const SELECTED_BOX = '[role="row"][aria-selected="true"] [data-encore-id="listRow"]';

// Animations shared by all themes (the backgrounds are set per theme below).
const BASE_CSS = `
/* ----- Library panel theme (src/ui/libraryTheme.ts) ----- */
.Root__nav-bar[${THEME_ATTR}] {
  --text-bright-accent: #f6a6c8;
  --essential-bright-accent: #f6a6c8;
}
.Root__nav-bar[${THEME_ATTR}] .main-yourLibraryX-libraryContainer { background: none !important; }
.Root__nav-bar[${THEME_ATTR}] ${SELECTED_BOX} {
  isolation: isolate;
  background-color: transparent !important;
}
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
@media (prefers-reduced-motion: reduce) {
  .${SKY_CLASS} > * { animation: none !important; }
  .${SKY_CLASS} > .prism-lib-star { opacity: 0.8; }
}
`;

function themeCss(theme: Exclude<PlaylistThemeId, "none">): string {
  return `${BASE_CSS}
.Root__nav-bar[${THEME_ATTR}] .main-yourLibraryX-entryPoints.main-yourLibraryX-library { background: ${panelBackground(theme)} !important; }
.${SKY_CLASS} { background: ${rowBackground(theme)}; }
`;
}

export function startLibraryTheme(): void {
  let theme = parsePlaylistTheme(loadPlaylistThemeSetting());
  let scheduled = false;

  const update = () => {
    scheduled = false;
    const nav = document.querySelector(".Root__nav-bar");
    let style = document.getElementById(STYLE_ID);
    if (theme === "none" || !nav) {
      style?.remove();
      nav?.removeAttribute(THEME_ATTR);
      document.querySelectorAll(`.${SKY_CLASS}`).forEach((el) => el.remove());
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

    // The moving layer: only in the open playlist's row.
    const box = nav.querySelector(SELECTED_BOX);
    nav.querySelectorAll(`.${SKY_CLASS}`).forEach((sky) => {
      if (sky.parentElement !== box || (sky as HTMLElement).dataset.theme !== theme) sky.remove();
    });
    if (box && !box.querySelector(`:scope > .${SKY_CLASS}`)) {
      const sky = document.createElement("div");
      sky.className = SKY_CLASS;
      sky.dataset.theme = theme;
      sky.setAttribute("aria-hidden", "true");
      sky.innerHTML = rowSkyHtml(theme);
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
  window.addEventListener(PLAYLIST_THEME_CHANGED_EVENT, () => {
    theme = parsePlaylistTheme(loadPlaylistThemeSetting());
    schedule();
  });
  window.setInterval(() => {
    watchNav(); // Spotify may rebuild its left panel
    schedule();
  }, 1500);
}
