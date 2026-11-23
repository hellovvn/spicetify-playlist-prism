// Hover effect for Playlist Prism's diamond icon in Spotify's header.
//
// Spicetify draws the icon itself (from src/assets/prism.svg), so we can't
// add React code to it. Instead this adds a <style> tag that targets the
// icon's button by its label. The SVG has two groups with our own class names:
//   .prism-gem       the faceted pyramid diamond: turns around (like a coin spin);
//                    no colour change or glow (the developer preferred it plain)
//   .prism-ray       12 rainbow stars in a ring ("star halo"): hidden, they shine
//                    on hover with a shimmer travelling round
//   .prism-ring      a thin pastel rainbow circle round it all: hidden, it
//                    fades in on hover (it stays still, so its edge stays crisp)
// The round button always has a purple twilight background with a sweeping
// rainbow band.
//
// This runs from the always-on script (src/extensions/prism.tsx), because the
// header icon is visible on every page, not only on the Prism page.

const STYLE_ID = "playlist-prism-header-icon";
const BUTTON = 'button[aria-label="Prism"]';
const HOVER = [`${BUTTON}:hover`, `${BUTTON}:focus-visible`];
// Both selectors for one rule, e.g. on(" .prism-gem") ->
// "button[...]:hover .prism-gem, button[...]:focus-visible .prism-gem"
const on = (rest: string) => HOVER.map((h) => h + rest).join(",\n");

// Must match the number of rays in src/assets/prism.svg.
const RAY_COUNT = 12;

const CSS = `
@keyframes prism-icon-turn {
  0%   { transform: scaleX(1); }
  50%  { transform: scaleX(-1); }
  100% { transform: scaleX(1); }
}

/* overflow: visible lets the rays reach past the icon's square box. */
${BUTTON} svg { overflow: visible; }

/* The round button always has the Prism page's twilight look: a purple
   gradient with a soft rainbow band slowly sweeping across. Both are drawn
   on ::before, 2 px INSIDE the button: Spotify's header strip is exactly as
   tall as the button and trims its outermost pixels, which flattened the
   circle's edges. The button's own (grey) background is switched off.
   !important: Spotify sets its own grey (and hover grey) on header buttons. */
${BUTTON},
${BUTTON}:hover {
  background: transparent !important;
  color: #ffffff !important;
}
@keyframes prism-icon-band {
  0%, 100% { background-position: 0% 50%, 0 0; }
  50%      { background-position: 100% 50%, 0 0; }
}
${BUTTON}::before {
  content: "";
  position: absolute;
  inset: 2px;
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
/* Keep the diamond above the rainbow band. */
${BUTTON} > span { position: relative; z-index: 1; }

/* transform-box/origin: turn the diamond around its OWN centre (SVG shapes
   otherwise turn around the corner of the picture). */
${BUTTON} .prism-gem {
  transform-box: fill-box;
  transform-origin: center;
}
/* The diamond keeps its normal colour (no glow) and turns around. */
${on(" .prism-gem")} {
  animation: prism-icon-turn 1.4s ease-in-out infinite;
}

/* Star halo round the diamond: hidden at rest. On hover ALL stars show, each
   one swelling and brightening in turn, so a shine travels round the ring
   ("travelling shimmer"). Negative delays start each star mid-pulse, so the
   whole ring is lit from the first moment (no sweep-in).
   transform-box fill-box + origin center: each star grows from its own
   middle. */
@keyframes prism-icon-ray {
  0%, 100% { opacity: 0.35; transform: scale(0.55); }
  50%       { opacity: 1; transform: scale(1.15); }
}
${BUTTON} .prism-ray {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
}
${Array.from({ length: RAY_COUNT }, (_, i) => `${on(` .prism-ray:nth-child(${i + 1})`)} {
  animation: prism-icon-ray 1.8s ease-in-out ${(-(i * 1.8) / RAY_COUNT).toFixed(2)}s infinite;
}`).join("\n")}

/* The thin rainbow ring (drawn in the SVG as a real circle). Hidden at rest;
   on hover it fades in. It does NOT turn: on a normal-density screen a thin
   turning circle gets re-drawn onto slightly different pixels every frame,
   which looks choppy. Standing still, its 1 px edge stays crisp. */
${BUTTON} .prism-ring {
  opacity: 0;
  transition: opacity 200ms ease-out;
}
${on(" .prism-ring")} { opacity: 1; }

/* People who turn off animations get the rays and the ring, no motion. */
@media (prefers-reduced-motion: reduce) {
  ${BUTTON}::before { animation: none; background-position: 50% 50%, 0 0; }
  ${on(" .prism-gem")} { animation: none; }
  ${on(" .prism-ray")} { animation: none !important; opacity: 0.8; }
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
