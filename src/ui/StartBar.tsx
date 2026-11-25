// The start page's wide glass bar (Merge playlists, Add a song): an icon, a
// label and one line. The icon's parts move while the bar is hovered or
// focused (class "is-animating", CSS in styles.ts).
//
// Like FlipTile, leaving doesn't snap the icon back mid-move: every running
// icon animation is told to finish the loop it's in (Web Animations API,
// iterations = current loop + 1), and only then is the class removed. Each
// loop ends in the resting pose, so the icon ends exactly as it started.

import React from "react";

export interface StartBarProps {
  id: string; // data-prism name, e.g. "start-merge"
  icon: React.ReactNode;
  label: string;
  text: string;
  onClick: () => void;
  labelStyle?: React.CSSProperties;
  textStyle?: React.CSSProperties;
}

export function StartBar({ id, icon, label, text, onClick, labelStyle, textStyle }: StartBarProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [animating, setAnimating] = React.useState(false);
  const pointerIn = React.useRef(false);
  const focusIn = React.useRef(false);
  const stopToken = React.useRef(0); // bumped on every start/stop, so an old stop can't win
  // Animations told to stop: the browser stops listing them once finished, so
  // keep them here to restart if the pointer comes back.
  const winding = React.useRef<Animation[]>([]);

  // Only the icon's CSS @keyframes loops on SVG parts, not the bar's own
  // hover transition (getAnimations() lists transitions too).
  const iconAnimations = (): Animation[] =>
    (ref.current?.getAnimations?.({ subtree: true }) ?? []).filter(
      (a) => a instanceof CSSAnimation && a.effect instanceof KeyframeEffect && a.effect.target instanceof SVGElement
    );

  const start = () => {
    stopToken.current++;
    for (const a of winding.current) {
      a.effect?.updateTiming({ iterations: Infinity });
      a.play();
    }
    winding.current = [];
    setAnimating(true);
  };

  const stop = async () => {
    if (pointerIn.current || focusIn.current) return;
    const token = ++stopToken.current;
    const animations = iconAnimations();
    winding.current = animations;
    await Promise.all(
      animations.map((a) => {
        const loop = a.effect?.getComputedTiming().currentIteration;
        if (loop == null) {
          a.cancel();
          return Promise.resolve();
        }
        a.effect?.updateTiming({ iterations: loop + 1 });
        return a.finished.then(() => undefined, () => undefined);
      })
    );
    if (token !== stopToken.current) return; // hovered again meanwhile
    winding.current = [];
    setAnimating(false);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`prism-home-bar${animating ? " is-animating" : ""}`}
      onClick={onClick}
      data-prism={id}
      onMouseEnter={() => {
        pointerIn.current = true;
        start();
      }}
      onMouseLeave={() => {
        pointerIn.current = false;
        stop();
      }}
      onFocus={() => {
        focusIn.current = true;
        start();
      }}
      onBlur={() => {
        focusIn.current = false;
        stop();
      }}
    >
      {icon}
      <span style={labelStyle}>{label}</span>
      {/* Shown only while hovered or focused (CSS). The button's own text
          still includes it, so screen readers always hear it. */}
      <span className="prism-home-bar-text" style={textStyle}>{text}</span>
    </button>
  );
}
