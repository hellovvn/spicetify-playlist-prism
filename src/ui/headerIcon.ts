// Look and hover effect for Prism's star icon in Spotify's header.
//
// Spicetify draws the icon itself (from src/assets/prism.svg), so we can't
// add React code to it. Instead this adds a <style> tag that targets the
// icon's button by its label. The SVG's parts have our own class names:
//   .prism-glow      a soft pastel glow behind the star, hidden until hover
//   .prism-mark      the Prism star (4-point star filled with the pastel
//                    rainbow, same as the page header icon and the app's
//                    .prism-star-icon). Never turns.
//   .prism-flow      a copy of the star whose rainbow slides along (SVG
//                    animateTransform on its gradient), hidden until hover
//   .prism-sparkle   3 little sparkles round the star that always twinkle,
//                    one after another (outside .prism-mark)
// Hover (mockup "C, colour-matched glow", developer's pick 2026-11-25): the
// flowing copy fades in, so the colours travel through the star, and the glow
// breathes behind it while cycling through the rainbow (hue-rotate).
// The round button has a purple twilight background with a sweeping rainbow
// band. No border ring (the moving neon ring was removed 2026-11-25,
// developer's request).
//
// This runs from the always-on script (src/extensions/prism.tsx), because the
// header icon is visible on every page, not only on the Prism page.

const STYLE_ID = "playlist-prism-header-icon";
const BUTTON = 'button[aria-label="Prism"]';
const HOVER = [`${BUTTON}:hover`, `${BUTTON}:focus-visible`];
// Both selectors for one rule, e.g. on(" .prism-glow") ->
// "button[...]:hover .prism-glow, button[...]:focus-visible .prism-glow"
const on = (rest: string) => HOVER.map((h) => h + rest).join(",\n");

const CSS = `
@keyframes prism-icon-glow {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50%      { opacity: 0.85; transform: scale(1.15); }
}
@keyframes prism-icon-hue {
  to { filter: hue-rotate(360deg); }
}

/* overflow: visible lets the sparkles reach past the icon's square box. */
${BUTTON} svg { overflow: visible; }

/* The button's own (grey) background is switched off.
   !important: Spotify sets its own grey (and hover grey) on header buttons.
   isolation: isolate keeps the purple circle behind the button's contents
   but in front of Spotify's header. */
${BUTTON},
${BUTTON}:hover {
  background: transparent !important;
  color: #ffffff !important;
  isolation: isolate;
}

/* The purple circle: the Prism page's twilight look, a purple gradient with
   a soft rainbow band slowly sweeping across. It sits 3 px INSIDE the button,
   so Spotify's header strip, which trims the button's outermost pixels,
   can't flatten the circle's edge. */
@keyframes prism-icon-band {
  0%, 100% { background-position: 0% 50%, 0 0; }
  50%      { background-position: 100% 50%, 0 0; }
}
${BUTTON}::before {
  content: "";
  position: absolute;
  inset: 3px;
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

/* Keep the star above the purple circle and its rainbow band. */
${BUTTON} > span { position: relative; z-index: 1; }

/* The glow grows and shrinks round its OWN centre (transform-box), not the
   picture's corner. Hidden until hover. */
${BUTTON} .prism-glow {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
}
${on(" .prism-glow")} {
  animation: prism-icon-glow 2.4s ease-in-out infinite, prism-icon-hue 2.4s linear infinite;
}
/* The flowing rainbow copy of the star fades in over the still one. */
${BUTTON} .prism-flow {
  opacity: 0;
  transition: opacity 400ms ease-out;
}
${on(" .prism-flow")} { opacity: 1; }

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
  ${on(" .prism-glow")} { animation: none; opacity: 0.6; }
  ${on(" .prism-flow")} { opacity: 0; }
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
