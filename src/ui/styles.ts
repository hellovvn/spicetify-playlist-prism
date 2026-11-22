// Global CSS for the Playlist Prism page: fade-in, spinner.
//
// Why a <style> tag instead of inline styles? Animations need @keyframes
// and selectors, which inline style={{...}} can't express.
// Everything is scoped to our own class names (prism-...), so Spotify's
// other pages are never affected.

const STYLE_ID = "playlist-prism-styles";

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
  border-radius: 6px;
  background: var(--spice-card);
  color: var(--spice-text);
}
.prism-notice::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  border-radius: 3px;
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
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(205, 184, 255, 0.1)) !important;
  border-color: rgba(205, 184, 255, 0.7) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 0 12px rgba(205, 184, 255, 0.35) !important;
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

/* ----- Organize review (step 13c) -----
   Group cards lift a little on hover; the x button is glass. */
.prism-group-card { transition: transform 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out; }
.prism-group-card:hover { transform: translateY(-2px); border-color: rgba(205, 184, 255, 0.6); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 8px 24px rgba(10, 0, 30, 0.35); }
.prism-group-card:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
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
  transition: border-color 150ms ease-out, background 150ms ease-out;
}
.prism-menu-button span:first-child { overflow: hidden; text-overflow: ellipsis; }
.prism-menu-button:hover, .prism-menu-button[aria-expanded="true"] { border-color: rgba(205, 184, 255, 0.7); background: linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(205, 184, 255, 0.1)); }
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
}
.prism-icon-button:hover { border-color: rgba(255, 179, 209, 0.8); background: rgba(255, 179, 209, 0.15); }

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

/* Popping a bubble (src/ui/Fingerprint.tsx). The body grows from its own
   centre (fill-box): "popping" softly swells and fades, "gone" stays hidden,
   "back" floats in from small. Meanwhile a shower of translucent sparkles
   appears, drifts apart (--dx/--dy), tilts (--sway) and slowly floats down. */
.prism-bubble-body {
  cursor: pointer;
  outline: none;
  transform-box: fill-box;
  transform-origin: center;
}
.prism-bubble-body:focus-visible circle { stroke: #ffffff; stroke-opacity: 1; stroke-width: 1.2; }
.prism-bubble-body.is-popping { animation: prism-bubble-pop 380ms ease-out forwards; pointer-events: none; }
.prism-bubble-body.is-gone { opacity: 0; pointer-events: none; }
.prism-bubble-body.is-back { animation: prism-bubble-back 600ms cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes prism-bubble-pop {
  0%   { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.12); opacity: 0; }
}
@keyframes prism-bubble-back {
  from { transform: scale(0.2) translateY(6px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}
.prism-sparkle-bit {
  opacity: 0;
  pointer-events: none;
  transform-box: fill-box;
  transform-origin: center;
  animation: prism-sparkle-drift 1900ms cubic-bezier(0.25, 0.6, 0.35, 1) forwards;
}
@keyframes prism-sparkle-drift {
  0%   { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 0; }
  18%  { transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) scale(1) rotate(calc(var(--sway) * 0.3)); opacity: 0.6; }
  55%  { transform: translate(var(--dx), calc(var(--dy) + 4px)) scale(0.9) rotate(var(--sway)); opacity: 0.5; }
  100% { transform: translate(var(--dx), calc(var(--dy) + 14px)) scale(0.4) rotate(calc(var(--sway) * 1.6)); opacity: 0; }
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
.prism-tag.shared {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

/* ----- Scanning animation: a big diamond with a rainbow star halo -----
   The stars swell and brighten one after another (a shimmer travelling
   round the ring), and the diamond gently grows and shrinks. */
@keyframes prism-scan-ray {
  0%, 100% { opacity: 0.35; transform: scale(0.55); }
  50%      { opacity: 1; transform: scale(1.15); }
}
@keyframes prism-scan-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.06); }
}
.prism-scan-ray {
  /* Each star swells from its own middle. */
  transform-box: fill-box;
  transform-origin: center;
  animation: prism-scan-ray 1.8s ease-in-out infinite;
}
.prism-scan-gem {
  transform-box: view-box;
  transform-origin: 50% 50%;
  animation: prism-scan-breathe 2.4s ease-in-out infinite;
}

/* The page content sits above the background layer. */
.prism-cosmos > .prism-page { position: relative; z-index: 1; }

/* Accessibility: people who turn off animations in Windows get none. */
@media (prefers-reduced-motion: reduce) {
  .prism-blob, .prism-wave { animation: none !important; }
  .prism-star { animation: none !important; opacity: 0.6; }
  .prism-scan-ray, .prism-scan-gem { animation: none !important; }
  .prism-page, .prism-fade-in, .prism-overlay, .prism-glass-card, .prism-bar-fill, .prism-bubble, .prism-bubble-body.is-back { animation: none; }
  /* Popping still works, just without the swell: the bubble disappears at once. */
  .prism-bubble-body.is-popping { animation: none; opacity: 0; }
  .prism-sparkle-bit { display: none; }
  .prism-spinner { animation-duration: 2400ms; }
}
`;

// Adds the styles once (safe to call again: it checks first).
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
