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
const FLY = [
  { dx: -62, dy: -42, fill: "#fdffb6", delay: 0 },
  { dx: 60, dy: -48, fill: "#9bf6ff", delay: 300 },
  { dx: -70, dy: 11, fill: "#ffb3d1", delay: 650 },
  { dx: 70, dy: 6, fill: "#caffbf", delay: 950 },
  { dx: -10, dy: -64, fill: "#ffd6a5", delay: 1250 },
  { dx: -47, dy: 48, fill: "#bdb2ff", delay: 450 },
  { dx: 49, dy: 45, fill: "#ffd3ec", delay: 1100 },
];

// The ring of equalizer bars round the boombox: angle, rainbow colour, and a
// delay that walks round the circle (a wave), with a little wobble.
const RING_RADIUS = 64;
const RING_COUNT = 20; // like mockup "X1": fewer, slimmer, shorter capsules
const RING = Array.from({ length: RING_COUNT }, (_, i) => ({
  angle: (360 / RING_COUNT) * i,
  color: ["#ffb3d1", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#bdb2ff"][i % 6],
  delay: (i * 70) % 800,
}));

// "Make a Prism playlist": a chunky pink boombox. Speakers pulse with a ring
// rippling out, a ring of rainbow equalizer bars pulses all round it, and notes fly out from behind it.
export function PrismIcon() {
  const speaker = (cx: number) => (
    <>
      <circle cx={cx} cy={60} r={16} fill="#ffffff" opacity={0.22} />
      <circle cx={cx} cy={60} r={16} fill="none" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1.2} />
      {/* The ripple ring: grows from the cone and fades on every beat. */}
      <circle className="prism-ic-anim prism-ic-ripple" cx={cx} cy={60} r={8} fill="none" stroke="#ff8fc6" strokeWidth={2} />
      {/* A second ripple, half a beat later, so the wave reads clearly. */}
      <circle className="prism-ic-anim prism-ic-ripple" style={{ animationDelay: "300ms" }} cx={cx} cy={60} r={8} fill="none" stroke="#ffb3d9" strokeWidth={1.6} />
      {/* The cone: a strong pink so its pulse is easy to see. */}
      <circle className="prism-ic-anim prism-ic-pulse" cx={cx} cy={60} r={8.5} fill="#ff8fc6" />
    </>
  );
  return (
    // A bigger canvas than the tapes' (160 x 160) to leave room for the ring.
    <svg className="prism-mode-icon" viewBox="-15 -22 160 160" width={176} height={176} aria-hidden="true">
      {/* Equalizer ring: 20 round rainbow capsules all the way round the
          boombox. Each is drawn pointing straight up, then turned to its angle
          around the centre (rotate(angle 65 58)). The CSS slides each capsule
          outwards and back (it doesn't stretch it, which would flatten its
          round ends); staggered delays make a wave run round the ring. */}
      {RING.map((b, i) => (
        <g key={i} transform={`rotate(${b.angle} 65 58)`}>
          <rect className="prism-ic-anim prism-ic-ringpulse" style={{ animationDelay: `${b.delay}ms` }} x={63} y={58 - RING_RADIUS - 10} width={4} height={10} rx={2} fill={b.color} opacity={0.9} />
        </g>
      ))}
      {/* Handle, in the background: drawn early, dimmer, and stopping at the
          body's top edge so it sits behind the boombox. */}
      <path d="M44 28 V20 a7 7 0 0 1 7 -7 H79 a7 7 0 0 1 7 7 V28" fill="none" stroke="#e9dcff" strokeOpacity={0.45} strokeWidth={4.5} strokeLinecap="round" />
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
