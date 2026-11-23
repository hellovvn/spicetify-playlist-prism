// The Prism diamond, drawn in React for use ON the page: a small one for the
// page header (PrismIcon, glass + rainbow edge + sparkles) and a big animated
// one while scanning (ScanningPrism, the same faceted diamond as the Spotify
// header icon, src/assets/prism.svg). Animations are in src/ui/styles.ts.

import React from "react";

// The diamond's lines (24x24 picture, centre 12,12). Shared by both icons.
// A "faceted pyramid": a straight-edged card diamond whose peak sits a little
// up and left of centre (11, 10.6), so its 4 faces catch the light
// differently. Each face has its own see-through fill: lit top-left,
// darkest bottom-left.
function Gem() {
  return (
    <>
      <path d="M12 2 11 10.6 4 12Z" fill="currentColor" fillOpacity={0.42} stroke="none" />
      <path d="M12 2 20 12 11 10.6Z" fill="currentColor" fillOpacity={0.2} stroke="none" />
      <path d="M4 12 11 10.6 12 22Z" fill="currentColor" fillOpacity={0.1} stroke="none" />
      <path d="M20 12 12 22 11 10.6Z" fill="currentColor" fillOpacity={0.28} stroke="none" />
      <path d="M12 2 20 12 12 22 4 12Z" strokeWidth={1.2} />
      <path d="M12 2 11 10.6 12 22M4 12 11 10.6 20 12" strokeWidth={0.8} opacity={0.75} />
    </>
  );
}

// ----- The big animated diamond shown while scanning -----
const RAY_COLOURS = ["#ffb3c7", "#ffd1a6", "#fff1a8", "#b8f2c9", "#a8d8ff", "#cdb8ff"];
// The "star halo": 12 four-pointed stars in a ring round the diamond,
// alternating big and small, coloured round the pastel rainbow.
const HALO = 12;
const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r}q0 ${r} ${r} ${r}-${r} 0-${r} ${r} 0-${r}-${r}-${r} ${r} 0 ${r}-${r}Z`;

export function ScanningPrism({ size = 132 }: { size?: number }) {
  const stars = Array.from({ length: HALO }, (_, i) => {
    const a = (i / HALO) * 2 * Math.PI - Math.PI / 2; // start at the top
    const big = i % 2 === 0;
    const R = big ? 16 : 17.5, r = big ? 2 : 1.2;
    return (
      <path
        key={i}
        className="prism-scan-ray"
        fill={RAY_COLOURS[i % RAY_COLOURS.length]}
        stroke="none"
        d={star(12 + Math.cos(a) * R, 12 + Math.sin(a) * R, r)}
        // Negative delays: every star is already mid-pulse, staggered round the
        // ring, so a shine travels round it ("travelling shimmer").
        style={{ animationDelay: `${(-(i * 1.8) / HALO).toFixed(2)}s` }}
      />
    );
  });
  return (
    // viewBox -14..38: the 24x24 diamond in the middle, with room round it for the star halo.
    <svg
      width={size}
      height={size}
      viewBox="-14 -14 52 52"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      data-prism="scanning-prism"
      style={{ color: "#f3e8ff", overflow: "visible" }}
    >
      {stars}
      <g className="prism-scan-gem">
        <Gem />
      </g>
    </svg>
  );
}

// The page header's icon (mockup "H2 + sparkles"): a see-through glass
// diamond with a pastel rainbow edge, and three little sparkles round it that
// twinkle one after another (animation in styles.ts, .prism-head-sparkle).
const EDGE = "prism-head-edge"; // the gradient's id (only one header on the page)
export function PrismIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      data-prism="header-icon"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Pink -> butter -> mint -> sky -> lavender, corner to corner. */}
        <linearGradient id={EDGE} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb8d9" />
          <stop offset="0.35" stopColor="#ffe2a8" />
          <stop offset="0.6" stopColor="#a8ecc9" />
          <stop offset="0.8" stopColor="#a9cdff" />
          <stop offset="1" stopColor="#d5c2ff" />
        </linearGradient>
      </defs>
      {/* Glass body with the rainbow edge, then the faint facet lines. */}
      <path d="M12 2 20 12 12 22 4 12Z" fill="rgba(255, 255, 255, 0.14)" stroke={`url(#${EDGE})`} strokeWidth={1.6} />
      <path d="M12 2 11 10.6 4 12M11 10.6 20 12M11 10.6 12 22" stroke={`url(#${EDGE})`} strokeWidth={0.8} opacity={0.8} />
      {/* Sparkles: a butter plus (top right), a sky plus (bottom left), a pink dot. */}
      <path className="prism-head-sparkle" d="M20 2.5v3M18.5 4h3" stroke="#ffe2a8" strokeWidth={0.9} />
      <path className="prism-head-sparkle" style={{ animationDelay: "-1.2s" }} d="M4.5 17.5v2.4M3.3 18.7h2.4" stroke="#a9cdff" strokeWidth={0.8} />
      <circle className="prism-head-sparkle" style={{ animationDelay: "-2.2s" }} cx={19.5} cy={18} r={0.7} fill="#ffb8d9" />
    </svg>
  );
}
