// Global CSS for Playlist Prism: popup open animation, fade-in, spinner.
//
// Why a <style> tag instead of inline styles? Animations need @keyframes
// and selectors, which inline style={{...}} can't express.
//
// The popup's outer box belongs to Spotify (classes GenericModal and
// GenericModal__overlay, checked in the running app). `:has([data-prism])`
// means "only when it contains Prism content", so other extensions' and
// Spotify's own popups are left alone.

const STYLE_ID = "playlist-prism-styles";

// Height of the popup's later screens (sources, scan, ...), so the popup keeps
// ONE size while you use it instead of jumping as content changes.
export const SCREEN_HEIGHT = 560;

const CSS = `
@keyframes prism-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes prism-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to   { opacity: 1; transform: none; }
}
@keyframes prism-spin { to { transform: rotate(360deg); } }

/* Background dims in, the box rises and grows slightly. */
.GenericModal__overlay:has([data-prism]) { animation: prism-fade 180ms ease-out; }
.GenericModal__overlay:has([data-prism]) .GenericModal {
  animation: prism-pop 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Content that arrives after loading fades in instead of popping. */
.prism-fade-in { animation: prism-fade 200ms ease-out; }

.prism-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid var(--spice-subtext);
  border-top-color: var(--spice-button);
  animation: prism-spin 800ms linear infinite;
}

/* Accessibility: people who turn off animations in Windows get none. */
@media (prefers-reduced-motion: reduce) {
  .GenericModal__overlay:has([data-prism]),
  .GenericModal__overlay:has([data-prism]) .GenericModal,
  .prism-fade-in { animation: none; }
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
