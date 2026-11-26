// Prism's icons drawn in React for use ON the page: the page header's Prism
// star (PrismIcon, the same star as the Spotify header icon,
// src/assets/prism.svg) and the big scanning icon (ScanningPrism: the star in
// a filling rainbow ring). Animations are in src/ui/styles.ts.

import React from "react";

// ----- The big scanning icon (mockup "D, glow + progress ring", developer's
// pick 2026-11-26) -----
// The Prism star (same shape and rainbow as the header icon) breathing over a
// soft glow, inside a pastel rainbow ring that fills up as the scan goes
// (`progress` 0..1). Before the song count is known (progress null) a short
// arc circles round the ring instead. The star itself never turns.
// 120x120 picture, centre 60,60. Animations in styles.ts (.prism-scan-*).
const SCAN_FILL = "prism-scan-fill"; // gradient ids (one scan screen at a time)
const SCAN_GLOW = "prism-scan-glow";
const RING_R = 46;
const RING_LENGTH = 2 * Math.PI * RING_R;

export function ScanningPrism({ size = 132, progress = null }: { size?: number; progress?: number | null }) {
  const known = progress !== null && Number.isFinite(progress);
  const share = known ? Math.min(1, Math.max(0, progress as number)) : 0.2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      data-prism="scanning-prism"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={SCAN_FILL} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb8d9" />
          <stop offset="0.35" stopColor="#ffe2a8" />
          <stop offset="0.6" stopColor="#a8ecc9" />
          <stop offset="0.8" stopColor="#a9cdff" />
          <stop offset="1" stopColor="#d5c2ff" />
        </linearGradient>
        <radialGradient id={SCAN_GLOW}>
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="0.5" stopColor="#d5c2ff" stopOpacity={0.25} />
          <stop offset="1" stopColor="#d5c2ff" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle className="prism-scan-glow" cx={60} cy={60} r={34} fill={`url(#${SCAN_GLOW})`} />
      {/* The ring: a faint track, then the rainbow part (starts at the top, clockwise). */}
      <circle cx={60} cy={60} r={RING_R} stroke="#ffffff" strokeOpacity={0.14} strokeWidth={3} />
      <g className={known ? undefined : "prism-scan-waiting"}>
        <circle
          className="prism-scan-ring"
          data-prism="scan-ring"
          cx={60}
          cy={60}
          r={RING_R}
          stroke={`url(#${SCAN_FILL})`}
          strokeWidth={3}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          strokeDasharray={RING_LENGTH.toFixed(1)}
          strokeDashoffset={(RING_LENGTH * (1 - share)).toFixed(1)}
          // A round cap still shows a dot at 0%: hide the arc until there's some.
          strokeOpacity={share > 0 ? 1 : 0}
        />
      </g>
      {/* The header's 24x24 star, scaled to 52px in the middle, with its white glint. */}
      <g className="prism-scan-star">
        <g transform="translate(34 34) scale(2.1667)">
          <path d={STAR} fill={`url(#${SCAN_FILL})`} />
          <path
            d="M12 5.8C12.5 9.4 14.2 11.2 17.6 12"
            stroke="#ffffff"
            strokeOpacity={0.65}
            strokeWidth={0.7}
            strokeLinecap="round"
          />
        </g>
      </g>
      <circle className="prism-scan-sparkle" cx={88} cy={30} r={1.6} fill="#ffe2a8" />
      <circle className="prism-scan-sparkle" style={{ animationDelay: "-0.9s" }} cx={30} cy={90} r={1.4} fill="#a9cdff" />
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
