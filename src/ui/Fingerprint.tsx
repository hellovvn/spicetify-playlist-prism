// "Prism fingerprint": a little artwork made from a playlist's genre mix, for
// the stats page. Each genre is a see-through glass bubble in its colour; a
// genre that more of the playlist has gets a bigger bubble. The same mix
// always draws the same picture, so every playlist has its own.
//
// Each bubble looks like a soap bubble in its genre's tag colour (mockup
// "C3", developer's pick): see-through colour that gets stronger towards the
// edge, a soft glow in that colour, a faint white rim, a bright reflection at
// the top left and a small one at the bottom right. Bubbles float and
// wobble gently, and each one can be POPPED (click, or Enter/Space when
// focused): like a real bubble it vanishes in a flash and sprays tiny
// droplets (its colour and white) that fly out and fall, then it floats back
// in after a few seconds.
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
const POP_MS = 380; // the flash takes 140 ms; the droplets keep flying a bit longer

// The droplet spray: 16 droplets around the bubble's edge. Fixed values (the
// same every time, no random numbers): droplet k sits at angle k/16 of a
// turn, with sizes and distances cycling so it doesn't look too regular.
const DROPS = Array.from({ length: 16 }, (_, k) => ({
  turn: k / 16 + (k % 2) * 0.015,
  size: 0.7 + (k % 3) * 0.35, // radius in picture units
  reach: 0.45 + (k % 4) * 0.12, // how far it flies, as a share of the bubble radius
  white: k % 3 === 0, // every third droplet is white, the rest the genre colour
  delay: (k % 4) * 25, // ms
}));

// Each Fingerprint needs its own gradient ids (ids are page-wide in SVG).
let instances = 0;

type BubbleState = "here" | "popping" | "gone" | "back";

export function Fingerprint({
  rows,
  size = 96,
  colourOf = tagColour,
}: {
  rows: ChartRow[];
  size?: number;
  // The page's colour for each genre, so bubbles match its bars and chips.
  colourOf?: (name: string) => string;
}) {
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
    const colour = colourOf(row.name);
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
            {/* The body: see-through in the middle, the full genre colour at the edge. */}
            <radialGradient id={id} cx="45%" cy="40%" r="65%">
              <stop offset="0" stopColor={colour} stopOpacity={0.25} />
              <stop offset="0.85" stopColor={colour} stopOpacity={0.67} />
              <stop offset="1" stopColor={colour} stopOpacity={1} />
            </radialGradient>
            {/* The glow: the genre colour fading out just beyond the edge. (A
                gradient circle, not a CSS blur filter, which is costly to draw.) */}
            <radialGradient id={`${id}-glow`}>
              <stop offset="0.7" stopColor={colour} stopOpacity={0.5} />
              <stop offset="1" stopColor={colour} stopOpacity={0} />
            </radialGradient>
            {/* A reflection: bright white fading to nothing. */}
            <radialGradient id={`${id}-shine`}>
              <stop offset="0" stopColor="#ffffff" stopOpacity={0.9} />
              <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* Wobble: a slight stretch back and forth, like a floating bubble. */}
          <g className="prism-bubble-wobble" style={{ animationDelay: `${-i * 0.45}s`, animationDuration: `${3 + i * 0.4}s` }}>
            <circle cx={x} cy={y} r={r * 1.3} fill={`url(#${id}-glow)`} />
            <circle cx={x} cy={y} r={r} fill={`url(#${id})`} />
            <circle cx={x} cy={y} r={r - 0.4} fill="none" stroke="#ffffff" strokeOpacity={0.33} strokeWidth={0.8} />
            <ellipse cx={x - r * 0.36} cy={y - r * 0.48} rx={r * 0.44} ry={r * 0.28} fill={`url(#${id}-shine)`} />
            <ellipse cx={x + r * 0.36} cy={y + r * 0.56} rx={r * 0.2} ry={r * 0.12} fill={`url(#${id}-shine)`} opacity={0.6} />
          </g>
        </g>
        {/* The droplet spray: while popping/gone, droplets appear around the
            bubble's edge, fly out and fall (animation in styles.ts, which
            plays once and ends invisible). */}
        {(state === "popping" || state === "gone") &&
          DROPS.map((drop, k) => {
            const angle = drop.turn * 2 * Math.PI;
            return (
              <circle
                key={k}
                className="prism-drop-bit"
                cx={x + Math.cos(angle) * r * 0.9}
                cy={y + Math.sin(angle) * r * 0.9}
                r={drop.size}
                fill={drop.white ? "#ffffff" : colour}
                // --dx/--dy: where this droplet flies (it also falls a little).
                style={{
                  ["--dx" as any]: `${Math.cos(angle) * r * drop.reach}px`,
                  ["--dy" as any]: `${Math.sin(angle) * r * drop.reach}px`,
                  animationDelay: `${drop.delay}ms`,
                }}
              />
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
      aria-label="Prism fingerprint: this playlist's genre mix as bubbles you can pop"
      data-prism="stats-fingerprint"
      style={{ overflow: "visible" }}
    >
      {bubbles}
    </svg>
  );
}
