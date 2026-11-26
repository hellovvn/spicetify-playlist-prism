// The two playful icons on the start page's flip tiles. Developer's picks:
// a chunky boombox with rainbow equalizer bars, and a stack of cute tapes,
// in the "F1 matte frosted" finish: soft see-through pastels with a faint
// white edge and no shine.
//
// Drawn as inline SVG (shapes described in code) so they stay sharp at any
// size and need no image files. Parts with the class "prism-ic-anim" move only
// while the tile is hovered or focused (see .prism-mode-tile in styles.ts).

import React from "react";

const PINK = "#ffc6e5";
const MINT = "#caffbf";
const SKY = "#a8e8ff";

// A matte frosted slab: see-through pastel fill plus a faint white edge.
function MatteBox({ x, y, w, h, r, color }: { x: number; y: number; w: number; h: number; r: number; color: string }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={color} opacity={0.55} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke="#ffffff" strokeOpacity={0.4} strokeWidth={1.2} />
    </>
  );
}

// A small music note centred near (0, 0); place it with an outer transform.
function NoteShape({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <ellipse cx={0} cy={0} rx={3.4} ry={2.5} transform="rotate(-20)" />
      <rect x={2.4} y={-12} width={1.5} height={12} rx={0.7} />
      <path d="M3.9 -12 q6 2 4.5 7.5 q-0.6 -3.8 -4.5 -4.2 z" />
    </g>
  );
}

// Notes flying OUT of the boombox in every direction. Each starts at the
// boombox's centre and travels along (dx, dy) while fading; the CSS
// animation "prism-ic-fly" reads --dx/--dy (CSS variables set per note).
// Notes in the Remix tile's three colours (pink first, then mint and sky).
const FLY = [
  { dx: -62, dy: -42, fill: "#ffb3d1", delay: 0 },
  { dx: 60, dy: -48, fill: "#9bf6ff", delay: 300 },
  { dx: -70, dy: 11, fill: "#ffb3d1", delay: 650 },
  { dx: 70, dy: 6, fill: "#caffbf", delay: 950 },
  { dx: -10, dy: -64, fill: "#ffb3d1", delay: 1250 },
  { dx: -47, dy: 48, fill: "#caffbf", delay: 450 },
  { dx: 49, dy: 45, fill: "#9bf6ff", delay: 1100 },
];

// "Grow a playlist": a chunky pink boombox. Speakers pulse with a ring
// rippling out, and notes fly out from behind it.
export function PrismIcon() {
  // Mockup "B5": the body stays pink (the main colour); each speaker gets an
  // outer mint ring and an inner sky ring (the Remix tapes' other colours)
  // around the hot-pink cone that pulses.
  const speaker = (cx: number) => (
    <>
      <circle cx={cx} cy={60} r={16} fill="#ffffff" opacity={0.2} />
      <circle cx={cx} cy={60} r={15} fill="none" stroke={MINT} strokeWidth={2.4} opacity={0.85} />
      <circle cx={cx} cy={60} r={11.5} fill="none" stroke={SKY} strokeWidth={2.4} opacity={0.85} />
      {/* The ripple ring: grows from the cone and fades on every beat. */}
      <circle className="prism-ic-anim prism-ic-ripple" cx={cx} cy={60} r={8} fill="none" stroke="#ff8fc6" strokeWidth={2} />
      {/* A second ripple, half a beat later, so the wave reads clearly. */}
      <circle className="prism-ic-anim prism-ic-ripple" style={{ animationDelay: "300ms" }} cx={cx} cy={60} r={8} fill="none" stroke="#ffb3d9" strokeWidth={1.6} />
      {/* The cone: a strong pink so its pulse is easy to see. */}
      <circle className="prism-ic-anim prism-ic-pulse" cx={cx} cy={60} r={8.5} fill="#ff8fc6" />
    </>
  );
  return (
    // A bigger canvas than the tapes' (160 x 160) to leave room for the flying notes.
    <svg className="prism-mode-icon" viewBox="-15 -22 160 160" width={176} height={176} aria-hidden="true">
      {/* Pink handle, in the background: drawn early, softer, and stopping at the
          body's top edge so it sits behind the boombox. */}
      {/* Flat ends ("butt") stopping exactly at the body's top edge (y = 28):
          round ends used to poke into the see-through body. */}
      <path d="M44 28 V20 a7 7 0 0 1 7 -7 H79 a7 7 0 0 1 7 7 V28" fill="none" stroke={PINK} strokeOpacity={0.7} strokeWidth={4.5} strokeLinecap="butt" />
      {/* Flying notes start at the centre, behind the body. The body is
          see-through, so a mask hides the notes wherever the body is: a mask
          shows what's under its white parts and hides what's under black. */}
      <mask id="prism-ic-bx-outside" maskUnits="userSpaceOnUse" x={-15} y={-22} width={160} height={160}>
        <rect x={-15} y={-22} width={160} height={160} fill="#ffffff" />
        <rect x={12} y={28} width={106} height={62} rx={20} fill="#000000" />
      </mask>
      <g mask="url(#prism-ic-bx-outside)">
        {FLY.map((n, i) => (
          <g key={i} transform="translate(65 58)">
            <g className="prism-ic-anim prism-ic-fly" style={{ animationDelay: `${n.delay}ms`, ["--dx" as any]: `${n.dx}px`, ["--dy" as any]: `${n.dy}px` }}>
              <NoteShape fill={n.fill} />
            </g>
          </g>
        ))}
      </g>
      {/* Same see-through pink as the tapes. */}
      <MatteBox x={12} y={28} w={106} h={62} r={20} color={PINK} />
      {speaker(36)}
      {speaker(94)}
      {/* A small pill between the speakers (like mockup "V2"). */}
      <rect x={57} y={57} width={16} height={6} rx={3} fill="#ffffff" opacity={0.55} />
    </svg>
  );
}

// The little heart on each tape's label.
const HEART = "M0 3 c-1.6-2.6-6-1.2-4 2.2 l4 3.8 4-3.8 c2-3.4-2.4-4.8-4-2.2z";

// "Remix into moods": three cute tapes stacked on a shelf, a heart on each
// label. On hover the tapes SHUFFLE places (a remix): the left one slides
// right, the right one climbs to the top, the top one drops to the left, then
// they slide back. While a tape sits on top, music notes drop into it. Reels
// spin the whole time.
//
// Timing (one loop = 3.2 s, see styles.ts): the tapes hold still for the
// first quarter, move, hold in their swapped places from 40% to 75%, then
// move back. The notes' loop is exactly half as long (1.6 s), so they drop
// once in each "holding still" window: once into the pink tape, once into
// the blue one.
export function OrganizeIcon() {
  const tape = (x: number, y: number, color: string, symbol: string) => (
    <>
      <MatteBox x={x} y={y} w={40} h={28} r={8} color={color} />
      {/* Label strip with a little heart. */}
      <rect x={x + 7} y={y + 4} width={26} height={8} rx={3} fill="#ffffff" opacity={0.55} />
      <path d={symbol} transform={`translate(${x + 20} ${y + 7.5}) scale(0.7)`} fill={color} />
      {[x + 12, x + 28].map((cx) => (
        <g key={cx} className="prism-ic-anim prism-ic-spin">
          <circle cx={cx} cy={y + 19} r={4.4} fill="#ffffff" opacity={0.85} />
          <rect x={cx - 0.8} y={y + 15.6} width={1.6} height={6.8} rx={0.8} fill={color} />
        </g>
      ))}
    </>
  );
  return (
    // Taller canvas than before (starts at y = -14) to leave room above the
    // stack for the falling notes.
    <svg className="prism-mode-icon" viewBox="0 -14 130 114" width={156} height={137} aria-hidden="true">
      {/* The shelf. */}
      <rect x={14} y={82} width={102} height={6} rx={3} fill="#e9dcff" opacity={0.45} />
      <g className="prism-ic-anim prism-ic-shuffle-a">{tape(22, 50, MINT, HEART)}</g>
      <g className="prism-ic-anim prism-ic-shuffle-b">{tape(68, 50, SKY, HEART)}</g>
      <g className="prism-ic-anim prism-ic-shuffle-c">{tape(45, 18, PINK, HEART)}</g>
      {/* Notes falling into whichever tape is on top (they shrink and fade
          as they reach its top edge). */}
      {[
        { x: 55, fill: "#ffd3ec", delay: 0 },
        { x: 65, fill: "#fdffb6", delay: 140 },
        { x: 75, fill: "#d9f9ff", delay: 280 },
      ].map((n) => (
        <g key={n.x} transform={`translate(${n.x} 4)`}>
          <g className="prism-ic-anim prism-ic-drop" style={{ animationDelay: `${n.delay}ms` }}>
            <NoteShape fill={n.fill} />
          </g>
        </g>
      ))}
    </svg>
  );
}

// ----- Start bar icons (Merge, Add a song) -----
// Developer's picks (2026-11-24): "Q1 bubbles" for Merge and "S1 compass" for
// Add a song. Small (64 x 40) and in the bar mockups' pastels. Parts with
// "prism-bar-ic" move only while the bar has "is-animating" (StartBar.tsx);
// each loop starts and ends in the resting pose (see styles.ts).
const BAR_PINK = "#f7a8cf";
const BAR_SKY = "#9fcdf3";
const BAR_MINT = "#9fe3c8";

// A small music note whose box is 8 x 10 at (x, y), drawn w wide.
function BarNote({ x, y, w, fill, opacity = 1 }: { x: number; y: number; w: number; fill: string; opacity?: number }) {
  const s = w / 8;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill} fillOpacity={opacity}>
      <circle cx={2.2} cy={8} r={2} />
      <path d="M3.9 8V1.2L7.6.2V2.6L3.9 3.6Z" />
    </g>
  );
}

// A four-point sparkle in a 10 x 10 box at (x, y), drawn `size` wide.
function BarSparkle({ x, y, size, className }: { x: number; y: number; size: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 10})`}>
      <path className={className} d="M5 0Q5 5 10 5Q5 5 5 10Q5 5 0 5Q5 5 5 0Z" fill="#ffffff" />
    </g>
  );
}

// A see-through bubble: clear in the middle, its colour strongest at the rim,
// with a white shine at the top left (like the stats page's fingerprint).
function Bubble({ cx, cy, r, color, gradient, strokeWidth = 1.1 }: { cx: number; cy: number; r: number; color: string; gradient: string; strokeWidth?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${gradient})`} stroke={color} strokeOpacity={0.9} strokeWidth={strokeWidth} />
      <path
        d={`M${cx - 0.6 * r} ${cy - 0.5 * r}A${0.7 * r} ${0.7 * r} 0 0 1 ${cx - 0.2 * r} ${cy - 0.75 * r}`}
        fill="none" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={1.3} strokeLinecap="round"
      />
    </>
  );
}

function BubbleGradient({ id, color }: { id: string; color: string }) {
  return (
    <radialGradient id={id}>
      <stop offset="0.55" stopColor={color} stopOpacity={0.08} />
      <stop offset="1" stopColor={color} stopOpacity={0.7} />
    </radialGradient>
  );
}

// Merge playlists: a pink and a sky bubble (two playlists, a note in each).
// On hover they drift together and become one bigger mint-green bubble with
// two green notes (developer's wish), then split again.
export function MergeIcon() {
  return (
    <svg viewBox="0 0 64 40" width={64} height={40} aria-hidden="true" style={{ flexShrink: 0, overflow: "visible" }}>
      <defs>
        <BubbleGradient id="prism-bar-bub-pink" color={BAR_PINK} />
        <BubbleGradient id="prism-bar-bub-sky" color={BAR_SKY} />
        <BubbleGradient id="prism-bar-bub-mint" color={BAR_MINT} />
      </defs>
      <g className="prism-bar-ic prism-bar-ic-left">
        <Bubble cx={21} cy={20} r={10} color={BAR_PINK} gradient="prism-bar-bub-pink" />
        <BarNote x={18} y={16} w={6} fill="#ffffff" opacity={0.8} />
      </g>
      <g className="prism-bar-ic prism-bar-ic-right">
        <Bubble cx={43} cy={20} r={10} color={BAR_SKY} gradient="prism-bar-bub-sky" />
        <BarNote x={40} y={16} w={6} fill="#ffffff" opacity={0.8} />
      </g>
      <g className="prism-bar-ic prism-bar-ic-joined">
        <Bubble cx={32} cy={20} r={14} color={BAR_MINT} gradient="prism-bar-bub-mint" strokeWidth={1.2} />
        <BarNote x={25} y={15} w={6} fill={BAR_MINT} />
        <BarNote x={33} y={17} w={6} fill={BAR_MINT} />
      </g>
    </svg>
  );
}

// Add a song to your playlists: a glass compass beside three playlists. On
// hover the pink needle swings, wobbles and settles on the mint playlist (the
// best fit), which lights up with a sparkle.
export function AddSongIcon() {
  const box = (y: number, color: string, className?: string) => (
    <rect className={className} x={45} y={y} width={11} height={11} rx={2.5} fill={color} fillOpacity={0.5} stroke="#ffffff" strokeOpacity={0.45} />
  );
  return (
    <svg viewBox="0 0 64 40" width={64} height={40} aria-hidden="true" style={{ flexShrink: 0, overflow: "visible" }}>
      <circle cx={19} cy={20} r={15} fill="#ffffff" fillOpacity={0.1} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.2} />
      <circle cx={19} cy={20} r={11.5} fill="none" stroke="#ffffff" strokeOpacity={0.2} />
      <path d="M19 6.5V9M19 31V33.5M5.5 20H8M30 20H32.5" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={1.2} strokeLinecap="round" />
      <g className="prism-bar-ic prism-bar-ic-needle">
        <polygon points="19,8.5 22,20 16,20" fill={BAR_PINK} fillOpacity={0.95} />
        <polygon points="16,20 22,20 19,31.5" fill="#ffffff" fillOpacity={0.45} />
      </g>
      <circle cx={19} cy={20} r={2} fill="#ffffff" />
      {box(2, BAR_SKY)}
      {box(14.5, BAR_MINT, "prism-bar-ic prism-bar-ic-best")}
      {box(27, BAR_PINK)}
      <BarSparkle x={56} y={11} size={7} className="prism-bar-ic prism-bar-ic-sparkle" />
    </svg>
  );
}
