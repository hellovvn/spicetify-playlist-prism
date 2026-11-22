// "Prism fingerprint": a little artwork made from a playlist's genre mix, for
// the stats page. Each genre is a see-through glass bubble in its colour; a
// genre that more of the playlist has gets a bigger bubble. The same mix
// always draws the same picture, so every playlist has its own.
//
// Each bubble is glass: a radial gradient (clear-ish middle, tinted edge), a
// thin rim in the genre colour and a small white shine. They float gently,
// and each one can be POPPED (click, or Enter/Space when focused): it softly
// swells and fades while a shower of translucent sparkles drifts apart and
// floats down, then the bubble floats back in after a few seconds.
// Animations are in styles.ts (.prism-bubble...).

import React from "react";
import type { ChartRow } from "../stats/playlistStats";
import { tagColour } from "./tagLabels";

// Where the bubbles sit in the 100x100 picture, biggest genre first
// (hand-placed so they cluster and overlap nicely).
const SPOTS: [number, number][] = [
  [42, 46], [64, 38], [57, 64], [30, 67], [75, 64], [27, 34], [72, 82], [45, 84],
];

// How long a popped bubble stays gone, and how long the pop itself takes.
export const RETURN_AFTER_MS = 3000;
const POP_MS = 380;

// The sparkle shower: 14 sparkles spread over the bubble. Fixed "random"
// values (so it's the same every time and needs no random numbers):
// [angle 0..1 of a turn, distance 0..1 of the radius, size, delay ms, drift].
const SPARKLES: [number, number, number, number, number][] = [
  [0.02, 0.3, 2.4, 0, 1], [0.11, 0.85, 1.6, 60, -1], [0.19, 0.55, 2.0, 120, 1], [0.27, 0.9, 1.4, 30, 1],
  [0.36, 0.4, 2.2, 90, -1], [0.44, 0.75, 1.5, 150, 1], [0.52, 0.2, 1.8, 40, -1], [0.6, 0.95, 2.1, 110, -1],
  [0.68, 0.5, 1.4, 20, 1], [0.76, 0.8, 2.3, 140, -1], [0.84, 0.35, 1.6, 70, 1], [0.92, 0.65, 1.9, 100, -1],
  [0.47, 0.05, 1.3, 160, 1], [0.97, 0.9, 1.5, 50, 1],
];
// Pastel sparkle colours (the bubble's own colour is added as well).
const SPARKLE_COLOURS = ["#ffffff", "#fff1a8", "#ffb3d1", "#a8d8ff", "#cdb8ff"];

// A 4-pointed sparkle of radius r centred on (0, 0).
const sparklePath = (r: number) =>
  `M0 ${-r}Q${r * 0.18} ${-r * 0.18} ${r} 0Q${r * 0.18} ${r * 0.18} 0 ${r}Q${-r * 0.18} ${r * 0.18} ${-r} 0Q${-r * 0.18} ${-r * 0.18} 0 ${-r}Z`;

// Each Fingerprint needs its own gradient ids (ids are page-wide in SVG).
let instances = 0;

type BubbleState = "here" | "popping" | "gone" | "back";

export function Fingerprint({ rows, size = 96 }: { rows: ChartRow[]; size?: number }) {
  // useRef keeps the same id prefix for this fingerprint across re-renders.
  const prefix = React.useRef(`prism-bubble-${++instances}`).current;
  // Which bubbles are popped. Keyed by genre name, so it doesn't mix up
  // bubbles if the rows change.
  const [states, setStates] = React.useState<Record<string, BubbleState>>({});
  // Timers still waiting; cleared if the page closes first, so nothing tries
  // to update a fingerprint that's gone.
  const timers = React.useRef<number[]>([]);
  React.useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const set = (name: string, state: BubbleState) => setStates((previous) => ({ ...previous, [name]: state }));
  const later = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, ms));

  function pop(name: string) {
    if ((states[name] ?? "here") !== "here") return; // already popping or gone
    set(name, "popping"); // swell + burst
    later(POP_MS, () => set(name, "gone"));
    later(RETURN_AFTER_MS, () => set(name, "back")); // float back in
    later(RETURN_AFTER_MS + 600, () => set(name, "here"));
  }

  const bubbles = rows.slice(0, SPOTS.length).map((row, i) => {
    const [x, y] = SPOTS[i];
    const r = 6 + Math.sqrt(row.share) * 17; // area grows with the share
    const colour = tagColour(row.name);
    const id = `${prefix}-${i}`;
    const state = states[row.name] ?? "here";
    return (
      // Outer group: the gentle float. Inner group: pop / return animations.
      <g key={row.name} className="prism-bubble" style={{ animationDelay: `${-i * 0.7}s` }}>
        <g
          className={`prism-bubble-body is-${state}`}
          role="button"
          tabIndex={0}
          aria-label={`${row.name}: ${row.count} songs. Pop this bubble`}
          onClick={() => pop(row.name)}
          onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), pop(row.name))}
        >
          <title>{`${row.name}: ${row.count} songs (click to pop)`}</title>
          <defs>
            <radialGradient id={id} cx="35%" cy="30%" r="70%">
              <stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
              <stop offset="0.6" stopColor={colour} stopOpacity={0.18} />
              <stop offset="1" stopColor={colour} stopOpacity={0.45} />
            </radialGradient>
          </defs>
          <circle cx={x} cy={y} r={r} fill={`url(#${id})`} stroke={colour} strokeOpacity={0.7} strokeWidth={0.7} />
          {/* The shine: a small tilted white oval near the top left. */}
          <ellipse
            cx={x - r * 0.35}
            cy={y - r * 0.4}
            rx={r * 0.28}
            ry={r * 0.16}
            fill="#ffffff"
            fillOpacity={0.55}
            transform={`rotate(-30 ${x - r * 0.35} ${y - r * 0.4})`}
          />
        </g>
        {/* The sparkle shower: while popping/gone, translucent sparkles appear
            over the bubble, drift apart and float down (animation in styles.ts,
            which plays once and ends invisible). */}
        {(state === "popping" || state === "gone") &&
          SPARKLES.map(([turn, distance, size, delay, sway], k) => {
            const angle = turn * 2 * Math.PI;
            const sx = x + Math.cos(angle) * distance * r;
            const sy = y + Math.sin(angle) * distance * r;
            return (
              <g key={k} transform={`translate(${sx} ${sy})`}>
                <path
                  className="prism-sparkle-bit"
                  d={sparklePath(size)}
                  fill={k % 3 === 0 ? colour : SPARKLE_COLOURS[k % SPARKLE_COLOURS.length]}
                  // --dx/--dy: where this sparkle drifts to; --sway: which way it tilts.
                  style={{
                    ["--dx" as any]: `${Math.cos(angle) * (6 + distance * 6)}px`,
                    ["--dy" as any]: `${Math.sin(angle) * (4 + distance * 4)}px`,
                    ["--sway" as any]: `${sway * 25}deg`,
                    animationDelay: `${delay}ms`,
                  }}
                />
              </g>
            );
          })}
      </g>
    );
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="group"
      aria-label="Prism fingerprint: this playlist's genre mix as glass bubbles you can pop"
      data-prism="stats-fingerprint"
      style={{ overflow: "visible" }}
    >
      {bubbles}
    </svg>
  );
}
