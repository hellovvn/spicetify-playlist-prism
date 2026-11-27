// The side panel's two tabs (mockup "B", developer's pick 2026-11-25):
// "Prism stats" | "Now playing", the standard segmented choice (.prism-seg).
// Shown at the top of Prism's panel AND, when "Now playing" is picked, as a
// slim strip above Spotify's own Now Playing panel, so the user can always
// switch back. Drawn by src/ui/panelHost.tsx.
//
// With onMinimize, a standard icon button sits left of the tabs and collapses
// the right panel, like the button in Spotify's own Now Playing header (which
// Prism's panel covers, and which the strip hides so there's only one).

import React from "react";
import type { PanelView } from "./sidePanel";

interface PanelTabsProps {
  view: PanelView;
  onPick: (view: PanelView) => void;
  onMinimize?: () => void;
}

export function PanelTabs({ view, onPick, onMinimize }: PanelTabsProps) {
  const tab = (value: PanelView, label: string) => (
    <button
      type="button"
      className={view === value ? "on" : ""}
      aria-pressed={view === value}
      onClick={() => view !== value && onPick(value)}
      data-prism={`panel-tab-${value}`}
    >
      {label}
    </button>
  );
  const seg = (
    <div className="prism-seg" role="group" aria-label="Right panel shows" style={{ alignSelf: "center", flexShrink: 0 }} data-prism="panel-tabs">
      {tab("prism", "Prism stats")}
      {tab("spotify", "Now playing")}
    </div>
  );
  if (!onMinimize) return seg;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
      <button
        type="button"
        className="prism-icon-button"
        aria-label="Hide the side panel"
        title="Hide the side panel"
        onClick={onMinimize}
        data-prism="panel-minimize"
        style={{ display: "grid", placeItems: "center", padding: 0 }}
      >
        <MinimizeIcon />
      </button>
      {seg}
      <span style={{ width: 28, flexShrink: 0 }} aria-hidden="true" />
    </div>
  );
}

// The same picture as Spotify's own "Hide Now Playing view" button: a panel
// with an arrow pointing right (towards the edge it collapses to).
function MinimizeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M5.03 10.53a.75.75 0 1 1-1.06-1.06L5.44 8 3.97 6.53a.75.75 0 0 1 1.06-1.06l2 2a.75.75 0 0 1 0 1.06z" />
      <path d="M1 0a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm.5 1.5h8v13h-8zm13 13H11v-13h3.5z" />
    </svg>
  );
}
