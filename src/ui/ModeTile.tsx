// A start-page tile (layout "D", picked by the developer): one big glass
// button with a centred icon and label, and a short line that fades in on
// hover. Clicking it opens that task's own screen (like the start bars
// below it). Until 2026-11-26 the tiles flipped over like cards to show
// their details; the developer found that crowded.

import React from "react";

export interface ModeTileProps {
  id: string; // data-prism name, e.g. "mode-prism"
  icon: React.ReactNode;
  label: string;
  tip: string; // the very short line shown on hover
  onClick: () => void; // opens the task's screen
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

export function ModeTile({ id, icon, label, tip, onClick }: ModeTileProps) {
  const frontRef = React.useRef<HTMLButtonElement>(null);

  // ----- Icon animations: start on hover/focus, finish their loop on leave -----
  // While "animating" is true the button gets the class "is-animating", which
  // switches the icon's CSS animations on (styles.ts). Just removing the class
  // on mouse leave would snap everything back mid-move, so instead we use the
  // Web Animations API: getAnimations() lists the running CSS animations as
  // objects we can adjust. For each one we say "stop after the loop you're
  // in" (iterations = current loop + 1), wait for all of them to finish, and
  // only then remove the class. Every loop ends in the resting pose, so the
  // icon ends up exactly as it looked before the hover.
  const [animating, setAnimating] = React.useState(false);
  const pointerIn = React.useRef(false);
  const focusIn = React.useRef(false);
  const stopToken = React.useRef(0); // bumped on every start/stop, so an old stop can't win

  // The icon's own animations (SVG parts), not the tile's glow or sparkles.
  // Only CSS *animations* (@keyframes loops) on the icon's SVG parts. NOT CSS
  // *transitions* such as the icon's small grow-on-hover: getAnimations()
  // lists those too, and telling one of them to "loop forever" on re-hover
  // made the whole icon pulse (bug seen on every second hover).
  const allIconAnimations = (): Animation[] =>
    (frontRef.current?.getAnimations?.({ subtree: true }) ?? []).filter(
      (a) => a instanceof CSSAnimation && a.effect instanceof KeyframeEffect && a.effect.target instanceof SVGElement
    );
  const isShuffle = (a: Animation) => String((a as CSSAnimation).animationName ?? "").startsWith("prism-ic-shuffle");
  // Everything except the tape shuffle (that one is handled separately below).
  const iconAnimations = () => allIconAnimations().filter((a) => !isShuffle(a));
  const shuffles = () => allIconAnimations().filter(isShuffle);

  // ----- The tape shuffle: stop at the next still moment, in any order -----
  // One loop is 3.2 s. The tapes stand still from 0-25% (pink on top), from
  // 40-75% (blue on top) and from 90-100% (back to pink, same as 0%). On leave
  // we pause at the next of those still moments; on hover we carry on from
  // there. When resuming from inside a still moment we first jump to its
  // start: same picture, but it keeps the falling notes (which restart at 0)
  // in step with the tapes.
  const SHUFFLE_MS = 3200;
  const shuffleTimer = React.useRef<number | undefined>(undefined);
  const loopPosition = (a: Animation) => {
    const t = Number(a.currentTime ?? 0);
    const loopStart = Math.floor(t / SHUFFLE_MS) * SHUFFLE_MS;
    return { loopStart, p: (t - loopStart) / SHUFFLE_MS };
  };
  const playShuffle = () => {
    window.clearTimeout(shuffleTimer.current);
    for (const a of shuffles()) {
      const { loopStart, p } = loopPosition(a);
      if (a.playState === "paused") {
        if (p >= 0.9) a.currentTime = loopStart + SHUFFLE_MS;
        else if (p >= 0.4 && p <= 0.75) a.currentTime = loopStart + 0.4 * SHUFFLE_MS;
        else if (p <= 0.25) a.currentTime = loopStart;
      }
      a.play();
    }
  };
  React.useEffect(() => () => window.clearTimeout(shuffleTimer.current), []); // tidy up on unmount
  const pauseShuffleWhenStill = () => {
    const list = shuffles();
    if (!list.length) return;
    const { p } = loopPosition(list[0]);
    const still = p <= 0.25 || (p >= 0.4 && p <= 0.75) || p >= 0.9;
    const pauseAll = () => list.forEach((a) => a.pause());
    if (still) pauseAll();
    else shuffleTimer.current = window.setTimeout(pauseAll, ((p < 0.4 ? 0.4 : 0.9) - p) * SHUFFLE_MS);
  };

  // The animations told to stop, kept here because the browser stops listing
  // an animation once it has finished: if the pointer comes back, these are
  // the ones to restart.
  const winding = React.useRef<Animation[]>([]);

  const startAnimating = () => {
    stopToken.current++;
    // Back before everything settled: keep looping instead of stopping. play()
    // restarts any that already finished or were cancelled.
    for (const a of winding.current) {
      a.effect?.updateTiming({ iterations: Infinity });
      a.play();
    }
    winding.current = [];
    playShuffle();
    setAnimating(true);
  };

  const stopAnimating = async () => {
    if (pointerIn.current || focusIn.current) return; // still hovered or focused
    const token = ++stopToken.current;
    pauseShuffleWhenStill();
    const animations = iconAnimations();
    winding.current = animations;
    const done = animations.map((a) => {
      const loop = a.effect?.getComputedTiming().currentIteration;
      if (loop == null) {
        // Still waiting for its start delay: nothing has moved, so just stop it.
        a.cancel();
        return Promise.resolve();
      }
      a.effect?.updateTiming({ iterations: loop + 1 }); // finish this loop, then stop
      return a.finished.then(() => undefined, () => undefined);
    });
    await Promise.all(done);
    if (token !== stopToken.current) return; // hovered again meanwhile
    winding.current = [];
    setAnimating(false);
  };

  return (
    <div data-prism={id}>
        <button
          ref={frontRef}
          type="button"
          className={`prism-mode-tile${animating ? " is-animating" : ""}`}
          onClick={onClick}
          onMouseEnter={() => {
            pointerIn.current = true;
            startAnimating();
          }}
          onMouseLeave={() => {
            pointerIn.current = false;
            stopAnimating();
          }}
          onFocus={() => {
            focusIn.current = true;
            startAnimating();
          }}
          onBlur={() => {
            focusIn.current = false;
            stopAnimating();
          }}
          aria-label={`${label}: ${tip}`}
          data-prism={`tile-${id.replace("mode-", "")}`}
        >
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              className="prism-star"
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDuration: "2400ms", animationDelay: `${s.delay}ms` }}
            />
          ))}
          <span className="prism-mode-center">
            {/* Same-height box for every icon, so the labels of tiles side
                by side sit at the same height. */}
            <span className="prism-mode-icon-box">{icon}</span>
            <span className="prism-mode-label">{label}</span>
          </span>
          <span className="prism-mode-tip">{tip}</span>
        </button>
    </div>
  );
}
