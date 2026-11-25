// The moving pastel neon ring's colours ("Cover ring" in docs/ui-elements.md).
// Shared by the stats page's cover (.prism-artwork in styles.ts) and the
// profile avatar on themed profile pages (playlistTheme.ts), which are
// separate bundles, so the ring looks the same in both.
// Both start at --prism-ring-angle, which the ring animates 0 -> 360deg.
export const RING_RAINBOW =
  "conic-gradient(from var(--prism-ring-angle), #ff8fc6, #ffd98a, #86e8b8, #8ec5ff, #c3a6ff, #f59cf0, #ff8fc6)";
// The white "comet" of light that chases round on top of the colours.
export const RING_GLINT =
  "conic-gradient(from var(--prism-ring-angle), transparent 0 70%, rgba(255, 255, 255, 0.7) 84%, transparent 94%)";
// Registers the angle so the browser can animate it (needed once per bundle's CSS).
export const RING_ANGLE_PROPERTY = `@property --prism-ring-angle { syntax: "<angle>"; inherits: true; initial-value: 0deg; }
@keyframes prism-ring-turn { to { --prism-ring-angle: 360deg; } }`;
