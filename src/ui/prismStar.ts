// The Prism star (look "A", developer's pick 2026-11-24): the old ✦ shape
// filled with the pastel rainbow, twinkling gently. Used wherever Prism marks
// something special: New finds and the "Tone" strip title.
// Markup: <span class="prism-star-icon" aria-hidden="true"></span>. It's 1em wide,
// so it follows the text size around it.
// The CSS is self-contained (own gradient, no page variables) because the
// Tone strip sits on Spotify's playlist page, outside Prism's page styles.

const STAR_SHAPE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><path d="M0-9C1-3 3-1 9 0C3 1 1 3 0 9C-1 3-3 1-9 0C-3-1-1-3 0-9Z"/></svg>`
  );

export const PRISM_STAR_CSS = `
.prism-star-icon {
  display: inline-block; flex: none; width: 1em; height: 1em; vertical-align: -0.12em;
  background: linear-gradient(135deg, #ffb3c7, #fff1a8 35%, #a8f0d8 65%, #b9b3ff);
  -webkit-mask: url("${STAR_SHAPE}") center / contain no-repeat;
  mask: url("${STAR_SHAPE}") center / contain no-repeat;
  animation: prism-star-twinkle 2.4s ease-in-out infinite;
}
@keyframes prism-star-twinkle {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.75); opacity: 0.7; }
}
@media (prefers-reduced-motion: reduce) { .prism-star-icon { animation: none; } }
`;

export const PRISM_STAR_HTML = `<span class="prism-star-icon" aria-hidden="true"></span>`;
