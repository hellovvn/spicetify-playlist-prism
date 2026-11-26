// The score ring (docs/ui-elements.md "Score ring"): 52px, lavender-to-pink
// arc, the % in the middle. Its own file so the side panel (always-on bundle)
// can use it without pulling in the whole preview screen.

import React from "react";

export function ScoreRing({ score, label = "match", testId = "preview-score" }: { score: number; label?: string; testId?: string }) {
  const r = 20;
  const round = 2 * Math.PI * r;
  const pct = Math.round(score * 100);
  return (
    <svg width={52} height={52} viewBox="0 0 52 52" style={{ flexShrink: 0 }} data-prism={testId} role="img" aria-label={`${pct}% ${label}`}>
      <defs>
        <linearGradient id="prism-score-fill" x1="0" x2="1">
          <stop offset="0" stopColor="#cdb8ff" />
          <stop offset="1" stopColor="#ffb3c7" />
        </linearGradient>
      </defs>
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4} />
      <circle
        cx={26} cy={26} r={r} fill="none" stroke="url(#prism-score-fill)" strokeWidth={4} strokeLinecap="round"
        strokeDasharray={`${(round * pct) / 100} ${round}`} transform="rotate(-90 26 26)"
      />
      <text x={26} y={31} textAnchor="middle" fontSize={15} fontWeight={700} fill="#ffffff">
        {pct}
        <tspan fontSize={10}>%</tspan>
      </text>
    </svg>
  );
}
