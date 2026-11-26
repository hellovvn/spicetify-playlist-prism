// The side panel's two tabs (mockup "B", developer's pick 2026-11-25):
// "Prism stats" | "Now playing", the standard segmented choice (.prism-seg).
// Shown at the top of Prism's panel AND, when "Now playing" is picked, as a
// slim strip above Spotify's own Now Playing panel, so the user can always
// switch back. Drawn by src/ui/panelHost.tsx.

import React from "react";
import type { PanelView } from "./sidePanel";

export function PanelTabs({ view, onPick }: { view: PanelView; onPick: (view: PanelView) => void }) {
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
  return (
    <div className="prism-seg" role="group" aria-label="Right panel shows" style={{ alignSelf: "center", flexShrink: 0 }} data-prism="panel-tabs">
      {tab("prism", "Prism stats")}
      {tab("spotify", "Now playing")}
    </div>
  );
}
