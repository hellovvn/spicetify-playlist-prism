// A start-page tile that flips over like a card (layout "D", picked by the
// developer). The front is one big button: a centred icon and label, and a
// short line that fades in on hover. Clicking it turns the tile round; the
// back holds the full description and the real buttons, plus a "Back" link
// that turns it again.
//
// How the flip works (CSS, in styles.ts): both faces sit on top of each other
// inside .prism-flip-inner. The back face is pre-rotated 180°, and
// "backface-visibility: hidden" hides whichever face points away from you.
// Rotating the inner box 180° therefore swaps which face you see. The hidden
// face also gets "visibility: hidden", so the keyboard (Tab) and screen
// readers skip it.

import React from "react";

export interface FlipTileProps {
  id: string; // data-prism name, e.g. "mode-prism"
  icon: React.ReactNode;
  label: string;
  tip: string; // the very short line shown on hover
  children: React.ReactNode; // the back of the tile
}

// Where the hover sparkles sit (percent of the tile) and when they twinkle.
const SPARKLES = [
  { left: 14, top: 18, size: 10, delay: 0 },
  { left: 82, top: 14, size: 8, delay: 500 },
  { left: 88, top: 62, size: 12, delay: 1100 },
  { left: 10, top: 70, size: 8, delay: 1600 },
  { left: 50, top: 8, size: 6, delay: 800 },
  { left: 30, top: 88, size: 7, delay: 1300 },
  { left: 70, top: 86, size: 9, delay: 300 },
];

export function FlipTile({ id, icon, label, tip, children }: FlipTileProps) {
  const [flipped, setFlipped] = React.useState(false);
  const frontRef = React.useRef<HTMLButtonElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);
  // A ref to remember that the user (not the first render) flipped the tile,
  // so we only move keyboard focus after a real click.
  const moved = React.useRef(false);

  // After flipping, put keyboard focus on the face now showing.
  React.useEffect(() => {
    if (!moved.current) return;
    (flipped ? backRef : frontRef).current?.focus({ preventScroll: true });
  }, [flipped]);

  const turn = (to: boolean) => {
    moved.current = true;
    setFlipped(to);
  };

  return (
    <div className={`prism-flip${flipped ? " is-flipped" : ""}`} data-prism={id}>
      <div className="prism-flip-inner">
        <button
          ref={frontRef}
          type="button"
          className="prism-flip-face prism-flip-front prism-mode-tile"
          onClick={() => turn(true)}
          aria-label={`${label}: ${tip}. Show details`}
          data-prism={`flip-${id.replace("mode-", "")}`}
        >
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              className="prism-star"
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDuration: "2400ms", animationDelay: `${s.delay}ms` }}
            />
          ))}
          <span className="prism-mode-center">
            {icon}
            <span className="prism-mode-label">{label}</span>
          </span>
          <span className="prism-mode-tip">{tip}</span>
        </button>
        <section className="prism-flip-face prism-flip-back prism-glass-panel" aria-label={label}>
          <button ref={backRef} type="button" className="prism-flip-close" onClick={() => turn(false)} data-prism={`unflip-${id.replace("mode-", "")}`}>
            ← Back
          </button>
          {children}
        </section>
      </div>
    </div>
  );
}
