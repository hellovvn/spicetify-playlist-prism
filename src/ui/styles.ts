// Global CSS for the Prism page: fade-in, spinner.
//
// Why a <style> tag instead of inline styles? Animations need @keyframes
// and selectors, which inline style={{...}} can't express.
// Everything is scoped to our own class names (prism-...), so Spotify's
// other pages are never affected.

import { PRISM_STAR_CSS } from "./prismStar";
import { RING_ANGLE_PROPERTY, RING_GLINT, RING_RAINBOW } from "./ringColours";

const STYLE_ID = "prism-styles";

// Height of the flow's later screens (sources, scan, preview), so the page
// keeps ONE layout while you use it instead of jumping as content changes.
export const SCREEN_HEIGHT = 560;

const CSS = `
@keyframes prism-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes prism-rise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
@keyframes prism-spin { to { transform: rotate(360deg); } }

/* The page itself rises in slightly when it opens. */
.prism-page { animation: prism-rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1); }

/* Content that arrives after loading fades in instead of popping. */
.prism-fade-in { animation: prism-fade 200ms ease-out; }

.prism-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid var(--spice-subtext);
  border-top-color: var(--spice-button);
  animation: prism-spin 800ms linear infinite;
}

/* ----- Twilight background (the whole page area) -----
   A deep purple gradient with a hint of pink at the far right (like the sky
   just after sunset), plus:
   - 3 soft glows ("blobs") that drift slowly,
   - 3 wide soft rainbow bands of light ("waves") that wander in a wavy path, and
   - small sparkles that twinkle in and out.
   Glows and waves are gradients (already soft, so no costly blur filter), and
   only transform/opacity are animated, which browsers can do very cheaply. */
.prism-cosmos {
  position: relative;
  overflow: hidden;
  background: linear-gradient(100deg, #150e22 0%, #21143d 32%, #33195a 62%, #4d2270 85%, #6e2f7e 100%);
  /* Spotify's card colour, re-defined for everything inside the page:
     see-through, so cards sit on the background instead of grey boxes. */
  --spice-card: rgba(255, 255, 255, 0.08);
  /* Spotify's green accent (used for checkboxes, the spinner, etc.),
     re-defined as lavender inside the page. */
  --spice-button: #b794ff;
  --spice-button-active: #c6a8ff;

  /* ----- The Prism look, in one place (UI standard, 2026-11-23) -----
     Every control on the page takes its colours from these, so a future
     theme (14a) only has to swap them. */
  --prism-accent: #b794ff;        /* main buttons, ticked boxes, chosen options */
  --prism-accent-hover: #c6a8ff;
  --prism-accent-soft: #cdb8ff;   /* rims, focus rings, quiet buttons */
  --prism-on-accent: #1b0b33;     /* text on the accent */
  --prism-error: #ffb3d1;
  --prism-new: #9fe1cb;           /* New finds */
  --prism-rainbow: linear-gradient(90deg, #ffb3d1, #ffd6a5, #fdffb6, #caffbf, #9bf6ff, #bdb2ff);
  /* Glass: control (buttons, inputs), panel (boxes), raised (pop-ups). */
  --prism-glass-control: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05));
  --prism-glass-control-hover: linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(205, 184, 255, 0.1));
  --prism-glass-panel: linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.04));
  --prism-rim: rgba(255, 255, 255, 0.28);
  --prism-shine: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  /* THE hover, for everything you can click: lavender rim + soft glow. */
  --prism-hover-rim: rgba(205, 184, 255, 0.75);
  --prism-hover-glow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 0 12px rgba(205, 184, 255, 0.4);
  --prism-ease: 150ms ease-out;
  /* PICKED big tile (a Remix door, the chosen builder group): pink edge +
     a soft pink glow inside. Pink means "you picked this tile" and nothing else. */
  --prism-picked: #f4c0d1;
  --prism-picked-glow: inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 0 24px rgba(244, 192, 209, 0.18), 0 0 0 1px #f4c0d1;
  /* Corners: pop-up 20, box 16, input/row 12 (list rows 8), pill 999. */
}
/* Spotify's green "primary" buttons get their colours from a colour set
   called encore-bright-accent-set. Re-defining it here (only inside our
   page) turns them lavender with dark purple text. */
.prism-cosmos .encore-bright-accent-set {
  --background-base: #b794ff;
  --background-highlight: #c6a8ff;
  --background-press: #a47eff;
  --text-base: #1b0b33;
  --essential-bright-accent: #1b0b33;
}
.prism-cosmos-bg { position: absolute; inset: 0; pointer-events: none; }
.prism-blob {
  position: absolute;
  width: 70vmax; height: 70vmax;
  border-radius: 50%;
  will-change: transform;
}
.prism-blob-1 { right: -30vmax; top: -25vmax; background: radial-gradient(closest-side, #d06ad0, transparent); opacity: 0.22; animation: prism-drift-1 40s ease-in-out infinite alternate; }
.prism-blob-2 { left: -30vmax; bottom: -35vmax; background: radial-gradient(closest-side, #6a3fc0, transparent); opacity: 0.5; animation: prism-drift-2 50s ease-in-out infinite alternate; }
.prism-blob-3 { right: -20vmax; bottom: -40vmax; background: radial-gradient(closest-side, #8a3fb8, transparent); opacity: 0.4; animation: prism-drift-3 46s ease-in-out infinite alternate; }
@keyframes prism-drift-1 { to { transform: translate(-16vmax, 14vmax) scale(1.15); } }
@keyframes prism-drift-2 { to { transform: translate(18vmax, -12vmax) scale(1.1); } }
@keyframes prism-drift-3 { to { transform: translate(-14vmax, -16vmax) scale(0.9); } }

/* Light waves: each is an oversized box with a soft bright stripe across it.
   Instead of sliding one way and back, each follows its OWN wavy loop
   (left/right, up/down and a slight tilt at 4 points). ease-in-out between
   the points makes the motion swing smoothly, like a cosine wave, and the
   three loops have different lengths so they never line up. */
.prism-wave {
  position: absolute;
  top: -50%; left: -100%;
  width: 300%; height: 200%;
  will-change: transform;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
/* Each band is a soft rainbow: pink, peach, yellow, mint, sky, lavender,
   fading to transparent at both edges. */
.prism-wave-1 {
  background: linear-gradient(105deg, transparent 41%, rgba(255, 150, 200, 0.21) 44%, rgba(255, 190, 140, 0.21) 46.5%, rgba(255, 240, 150, 0.19) 49%, rgba(150, 240, 190, 0.19) 51.5%, rgba(140, 200, 255, 0.21) 54%, rgba(190, 160, 255, 0.21) 56.5%, transparent 59.5%);
  animation-name: prism-wave-a; animation-duration: 26s;
}
.prism-wave-2 {
  background: linear-gradient(125deg, transparent 40%, rgba(190, 160, 255, 0.16) 43.5%, rgba(140, 200, 255, 0.16) 46.5%, rgba(150, 240, 190, 0.14) 49.5%, rgba(255, 240, 150, 0.14) 52.5%, rgba(255, 190, 140, 0.16) 55.5%, rgba(255, 150, 200, 0.16) 58.5%, transparent 62%);
  animation-name: prism-wave-b; animation-duration: 34s; animation-delay: -9s;
}
.prism-wave-3 {
  background: linear-gradient(80deg, transparent 45%, rgba(255, 150, 200, 0.13) 47%, rgba(255, 240, 150, 0.13) 49%, rgba(150, 240, 190, 0.13) 51%, rgba(140, 200, 255, 0.13) 53%, transparent 55%);
  animation-name: prism-wave-c; animation-duration: 21s; animation-delay: -5s;
}
@keyframes prism-wave-a {
  0%, 100% { transform: translate(-22%, 0) rotate(0deg); }
  25%      { transform: translate(6%, 8%) rotate(5deg); }
  50%      { transform: translate(24%, -5%) rotate(-3deg); }
  75%      { transform: translate(-4%, -9%) rotate(4deg); }
}
@keyframes prism-wave-b {
  0%, 100% { transform: translate(18%, -6%) rotate(0deg); }
  30%      { transform: translate(-12%, 7%) rotate(-6deg); }
  55%      { transform: translate(-24%, -3%) rotate(3deg); }
  80%      { transform: translate(8%, 9%) rotate(-2deg); }
}
@keyframes prism-wave-c {
  0%, 100% { transform: translate(0, 8%) rotate(2deg); }
  20%      { transform: translate(-20%, -4%) rotate(-4deg); }
  60%      { transform: translate(22%, 4%) rotate(5deg); }
  85%      { transform: translate(6%, -8%) rotate(-2deg); }
}

/* Sparkles: small 4-pointed stars (clip-path cuts a star out of a square).
   Their positions and timings are set in PrismPage.tsx. Each stays hidden
   most of the time and briefly twinkles. */
.prism-star {
  position: absolute;
  background: #f3e8ff;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  opacity: 0;
  animation: prism-twinkle ease-in-out infinite;
}
@keyframes prism-twinkle {
  0%, 45%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg); }
  72%           { opacity: 0.95; transform: scale(1) rotate(45deg); }
}

/* ----- Page header: glass panel with the diamond and the title ----- */
.prism-header {
  padding: 14px 18px;
  border-radius: 18px;
  /* "Glass": a faint see-through white, a blur of what's behind it
     (backdrop-filter), a thin light border and a bright top edge. */
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.04));
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 10px 30px rgba(10, 0, 30, 0.35);
  backdrop-filter: blur(14px);
}
.prism-title {
  /* Gradient-coloured text: paint a gradient as the background, then show
     it only through the letters (background-clip: text). */
  background: linear-gradient(90deg, #ffffff 0%, #e9d8ff 55%, #ffc8ea 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* ----- Notices (tips, warnings, errors) -----
   A see-through box with a rainbow bar down its left edge, instead of
   Spotify-style yellow/red bars that clash with the purple theme.
   The bar is ::before, so it can have rounded ends. */
.prism-notice {
  position: relative;
  margin: 0;
  padding: 8px 12px 8px 16px;
  border-radius: 12px;
  background: var(--spice-card);
  color: var(--spice-text);
}
.prism-notice::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  border-radius: 12px 0 0 12px;
  background: linear-gradient(180deg, #ffb3c7, #ffd1a6, #fff1a8, #b8f2c9, #a8d8ff, #cdb8ff);
}

/* ----- Glass buttons -----
   Spotify's outline buttons (Settings, Start page, Back, Cancel...) get a
   frosted-glass look inside our page: see-through white, a light rim, a
   bright top edge and a blur of what's behind. Hover brightens them and turns
   the rim lavender. !important: Spotify's own button styles would win
   otherwise. Only inside .prism-cosmos, so Spotify's other pages are untouched. */
.prism-cosmos [data-encore-id="buttonSecondary"] {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05)) !important;
  border: 1px solid rgba(255, 255, 255, 0.28) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 10px rgba(10, 0, 30, 0.25) !important;
  backdrop-filter: blur(10px);
  color: #ffffff !important;
  transition: background 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out, transform 100ms ease-out;
}
.prism-cosmos [data-encore-id="buttonSecondary"]:hover:not(:disabled) {
  background: var(--prism-glass-control-hover) !important;
  border-color: var(--prism-hover-rim) !important;
  box-shadow: var(--prism-hover-glow) !important;
}
.prism-cosmos [data-encore-id="buttonSecondary"]:active:not(:disabled) { transform: scale(0.97); }

/* Button sizes, one rule for the whole page:
   - ACTION buttons (the row at the bottom of a screen: Back, Cancel, Next,
     Create...) are all 48px tall, alone or next to the lavender main button.
     (Before, a glass button was 32px alone but got stretched to 48px when it
     shared a row with a main button, so "Back" changed size between screens.)
   - Small utility buttons (header Start page/Settings, "Start" by the link
     box, Open playlist) keep Spotify's 32px.
   Action rows have the class prism-actions. */
.prism-cosmos .prism-actions { align-items: center; }
.prism-cosmos .prism-actions [data-encore-id="buttonSecondary"] {
  min-height: 48px;
  padding-inline: 20px;
}
.prism-cosmos [data-encore-id="buttonSecondary"]:disabled { opacity: 0.45; }

/* MAIN button (Spotify's ButtonPrimary, lavender via encore-bright-accent-set
   above). Spotify grows it on hover; the Prism standard is the same as every
   other control: no growing, a soft lavender glow, and a 3% press. The colour
   is drawn by the inner span, so the glow goes there. */
.prism-cosmos [data-encore-id="buttonPrimary"],
.prism-cosmos [data-encore-id="buttonPrimary"] > span { transform: none !important; }
.prism-cosmos [data-encore-id="buttonPrimary"] > span {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: background-color var(--prism-ease), box-shadow var(--prism-ease);
}
.prism-cosmos [data-encore-id="buttonPrimary"]:hover:not(:disabled) > span {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 0 14px rgba(205, 184, 255, 0.55);
}
.prism-cosmos [data-encore-id="buttonPrimary"]:active:not(:disabled) > span { transform: scale(0.97) !important; }
.prism-cosmos [data-encore-id="buttonPrimary"]:disabled { opacity: 0.45; }

/* QUIET button: lavender text only ("← Back" on the start tiles, "Show more"). */
.prism-quiet-button {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 4px 2px;
  color: var(--prism-accent-soft);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: color var(--prism-ease);
}
.prism-quiet-button:hover { color: #ffffff; }
.prism-quiet-button:focus-visible { outline: 2px solid var(--prism-accent-soft); outline-offset: 2px; border-radius: 4px; }

/* ----- Toggle (approved 2026-11-24, tone strip "E") -----
   For an on/off that takes effect AT ONCE (not for picking things: that's
   the checkbox). A <button role="switch" aria-checked> with a knob.
   Off = clear glass track, white knob left; on = lavender track, knob right. */
.prism-toggle {
  position: relative; flex: none;
  width: 34px; height: 20px; padding: 0; margin: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}
.prism-toggle::after {
  content: ""; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: #ffffff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: transform 150ms ease;
}
.prism-toggle[aria-checked="true"] { background: #b794ff; border-color: #cdb8ff; }
.prism-toggle[aria-checked="true"]::after { transform: translateX(14px); }
.prism-toggle:hover { border-color: rgba(205, 184, 255, 0.75); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 0 12px rgba(205, 184, 255, 0.4); }
.prism-toggle:active::after { width: 17px; }
.prism-toggle[aria-checked="true"]:active::after { transform: translateX(11px); }
.prism-toggle:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .prism-toggle, .prism-toggle::after { transition: none; } }

/* ----- Checkbox: one glass box everywhere -----
   A real <input type="checkbox"> (so keyboard, labels and "indeterminate"
   keep working) with the browser's own look switched off (appearance: none).
   Off = clear glass; on = lavender with a dark tick; some = a dash.
   .prism-checkbox.is-locked is a <span> version for the seed song (always in). */
.prism-checkbox {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  width: 18px; height: 18px;
  flex-shrink: 0;
  display: inline-grid;
  place-content: center;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: background var(--prism-ease), border-color var(--prism-ease), box-shadow var(--prism-ease);
}
/* The tick: a small rotated L drawn with two borders. */
.prism-checkbox::before {
  content: "";
  width: 4px; height: 8px;
  margin-top: -2px;
  border: solid #ffffff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform 120ms ease-out;
}
.prism-checkbox:checked, .prism-checkbox:indeterminate, .prism-checkbox.is-locked {
  background: var(--prism-accent);
  border-color: var(--prism-accent-soft);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 0 8px rgba(205, 184, 255, 0.45);
}
.prism-checkbox:checked::before, .prism-checkbox.is-locked::before { transform: rotate(45deg) scale(1); }
/* "Some ticked": a short dash instead of the tick. */
.prism-checkbox:indeterminate::before { width: 8px; height: 0; margin-top: 0; border-width: 0 0 2px 0; transform: none; }
.prism-checkbox:hover:not(:disabled) { border-color: var(--prism-hover-rim); box-shadow: var(--prism-hover-glow); }
.prism-checkbox:focus-visible { outline: 2px solid var(--prism-accent-soft); outline-offset: 2px; }
.prism-checkbox:disabled { cursor: default; opacity: 0.5; }
.prism-checkbox.is-locked { opacity: 0.55; cursor: default; }

/* ----- List rows (songs, playlists): one style everywhere -----
   8px corners, a thin line between rows, a faint white hover. */
.prism-row {
  border-radius: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 120ms ease-out;
}
.prism-row:first-child { border-top-color: transparent; }
.prism-row.is-clickable { cursor: pointer; }
.prism-row.is-clickable:hover { background: rgba(255, 255, 255, 0.06); }
/* A row that stands out (the seed song): glass. */
.prism-row.is-glass { background: var(--prism-glass-panel); border: 1px solid rgba(255, 255, 255, 0.18); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25); }
/* "Select all" heads a list: a line under it instead of above. */
.prism-row.is-head { border-radius: 0; border-top: none; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
.prism-row.is-head:hover { background: transparent; }

/* ----- Progress bar: the same glass track as the stats bars ----- */
.prism-progress {
  height: 10px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.prism-progress-fill {
  height: 100%;
  border-radius: 5px;
  background: var(--prism-rainbow);
  background-size: 100% 100%;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 0 10px rgba(205, 184, 255, 0.35);
  transition: width 300ms ease-out;
}

/* ----- Screen title: the same on every screen -----
   Light 22px display font in white (section headings are 13px bold). */
.prism-screen-title {
  margin: 0;
  font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
  font-size: 22px;
  font-weight: 300;
  letter-spacing: 0.02em;
  line-height: 1.3;
  color: #ffffff;
}
/* Section heading inside a screen ("Song tags", "Lyrics"): 13px bold. */
.prism-heading { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #e9dcff; }

/* ----- Segmented control (Organize settings) -----
   A row of glass buttons in one pill; the chosen one is lavender. */
.prism-seg {
  display: inline-flex;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  overflow: hidden;
}
.prism-seg button {
  border: none;
  background: transparent;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  padding: 5px 13px;
  cursor: pointer;
  transition: background 150ms ease-out, color 150ms ease-out;
}
.prism-seg button + button { border-left: 1px solid rgba(255, 255, 255, 0.15); }
.prism-seg button:hover:not(.on) { background: rgba(255, 255, 255, 0.12); }
.prism-seg button.on { background: #b794ff; color: #1b0b33; }
.prism-seg button:focus-visible { outline: 2px solid #cdb8ff; outline-offset: -2px; }
/* PILLS variant (2026-11-25, theme picker "D"): the same choice, but each
   option is its own glass pill and they wrap onto more lines (for long lists
   like the playlist themes). Chosen = the same lavender. */
.prism-seg.is-pills { display: flex; flex-wrap: wrap; gap: 6px; border: none; background: none; box-shadow: none; overflow: visible; border-radius: 0; }
.prism-seg.is-pills button { border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.28); background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2); }
.prism-seg.is-pills button + button { border-left: 1px solid rgba(255, 255, 255, 0.28); }
.prism-seg.is-pills button.on { border-color: #b794ff; background: #b794ff; color: #1b0b33; }
.prism-seg.is-pills button:hover:not(.on) { background: rgba(255, 255, 255, 0.12); }
.prism-seg.is-pills button:focus-visible { outline-offset: 2px; }
/* ----- Settings side rail (layout "B", 2026-11-26) -----
   A glass column of section buttons left of the chosen section. Chosen = a
   soft lavender fill with a 3px lavender bar on its left edge. Narrow page
   (container under 540px): the rail turns into a wrapping row on top. */
.prism-settings > * { box-sizing: border-box; }
.prism-settings-wrap { container-type: inline-size; }
.prism-settings { display: grid; grid-template-columns: 176px minmax(0, 1fr); gap: 16px; align-items: start; }
.prism-rail-nav { display: flex; flex-direction: column; gap: 2px; padding: 6px; }
.prism-rail-nav button {
  display: flex; align-items: center; gap: 10px; width: 100%;
  border: 1px solid transparent; border-radius: 10px; background: transparent;
  color: #ffffff; font-size: 13px; font-weight: 600; text-align: left;
  padding: 9px 12px; cursor: pointer;
  transition: background var(--prism-ease), border-color var(--prism-ease), box-shadow var(--prism-ease);
}
.prism-rail-nav button svg { flex: none; opacity: 0.85; }
.prism-rail-nav button:hover:not(.on) { background: rgba(255, 255, 255, 0.08); border-color: var(--prism-hover-rim); }
.prism-rail-nav button:active { transform: scale(0.97); }
.prism-rail-nav button.on { background: rgba(183, 148, 255, 0.24); box-shadow: inset 3px 0 0 #b794ff; color: #ffffff; }
.prism-rail-nav button.on svg { color: #cdb8ff; opacity: 1; }
.prism-rail-nav button:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
.prism-settings-section { display: flex; flex-direction: column; gap: 12px; padding: 18px 20px; min-width: 0; animation: prism-fade 200ms ease-out; }
.prism-settings-section .prism-heading { margin: 0; }
@container (max-width: 540px) {
  .prism-settings { grid-template-columns: minmax(0, 1fr); }
  .prism-rail-nav { flex-direction: row; flex-wrap: wrap; }
  .prism-rail-nav button { width: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .prism-settings-section { animation: none; }
  .prism-rail-nav button:active { transform: none; }
}
/* Theme preview strip (src/ui/ThemeStrip.tsx): the chosen theme's real sky. */
/* The sky's moving parts are their own GPU layers, which slipped past the
   rounded corners (overflow + border-radius didn't clip them) and made the
   edge look ragged. clip-path clips them too, and the rim is drawn ON TOP
   of the sky (::after), so it's one even line all the way round. */
.prism-theme-strip { position: relative; height: 72px; border-radius: 12px; overflow: hidden; clip-path: inset(0 round 12px); isolation: isolate; background: #121212; display: flex; align-items: center; justify-content: center; }
.prism-theme-strip::after { content: ""; position: absolute; inset: 0; z-index: 2; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.22); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15); pointer-events: none; }
.prism-theme-strip-none { font-size: 12px; color: rgba(255, 255, 255, 0.55); }

/* ----- Organize review (step 13c) -----
   Group cards lift a little on hover; the x button is glass. */
.prism-group-card { transition: transform 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out; }
/* Hover = the two doors' look: pink edge, a soft pink glow inside, a lift. */
.prism-group-card:hover { transform: translateY(-2px); border-color: var(--prism-hover-rim); box-shadow: var(--prism-hover-glow); }
.prism-group-card:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
/* Remix "Not included" card: same glass card, but a dashed edge and less
   fill, so it reads as "not a playlist (yet)". */
.prism-glass-panel.prism-left-card { border-style: dashed; border-color: rgba(255, 255, 255, 0.35); background: rgba(255, 255, 255, 0.03); }
.prism-glass-panel.prism-left-card:hover { border-color: var(--prism-hover-rim); }
/* Remix's two doors ("Sort them for me" / "I'll pick the vibes"): lift on
   hover; the picked one gets a pink edge and a soft pink glow inside. */
.prism-door { transition: transform 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out; }
.prism-door:hover { transform: translateY(-2px); border-color: var(--prism-hover-rim); box-shadow: var(--prism-hover-glow); }
.prism-door.on, .prism-door.on:hover { border-color: var(--prism-picked); box-shadow: var(--prism-picked-glow); }
.prism-door:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .prism-door, .prism-door:hover { transition: none; transform: none; } }
/* Start page: the wide glass bar under the flip tiles (Merge playlists,
   mockup "B"). A clickable card: same glass as the tiles, standard hover + lift. */
.prism-home-bar {
  display: flex; align-items: center; gap: 14px; width: 100%; min-height: 64px; box-sizing: border-box;
  padding: 10px 18px; border-radius: 16px; text-align: left; color: #ffffff; cursor: pointer; font: inherit;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: var(--prism-glass-panel);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(12px);
  transition: transform 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out;
}
.prism-home-bar:hover { transform: translateY(-2px); border-color: var(--prism-hover-rim); box-shadow: var(--prism-hover-glow); }
.prism-home-bar:active { transform: scale(0.97); }
.prism-home-bar:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
/* The bar's one line shows only on hover/focus (developer's wish, 2026-11-25):
   it fades in with a small slide, like the flip tiles' hover line. Its space
   stays reserved, so nothing moves. */
.prism-home-bar-text { opacity: 0; transform: translateX(-6px); transition: opacity 250ms, transform 250ms; }
.prism-home-bar:hover .prism-home-bar-text, .prism-home-bar:focus-visible .prism-home-bar-text { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .prism-home-bar, .prism-home-bar:hover, .prism-home-bar:active, .prism-home-bar-text { transition: none; transform: none; } }
/* "Start from scratch" builder (step 13c-2). The chosen group in the list
   gets a lavender edge; genre/mood labels are buttons you turn on and off
   (on = the bright .shared look). Moods have a dashed edge. */
.prism-builder-group { transition: border-color 150ms ease-out, background 150ms ease-out, box-shadow 150ms ease-out, transform 150ms ease-out; }
.prism-builder-group:hover { transform: translateY(-2px); border-color: var(--prism-hover-rim); box-shadow: var(--prism-hover-glow); }
.prism-builder-group.on, .prism-builder-group.on:hover { border-color: var(--prism-picked); box-shadow: var(--prism-picked-glow); }
.prism-builder-group:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
.prism-tag-pick { font-family: inherit; cursor: pointer; transition: background 150ms ease-out, border-color 150ms ease-out, color 150ms ease-out, box-shadow 150ms ease-out; }
.prism-tag.prism-tag-pick:hover { color: #ffffff; border-color: var(--prism-hover-rim); box-shadow: var(--prism-hover-glow); }
.prism-tag-pick:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 1px; }
/* 3 classes, so it beats .prism-tag.shared further down this file. */
.prism-tag.prism-tag-pick.shared { background: rgba(205, 184, 255, 0.3); border-color: #cdb8ff; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 0 10px rgba(205, 184, 255, 0.35); }
.prism-tag.mood { border-style: dashed; }
/* The seed screen's tag switches are the main thing there: a bigger pill.
   Off = faint with a dimmed dot. */
.prism-tag.prism-tag-big { font-size: 13px; line-height: 20px; padding: 4px 12px; gap: 7px; }
.prism-tag.prism-tag-big::before { width: 8px; height: 8px; }
.prism-tag-pick:not(.shared)::before { opacity: 0.45; box-shadow: none; }
.prism-tag-pick.shared.mood { border-style: dashed; }
.prism-glass-input::placeholder { color: rgba(255, 255, 255, 0.5); }
.prism-tag-count { font-weight: 400; opacity: 0.6; }
/* Glass drop-down menu (src/ui/GlassMenu.tsx). */
.prism-menu-button {
  display: inline-flex; align-items: center; gap: 6px;
  max-width: 260px; padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px; font-weight: 600; color: #ffffff;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05));
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  cursor: pointer; white-space: nowrap;
  transition: border-color 150ms ease-out, background 150ms ease-out, box-shadow 150ms ease-out;
}
.prism-menu-button span:first-child { overflow: hidden; text-overflow: ellipsis; }
.prism-menu-button:hover, .prism-menu-button[aria-expanded="true"] { border-color: var(--prism-hover-rim); background: var(--prism-glass-control-hover); box-shadow: var(--prism-hover-glow); }
.prism-menu-button:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
.prism-menu-chevron { font-size: 10px; opacity: 0.8; }
.prism-menu-list {
  max-height: 240px; overflow-y: auto;
  padding: 6px;
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(70, 40, 120, 0.82), rgba(40, 20, 70, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 14px 34px rgba(10, 0, 30, 0.55);
  backdrop-filter: blur(16px) saturate(140%);
  animation: prism-fade 120ms ease-out;
}
.prism-menu-option {
  padding: 7px 12px; border-radius: 9px;
  font-size: 13px; color: #ffffff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  cursor: pointer;
}
.prism-menu-option.active { background: rgba(205, 184, 255, 0.28); }

.prism-icon-button {
  width: 28px; height: 28px; flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  font-size: 16px; line-height: 1;
  cursor: pointer;
  transition: border-color 150ms ease-out, background 150ms ease-out, box-shadow 150ms ease-out;
}
.prism-icon-button:hover { border-color: var(--prism-hover-rim); background: rgba(255, 255, 255, 0.12); box-shadow: var(--prism-hover-glow); }
.prism-icon-button:active { transform: scale(0.97); }
.prism-icon-button:focus-visible { outline: 2px solid var(--prism-accent-soft); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) { .prism-group-card, .prism-group-card:hover { transition: none; transform: none; } }

/* ----- Liquid-glass popup (e.g. "Name your playlist") -----
   .prism-overlay dims and blurs the screen behind; .prism-glass-card is the
   floating glass card: see-through white gradient, strong blur of what's
   behind it, a thin light border, a bright top edge and a soft shadow. */
.prism-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(20, 8, 40, 0.45);
  backdrop-filter: blur(6px);
  animation: prism-fade 180ms ease-out;
}
.prism-glass-card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px;
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.05));
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 20px 50px rgba(10, 0, 30, 0.5);
  backdrop-filter: blur(18px) saturate(140%);
  animation: prism-rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
/* Wide pop-up (approved 2026-11-24 with the tone editor pop-up): for a whole
   editor, not a quick question. Same glass, up to 760px wide. */
.prism-glass-card.is-wide { width: min(760px, calc(100% - 48px)); max-height: calc(100% - 48px); box-sizing: border-box; }
.prism-glass-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 15px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);
  outline: none;
}
.prism-glass-input:focus {
  border-color: #cdb8ff;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25), 0 0 0 3px rgba(205, 184, 255, 0.25);
}
/* Number boxes: no browser up/down spinner (grey, can't be themed; developer's
   pick "A"). Typing, arrow keys and the scroll wheel still change the number. */
/* Multi-line text box (approved 2026-11-25 with the report form, mockup "B"):
   the text box's look, taller, grows by dragging its bottom edge only. */
.prism-glass-input.is-multiline { font-family: inherit; font-size: 14px; line-height: 1.45; resize: vertical; min-height: 44px; }
.prism-glass-input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
.prism-glass-input[type="number"]::-webkit-inner-spin-button,
.prism-glass-input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* ----- Glass panels and bars (playlist stats page) -----
   .prism-glass-panel: a still glass box (like the popup card, no animation).
   .prism-bar-track / -fill: a frosted track with a glossy bar in the genre's
   colour (--tag). Bars grow in from the left, one after another (--delay). */
.prism-glass-panel {
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.04));
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(12px);
}
.prism-bar-track {
  display: block;
  height: 14px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}
@keyframes prism-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.prism-bar-fill {
  display: block;
  height: 100%;
  border-radius: 7px;
  /* color-mix: the genre colour with some transparency, for a glassy look. */
  background: linear-gradient(90deg, color-mix(in srgb, var(--tag) 85%, transparent), color-mix(in srgb, var(--tag) 40%, transparent));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 0 10px color-mix(in srgb, var(--tag) 35%, transparent);
  transform-origin: left center;
  animation: prism-grow 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: var(--delay, 0ms);
}

/* The fingerprint's glass bubbles float up and down a little, each at its
   own moment (delays are set per bubble). */
@keyframes prism-bubble-float { 50% { transform: translateY(-2px); } }
.prism-bubble { animation: prism-bubble-float 4s ease-in-out infinite; }
/* The wobble: a slight stretch back and forth from the bubble's own centre. */
.prism-bubble-wobble { transform-box: fill-box; transform-origin: center; animation: prism-bubble-wobble 3s ease-in-out infinite; }
@keyframes prism-bubble-wobble {
  0%, 100% { transform: scale(1, 1); }
  25% { transform: scale(1.03, 0.97); }
  50% { transform: scale(0.98, 1.02); }
  75% { transform: scale(1.02, 0.99); }
}
/* The pop's droplet spray: each droplet flies out along --dx/--dy, falls a
   little, shrinks and fades. */
.prism-drop-bit {
  opacity: 0;
  pointer-events: none;
  transform-box: fill-box;
  transform-origin: center;
  animation: prism-drop-fly 650ms ease-out forwards;
}
@keyframes prism-drop-fly {
  0%   { transform: translate(0, 0) scale(0.4); opacity: 0; }
  15%  { opacity: 0.95; }
  100% { transform: translate(var(--dx), calc(var(--dy) + 6px)) scale(0.6); opacity: 0; }
}

/* Popping a bubble (src/ui/Fingerprint.tsx). The body grows from its own
   centre (fill-box): "popping" softly swells and fades, "gone" stays hidden,
   "back" floats in from small. Meanwhile droplets spray out and fall
   (.prism-drop-bit, above). */
.prism-bubble-body {
  cursor: pointer;
  outline: none;
  transform-box: fill-box;
  transform-origin: center;
}
.prism-bubble-body:focus-visible circle { stroke: #ffffff; stroke-opacity: 1; stroke-width: 1.2; }
.prism-bubble-body.is-popping { animation: prism-bubble-pop 140ms ease-out forwards; pointer-events: none; }
.prism-bubble-body.is-gone { opacity: 0; pointer-events: none; }
.prism-bubble-body.is-back { animation: prism-bubble-back 600ms cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes prism-bubble-pop {
  0%   { transform: scale(1); opacity: 1; }
  40%  { transform: scale(1.06); opacity: 0.6; }
  100% { transform: scale(1.1); opacity: 0; }
}
@keyframes prism-bubble-back {
  from { transform: scale(0.2) translateY(6px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}

/* ----- Genre labels in the preview list: frosted glass + a colour dot -----
   The label itself is clear frosted glass (see-through white, a blur of
   what's behind, a bright top edge); the genre's colour is only in the small
   glowing dot (::before), set per label with the --tag variable.
   .shared = a tag the seed has too (brighter); others are fainter. */
.prism-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  /* 17px (not 18): with this font at 11px, capitals are 8px tall and
     lowercase 6px, on one baseline. A 17px line puts the pill's middle exactly
     between the two (so "r&b" and "hip hop" both look centred) AND keeps the
     baseline on a whole pixel, so the text stays sharp. Measured in Spotify. */
  line-height: 17px;
  white-space: nowrap;
  color: var(--spice-subtext);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
}
.prism-tag::before {
  content: "";
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--tag);
  box-shadow: 0 0 6px var(--tag);
  flex-shrink: 0;
}
/* A genre label next to a bar: a long name wraps onto two lines inside its
   pill instead of being cut off ("female vocalist"). */
.prism-tag.wrap { white-space: normal; border-radius: 10px; line-height: 14px; padding: 3px 9px; }
.prism-tag.shared {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

/* ----- Scanning icon: the Prism star in a filling rainbow ring -----
   (ScanningPrism, mockup "D"). The star gently grows and shrinks (never
   turns), a soft glow breathes behind it, two sparkles twinkle, and the
   ring's arc follows the scan (stroke-dashoffset, eased). Before the count is
   known, a short arc circles round (.prism-scan-waiting). */
@keyframes prism-scan-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.07); }
}
@keyframes prism-scan-glow {
  0%, 100% { opacity: 0.35; transform: scale(0.9); }
  50%      { opacity: 0.8; transform: scale(1.15); }
}
@keyframes prism-scan-twinkle {
  0%, 100% { opacity: 0.3; transform: scale(0.55); }
  50%      { opacity: 1; transform: scale(1.15); }
}
@keyframes prism-scan-circle {
  to { transform: rotate(360deg); }
}
.prism-scan-star, .prism-scan-glow, .prism-scan-waiting {
  transform-box: view-box;
  transform-origin: 50% 50%;
}
.prism-scan-star { animation: prism-scan-breathe 2.4s ease-in-out infinite; }
.prism-scan-glow { animation: prism-scan-glow 2.4s ease-in-out infinite; }
.prism-scan-waiting { animation: prism-scan-circle 1.6s linear infinite; }
.prism-scan-ring { transition: stroke-dashoffset 0.4s ease-out; }
.prism-scan-sparkle {
  transform-box: fill-box;
  transform-origin: center;
  animation: prism-scan-twinkle 1.8s ease-in-out infinite;
}

/* ----- Start page: flip tiles (FlipTile.tsx, icons in HomeIcons.tsx) -----
   perspective: how "deep" the 3D turn looks (smaller = more dramatic).
   preserve-3d: the two faces turn together as one card.
   The hidden face also gets visibility: hidden (after the turn is half done)
   so Tab and screen readers skip it. */
.prism-flip { perspective: 1100px; height: 370px; }
.prism-flip-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 650ms cubic-bezier(0.2, 0.75, 0.25, 1);
}
.prism-flip.is-flipped .prism-flip-inner { transform: rotateY(180deg); }
.prism-flip-face {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.prism-flip-front { visibility: visible; transition: visibility 0s 0s; }
.prism-flip.is-flipped .prism-flip-front { visibility: hidden; transition: visibility 0s 320ms; }
.prism-flip-back {
  transform: rotateY(180deg);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 18px 14px;
  overflow-y: auto;
  visibility: hidden;
  transition: visibility 0s 320ms;
}
.prism-flip.is-flipped .prism-flip-back { visibility: visible; transition: visibility 0s 0s; }
/* The front: a glass button with the icon and label in the very centre. */
.prism-mode-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.04));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  color: #ffffff;
  cursor: pointer;
  transition: border-color 250ms, box-shadow 250ms;
}
/* The hover background: a pastel rainbow, blurred into a soft glow, slowly
   turning. It is a ::before layer (a pretend extra element made by CSS) so
   it can spin without spinning the icon. It waits, paused and invisible,
   until hover. */
.prism-mode-tile::before {
  content: "";
  position: absolute;
  inset: -45%;
  background: conic-gradient(from 0deg, #ffb3d1, #ffd6a5, #fdffb6, #caffbf, #9bf6ff, #bdb2ff, #ffc6ff, #ffb3d1);
  filter: blur(34px);
  opacity: 0;
  transition: opacity 400ms ease;
  animation: prism-tile-swirl 9s linear infinite;
  animation-play-state: paused;
}
.prism-mode-tile:hover, .prism-mode-tile:focus-visible {
  border-color: rgba(222, 205, 255, 0.85);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 0 26px rgba(205, 184, 255, 0.5);
  outline: none;
}
.prism-mode-tile:hover::before, .prism-mode-tile:focus-visible::before { opacity: 0.45; animation-play-state: running; }
@keyframes prism-tile-swirl { to { transform: rotate(360deg); } }
.prism-mode-tile .prism-star { visibility: hidden; z-index: 1; }
.prism-mode-tile:hover .prism-star, .prism-mode-tile:focus-visible .prism-star { visibility: visible; }
.prism-mode-center {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.prism-mode-icon { transition: transform 350ms cubic-bezier(0.3, 1.5, 0.5, 1); overflow: visible; }
/* Header icon sparkles: each one fades and shrinks away, then pops back
   (staggered by their animation-delay, so they twinkle in turn). */
.prism-head-sparkle { transform-box: fill-box; transform-origin: center; animation: prism-head-twinkle 3.2s ease-in-out infinite; }
@keyframes prism-head-twinkle {
  0%, 60%, 100% { opacity: 1; transform: scale(1); }
  75% { opacity: 0.2; transform: scale(0.4); }
  85% { opacity: 1; transform: scale(1.25); }
}
.prism-mode-icon-box { height: 180px; width: 100%; display: flex; align-items: center; justify-content: center; }
.prism-mode-tile:hover .prism-mode-icon, .prism-mode-tile:focus-visible .prism-mode-icon { transform: translateY(-4px) scale(1.07); }
/* Soft lavender with a faint lavender glow, to match the twilight theme. */
.prism-mode-label {
  font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #e9dcff;
  text-shadow: 0 0 14px rgba(205, 184, 255, 0.55);
}
/* The short line: under the label, fading up on hover. Positioned at the
   bottom so it never pushes the icon and label off centre. */
.prism-mode-tip {
  position: absolute;
  z-index: 1;
  left: 0;
  right: 0;
  bottom: 30px;
  padding: 0 20px;
  text-align: center;
  font-size: 13px;
  color: #f3e8ff;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 250ms, transform 250ms;
}
.prism-mode-tile:hover .prism-mode-tip, .prism-mode-tile:focus-visible .prism-mode-tip { opacity: 1; transform: none; }

/* The icons' little moving parts: paused until the tile is hovered. */
/* The icons' little moving parts run only while the tile has the class
   "is-animating". FlipTile.tsx adds it on hover/focus and, when the pointer
   leaves, lets every animation finish its current loop before removing it,
   so nothing freezes halfway. Each part's plain style below is its resting
   pose, which matches the start and end of its loop. */
.prism-ic-anim { transform-box: fill-box; transform-origin: center; }
/* Boombox + tapes. Speakers: the cone pulses and a ring ripples out on each
   beat. Notes fly
   out along their own --dx/--dy (CSS variables set per note
   in HomeIcons.tsx) and fade. Reels spin. The tapes shuffle and notes drop into the top one. */
.prism-ic-pulse { transform: scale(0.62); }
.prism-mode-tile.is-animating .prism-ic-pulse { animation: prism-ic-pulse 0.6s ease-in-out infinite; }
.prism-ic-ripple { opacity: 0; }
.prism-mode-tile.is-animating .prism-ic-ripple { animation: prism-ic-ripple 0.6s ease-out infinite; }
/* Tape shuffle (3.2 s loop): hold, move, hold swapped (40-75%), move back.
   Unlike the other parts, the shuffle is always there but PAUSED: FlipTile
   plays it on hover and, on leave, pauses it at the next still moment, so the
   tapes stay in whatever order they reached (no need to go back to pink on top).
   a = left tape -> right spot, b = right tape -> top, c = top tape -> left. */
.prism-ic-shuffle-a { animation: prism-ic-shuffle-a 3.2s ease-in-out infinite paused; }
.prism-ic-shuffle-b { animation: prism-ic-shuffle-b 3.2s ease-in-out infinite paused; }
.prism-ic-shuffle-c { animation: prism-ic-shuffle-c 3.2s ease-in-out infinite paused; }
@keyframes prism-ic-shuffle-a { 0%, 25%, 90%, 100% { transform: translate(0, 0); } 40%, 75% { transform: translate(46px, 0); } }
@keyframes prism-ic-shuffle-b { 0%, 25%, 90%, 100% { transform: translate(0, 0); } 40%, 75% { transform: translate(-23px, -32px); } }
@keyframes prism-ic-shuffle-c { 0%, 25%, 90%, 100% { transform: translate(0, 0); } 40%, 75% { transform: translate(-23px, 32px); } }
/* Notes dropping into the top tape (1.6 s loop = half the shuffle). */
.prism-ic-drop { opacity: 0; }
.prism-mode-tile.is-animating .prism-ic-drop { animation: prism-ic-drop 1.6s ease-in infinite; }
@keyframes prism-ic-drop {
  0%        { transform: translateY(-14px) rotate(-12deg); opacity: 0; }
  10%       { opacity: 1; }
  32%       { transform: translateY(11px) rotate(0deg) scale(0.9); opacity: 1; }
  42%, 100% { transform: translateY(16px) scale(0.3); opacity: 0; }
}
.prism-ic-fly { opacity: 0; }
.prism-mode-tile.is-animating .prism-ic-fly { animation: prism-ic-fly 1.6s ease-out infinite; }
.prism-mode-tile.is-animating .prism-ic-spin { animation: prism-ic-spin 2.4s linear infinite; }
@keyframes prism-ic-pulse { 0%, 100% { transform: scale(0.62); } 45% { transform: scale(1.12); } }
@keyframes prism-ic-ripple { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(1.9); opacity: 0; } }
@keyframes prism-ic-fly {
  0%   { transform: translate(0, 0) scale(0.5); opacity: 0; }
  15%  { opacity: 1; }
  /* Fully visible for most of the flight (like the tapes' notes), fading only at the end. */
  80%  { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1.05) rotate(12deg); opacity: 0; }
}
@keyframes prism-ic-spin { to { transform: rotate(360deg); } }
/* Start bar icons (HomeIcons.tsx: MergeIcon "Q1 bubbles", AddSongIcon "S1
   compass"). They run only while the bar has "is-animating" (StartBar.tsx,
   which lets the current loop finish on leave). Plain styles = resting pose =
   the start and end of every loop. */
.prism-bar-ic { transform-box: fill-box; transform-origin: center; }
.prism-bar-ic-joined { opacity: 0; }
.prism-bar-ic-needle { transform-box: view-box; transform-origin: 19px 20px; transform: rotate(20deg); }
.prism-bar-ic-sparkle { opacity: 0; }
.prism-home-bar.is-animating .prism-bar-ic-left { animation: prism-bar-left 2.4s ease-in-out infinite; }
.prism-home-bar.is-animating .prism-bar-ic-right { animation: prism-bar-right 2.4s ease-in-out infinite; }
.prism-home-bar.is-animating .prism-bar-ic-joined { animation: prism-bar-joined 2.4s ease-in-out infinite; }
.prism-home-bar.is-animating .prism-bar-ic-needle { animation: prism-bar-needle 2.6s ease-in-out infinite; }
.prism-home-bar.is-animating .prism-bar-ic-best { animation: prism-bar-best 2.6s ease-in-out infinite; }
.prism-home-bar.is-animating .prism-bar-ic-sparkle { animation: prism-bar-sparkle 2.6s ease-in-out infinite; }
@keyframes prism-bar-left { 0%, 15% { transform: translateX(0); opacity: 1; } 45% { transform: translateX(9px); opacity: 1; } 55%, 85% { transform: translateX(9px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
@keyframes prism-bar-right { 0%, 15% { transform: translateX(0); opacity: 1; } 45% { transform: translateX(-9px); opacity: 1; } 55%, 85% { transform: translateX(-9px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
@keyframes prism-bar-joined { 0%, 45% { opacity: 0; transform: scale(0.7); } 55%, 85% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
@keyframes prism-bar-needle { 0% { transform: rotate(20deg); } 22% { transform: rotate(150deg); } 40% { transform: rotate(65deg); } 55% { transform: rotate(100deg); } 65%, 90% { transform: rotate(90deg); } 100% { transform: rotate(20deg); } }
@keyframes prism-bar-best { 0%, 58%, 100% { fill-opacity: 0.5; } 68%, 90% { fill-opacity: 0.9; } }
@keyframes prism-bar-sparkle { 0%, 58%, 100% { opacity: 0; transform: scale(0.4); } 68%, 88% { opacity: 1; transform: scale(1); } }

/* ----- No Spotify top bar colour on Prism's page -----
   When a page is scrolled, Spotify fades in its sticky top bar, coloured from
   the LAST playlist's cover (a red band after a red cover). On Prism's page it
   stays clear (developer's pick), so the twilight sky shows through. The
   buttons in the bar (back/forward) stay. */
.Root__main-view:has(.prism-page) :is(.main-topBar-background, .main-topBar-overlay) {
  background: transparent !important;
  opacity: 0 !important;
}

/* ----- Full stats page: use the middle AND right-hand area -----
   Spotify's window is a grid: library | main view | right panel. While the
   Prism stats page is showing (data-prism-view="stats"), the main view is
   stretched over the right panel's column too, and the right panel is
   hidden. :has() lets this rule react to what's on the page, so it switches
   back by itself when you leave the stats page. The stats page also gets
   wider to use the room. */
.Root__top-container:has(.Root__main-view [data-prism-view="stats"]) .Root__main-view {
  grid-column: main-view-start / right-sidebar-end !important;
}
.Root__top-container:has(.Root__main-view [data-prism-view="stats"]) .Root__right-sidebar {
  display: none !important;
}
.prism-page[data-prism-view="stats"] { max-width: 1120px !important; }
/* Opening: the page grows out of the right panel's spot (clip-path shows
   only the right third at first, then opens up to the left) while fading
   in. Minimizing: the reverse, then the playlist page and its side panel
   appear (PrismPage waits MINIMIZE_MS = 380 ms). */
.prism-cosmos.is-wide-stats { animation: prism-stats-grow 480ms cubic-bezier(0.2, 0.8, 0.2, 1); }
/* Minimizing uses a still COPY of the page ("ghost", made in PrismPage)
   laid over the window while Spotify opens the playlist underneath. The
   ghost only moves and fades (transform + opacity): the browser keeps
   animating those even while Spotify is busy building its page, so the
   shrink stays smooth and the playlist is revealed, never a black screen.
   The movement itself ("morph into the panel": shrink to exactly the side
   panel's spot and fade into it) is worked out in PrismPage, because the
   panel's position depends on the window size. */
.prism-ghost {
  pointer-events: none;
  transform-origin: 0 0;
  will-change: transform, opacity;
}
.prism-cosmos.is-leaving .prism-page { opacity: 0 !important; }
@keyframes prism-stats-grow {
  from { clip-path: inset(0 0 0 66% round 8px); opacity: 0.4; }
  to { clip-path: inset(0 0 0 0 round 8px); opacity: 1; }
}
/* The side panel's stats fade in each time they appear (meeting the
   stats page as it morphs into this spot). */
[data-prism="panel-stats"] { animation: prism-panel-in 260ms ease-out; }
@keyframes prism-panel-in {
  from { opacity: 0; transform: scale(0.985); }
  to { opacity: 1; transform: none; }
}
/* The playlist's cover on the stats page: one image, or Spotify's 2x2
   mosaic of album covers, inside a moving neon ring.

   How the ring moves: --prism-ring-angle is a REGISTERED custom property
   (@property says it's an <angle>), so the browser can animate it smoothly
   from 0deg to 360deg. The ring's colours are a conic gradient (colours laid
   round a centre, like a colour wheel) that STARTS at that angle, so as the
   angle turns, every colour slides round the border. On top, a white
   "comet" of light chases round with it. */
${RING_ANGLE_PROPERTY}
.prism-artwork {
  position: relative;
  isolation: isolate; /* keeps the glow (z-index -1) behind the cover, not behind the page */
  width: 120px;
  height: 120px;
  flex-shrink: 0;
  align-self: center; /* centred in the title row, like the title beside it */
  border-radius: 15px;
  display: grid;
  padding: 3px; /* the visible width of the neon ring */
  animation: prism-ring-turn 3.5s linear infinite;
}
/* The ring itself, on its own layer so it can be blurred a little: a slight
   blur(1.5px) feathers its outer and inner edges, so you see a soft band of
   light instead of a crisp pixel edge. (Both layers sit behind the images:
   negative z-index inside .prism-artwork, which "isolates" them.) */
.prism-artwork::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 15px;
  background: ${RING_GLINT}, ${RING_RAINBOW};
  filter: blur(1.5px);
  opacity: 0.9;
}
/* The glow: the same colours, blurred, just outside the ring, so the glow's
   colour travels round too. */
.prism-artwork::before {
  content: "";
  position: absolute;
  inset: -4px;
  z-index: -1;
  border-radius: 18px;
  background: ${RING_RAINBOW};
  filter: blur(12px);
  opacity: 0.7;
}
.prism-artwork img { width: 100%; height: 100%; object-fit: cover; display: block; }.prism-artwork:not(.mosaic) img { border-radius: 12px; }
.prism-artwork.mosaic { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.prism-artwork.mosaic img:nth-child(1) { border-top-left-radius: 12px; }
.prism-artwork.mosaic img:nth-child(2) { border-top-right-radius: 12px; }
.prism-artwork.mosaic img:nth-child(3) { border-bottom-left-radius: 12px; }
.prism-artwork.mosaic img:nth-child(4) { border-bottom-right-radius: 12px; }

/* A glass pill button for places outside Spotify's own buttons (the side
   panel's "View full stats", the stats page's "Back to playlist"). It looks
   exactly like the secondary button: 32px, glass, the standard hover. */
.prism-glass-button {
  height: 32px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid var(--prism-rim);
  background: var(--prism-glass-control);
  box-shadow: var(--prism-shine), 0 2px 10px rgba(10, 0, 30, 0.25);
  backdrop-filter: blur(10px);
  color: #ffffff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out, transform 100ms ease-out;
}
.prism-glass-button:hover {
  background: var(--prism-glass-control-hover);
  border-color: var(--prism-hover-rim);
  box-shadow: var(--prism-hover-glow);
}
.prism-glass-button:active { transform: scale(0.97); }
.prism-glass-button:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }



/* The page content sits above the background layer. */
.prism-cosmos > .prism-page { position: relative; z-index: 1; }

/* Accessibility: people who turn off animations in Windows get none. */
@media (prefers-reduced-motion: reduce) {
  .prism-blob, .prism-wave { animation: none !important; }
  .prism-star { animation: none !important; opacity: 0.6; }
  .prism-scan-star, .prism-scan-glow, .prism-scan-sparkle, .prism-scan-waiting { animation: none !important; }
  .prism-scan-ring { transition: none; }
  .prism-page, .prism-fade-in, .prism-overlay, .prism-glass-card, .prism-bar-fill, .prism-bubble, .prism-bubble-wobble, .prism-bubble-body.is-back { animation: none; }
  /* Popping still works, just without the swell: the bubble disappears at once. */
  .prism-bubble-body.is-popping { animation: none; opacity: 0; }
  .prism-drop-bit { display: none; }
  .prism-cosmos.is-wide-stats, .prism-ghost, [data-prism="panel-stats"], .prism-artwork, .prism-head-sparkle { animation: none; }
  /* Start page tiles: swap faces without the turn, and keep the hover glow still. */
  .prism-flip-inner, .prism-mode-icon { transition: none; }
  .prism-mode-tile::before, .prism-ic-anim, .prism-bar-ic { animation: none !important; }
  .prism-spinner { animation-duration: 2400ms; }
}

/* ----- Grow preview: NEW FINDS (songs not from the user's playlists) -----
   Developer's pick: mint glass row ("S2") + a "New find" pill + sparkles
   twinkling round the score ring ("S1"). */
.prism-new-find {
  background: linear-gradient(90deg, rgba(159, 225, 203, 0.16), rgba(159, 225, 203, 0.07)) !important;
  border: 1px solid rgba(159, 225, 203, 0.5) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  margin: 2px 0;
}
.prism-new-find:hover { border-color: rgba(159, 225, 203, 0.85) !important; }
.prism-new-pill {
  display: inline-flex; align-items: center; gap: 3px; vertical-align: 1px; margin-left: 6px;
  padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 18px;
  color: #d7fff2; background: rgba(159, 225, 203, 0.2); border: 1px solid rgba(159, 225, 203, 0.75);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
`;

// Adds the styles once (safe to call again: it checks first).
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS + PRISM_STAR_CSS;
  document.head.appendChild(style);
}
