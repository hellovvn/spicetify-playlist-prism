// Look and hover effect for Playlist Prism's diamond icon in Spotify's header.
//
// Spicetify draws the icon itself (from src/assets/prism.svg), so we can't
// add React code to it. Instead this adds a <style> tag that targets the
// icon's button by its label. The SVG has two groups with our own class names:
//   .prism-gem       the see-through glass diamond with a pastel rainbow edge
//                    (same look as the page header icon): turns around on hover
//                    (like a coin spin)
//   .prism-sparkle   3 little sparkles round the diamond that always twinkle,
//                    one after another (outside .prism-gem, so they don't spin)
// The round button has a purple twilight background with a sweeping rainbow
// band, inside a MOVING pastel neon ring: the same ring as the album cover on
// the stats page (.prism-artwork in src/ui/styles.ts). It glows brighter on
// hover.
//
// This runs from the always-on script (src/extensions/prism.tsx), because the
// header icon is visible on every page, not only on the Prism page.

const STYLE_ID = "playlist-prism-header-icon";
const BUTTON = 'button[aria-label="Prism"]';
const HOVER = [`${BUTTON}:hover`, `${BUTTON}:focus-visible`];
// Both selectors for one rule, e.g. on(" .prism-gem") ->
// "button[...]:hover .prism-gem, button[...]:focus-visible .prism-gem"
const on = (rest: string) => HOVER.map((h) => h + rest).join(",\n");

// The neon ring's colours, in the same order as the album cover ring.
const NEON = "#ff8fc6, #ffd98a, #86e8b8, #8ec5ff, #c3a6ff, #f59cf0, #ff8fc6";

const CSS = `
@keyframes prism-icon-turn {
  0%   { transform: scaleX(1); }
  50%  { transform: scaleX(-1); }
  100% { transform: scaleX(1); }
}

/* overflow: visible lets the sparkles reach past the icon's square box. */
${BUTTON} svg { overflow: visible; }

/* The button's own (grey) background is switched off.
   !important: Spotify sets its own grey (and hover grey) on header buttons.
   isolation: isolate keeps the neon ring (z-index -1) behind the button's
   contents but in front of Spotify's header. */
${BUTTON},
${BUTTON}:hover {
  background: transparent !important;
  color: #ffffff !important;
  isolation: isolate;
}

/* The purple circle: the Prism page's twilight look, a purple gradient with
   a soft rainbow band slowly sweeping across. It sits 4 px INSIDE the button,
   so the neon ring shows round it (and Spotify's header strip, which trims
   the button's outermost pixels, can't flatten the circle's edge). */
@keyframes prism-icon-band {
  0%, 100% { background-position: 0% 50%, 0 0; }
  50%      { background-position: 100% 50%, 0 0; }
}
${BUTTON}::before {
  content: "";
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  /* Two background layers: on top, a rainbow stripe on a layer 3x wider than
     the circle (moving its position slides the stripe across and back);
     underneath, the purple gradient, which stays put. */
  background:
    linear-gradient(110deg, transparent 35%, rgba(255, 150, 200, 0.28) 42%, rgba(255, 240, 150, 0.24) 48%, rgba(150, 240, 190, 0.24) 53%, rgba(140, 200, 255, 0.28) 58%, rgba(190, 160, 255, 0.28) 63%, transparent 70%),
    linear-gradient(135deg, #21143d 0%, #33195a 50%, #4d2270 80%, #6e2f7e 100%);
  background-size: 300% 100%, 100% 100%;
  animation: prism-icon-band 9s ease-in-out infinite;
  pointer-events: none;
}

/* The neon ring, like the album cover's: a disc of pastel colours BEHIND the
   purple circle, so only a thin band shows round its edge.
   How it moves: --prism-icon-angle is a REGISTERED custom property (@property
   says it's an <angle>), so the browser can animate it from 0deg to 360deg.
   The colours are a conic gradient (laid round the centre like a colour
   wheel) that starts at that angle, so every colour slides round the ring.
   On top, a white glint chases round with it. blur(0.8px) softens the band's
   edges into light instead of a crisp line. */
@property --prism-icon-angle {
  syntax: "<angle>";
  inherits: true;
  initial-value: 0deg;
}
@keyframes prism-icon-ring-turn {
  to { --prism-icon-angle: 360deg; }
}
${BUTTON}::after {
  content: "";
  position: absolute;
  inset: 2px;
  z-index: -1;
  border-radius: 50%;
  background:
    conic-gradient(from var(--prism-icon-angle), transparent 0 70%, rgba(255, 255, 255, 0.7) 84%, transparent 94%),
    conic-gradient(from var(--prism-icon-angle), ${NEON});
  filter: blur(0.8px);
  opacity: 0.75;
  animation: prism-icon-ring-turn 3.5s linear infinite;
  transition: opacity 200ms ease-out, filter 200ms ease-out;
  pointer-events: none;
}
/* Hover: the ring lights up fully and glows a little. */
${on("::after")} {
  opacity: 1;
  filter: blur(0.8px) brightness(1.15) saturate(1.2);
}

/* Keep the diamond above the purple circle and its rainbow band. */
${BUTTON} > span { position: relative; z-index: 1; }

/* transform-box/origin: turn the diamond around its OWN centre (SVG shapes
   otherwise turn around the corner of the picture). */
${BUTTON} .prism-gem {
  transform-box: fill-box;
  transform-origin: center;
}
${on(" .prism-gem")} {
  animation: prism-icon-turn 1.4s ease-in-out infinite;
}

/* Sparkles: each one fades and shrinks away, then pops back. The delays
   stagger them so they twinkle in turn. */
@keyframes prism-icon-twinkle {
  0%, 60%, 100% { opacity: 1; transform: scale(1); }
  75% { opacity: 0.2; transform: scale(0.4); }
  85% { opacity: 1; transform: scale(1.25); }
}
${BUTTON} .prism-sparkle {
  transform-box: fill-box;
  transform-origin: center;
  animation: prism-icon-twinkle 3.2s ease-in-out infinite;
}
${BUTTON} .prism-sparkle:nth-child(2) { animation-delay: -1.2s; }
${BUTTON} .prism-sparkle:nth-child(3) { animation-delay: -2.2s; }

/* People who turn off animations get the same look, standing still. */
@media (prefers-reduced-motion: reduce) {
  ${BUTTON}::before { animation: none; background-position: 50% 50%, 0 0; }
  ${BUTTON}::after { animation: none; }
  ${on(" .prism-gem")} { animation: none; }
  ${BUTTON} .prism-sparkle { animation: none; }
}
`;

// Adds the styles once (safe to call again: it checks first).
export function injectHeaderIconStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
