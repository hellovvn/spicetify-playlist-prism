// Prism's icons drawn in React for use ON the page: the page header's Prism
// star (PrismIcon, the same star as the Spotify header icon,
// src/assets/prism.svg) and the big animated faceted diamond shown while
// scanning (ScanningPrism). Animations are in src/ui/styles.ts.

import React from "react";

// The scanning diamond's lines (24x24 picture, centre 12,12).
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

// The page header's icon: the Prism star (mockup "E", developer's pick
// 2026-11-25), the same 4-point star filled with the pastel rainbow as the
// Spotify header icon (src/assets/prism.svg) and the app's .prism-star-icon,
// with a white glint and three little sparkles round it that twinkle one
// after another (animation in styles.ts, .prism-head-sparkle).
const FILL = "prism-head-fill"; // the gradient's id (only one header on the page)
const STAR = "M12 2.5C12.8 8.6 15.4 11.2 21.5 12 15.4 12.8 12.8 15.4 12 21.5 11.2 15.4 8.6 12.8 2.5 12 8.6 11.2 11.2 8.6 12 2.5Z";
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
        <linearGradient id={FILL} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb8d9" />
          <stop offset="0.35" stopColor="#ffe2a8" />
          <stop offset="0.6" stopColor="#a8ecc9" />
          <stop offset="0.8" stopColor="#a9cdff" />
          <stop offset="1" stopColor="#d5c2ff" />
        </linearGradient>
      </defs>
      {/* The rainbow star, then a soft white glint along its upper right edge. */}
      <path d={STAR} fill={`url(#${FILL})`} />
      <path d="M12 5.8C12.5 9.4 14.2 11.2 17.6 12" stroke="#ffffff" strokeOpacity={0.65} strokeWidth={0.7} />
      {/* Sparkles: a butter plus (top right), a sky dot (bottom left), a pink dot (bottom right). */}
      <path className="prism-head-sparkle" d="M19.5 3v2.6M18.2 4.3h2.6" stroke="#ffe2a8" strokeWidth={0.9} />
      <circle className="prism-head-sparkle" style={{ animationDelay: "-1.2s" }} cx={5} cy={18.5} r={0.7} fill="#a9cdff" />
      <circle className="prism-head-sparkle" style={{ animationDelay: "-2.2s" }} cx={19} cy={19} r={0.6} fill="#ffb8d9" />
    </svg>
  );
}
