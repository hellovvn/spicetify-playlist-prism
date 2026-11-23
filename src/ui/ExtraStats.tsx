// The live extra stats as glass panels: Artists, Eras, Key. Used by the full
// stats page (StatsScreen) and the side panel (PanelStats, compact).
// The numbers come from src/stats/playlistExtras.ts, loaded once per
// playlist (useExtras below). Read-only.

import React from "react";
import type { PlaylistExtras } from "../stats/playlistExtras";

// Loads the extras for one playlist. null = still loading or failed (the
// panels are then simply not shown; the rest of the stats don't wait).
export function useExtras(uri: string, load: ((uri: string) => Promise<PlaylistExtras>) | undefined): PlaylistExtras | null {
  const [extras, setExtras] = React.useState<PlaylistExtras | null>(null);
  React.useEffect(() => {
    if (!load) return;
    let closed = false;
    setExtras(null);
    load(uri)
      .then((loaded) => !closed && setExtras(loaded))
      .catch((error) => console.warn("[Playlist Prism] couldn't load artist/era/key stats", error));
    return () => {
      closed = true;
    };
  }, [uri, load]);
  return extras;
}

const ERA_COLOURS = ["#a9cdff", "#d5c2ff", "#ffb8d9", "#ffe2a8", "#a8ecc9", "#ffc6ad", "#a6eaf2"];
const MAJOR = "#ffe2a8";
const MINOR = "#b9bfff";

export function ExtraStats({ extras, compact = false }: { extras: PlaylistExtras; compact?: boolean }) {
  const s = compact ? small : big;
  const keyed = extras.major + extras.minor;
  const eraMost = Math.max(1, ...extras.decades.map(([, n]) => n));
  return (
    <>
      <section className="prism-glass-panel" style={s.panel} data-prism="stats-artists">
        <h3 style={s.heading}>Artists</h3>
        <p style={s.big}>
          {extras.songCount} songs from {extras.artistCount} artist{extras.artistCount === 1 ? "" : "s"}
        </p>
        {extras.topArtists.slice(0, compact ? 3 : 5).map(([name, count]) => (
          <p key={name} style={s.line}>
            <b>{name}</b> · {count} song{count === 1 ? "" : "s"}
          </p>
        ))}
      </section>

      {extras.decades.length > 0 && (
        <section className="prism-glass-panel" style={s.panel} data-prism="stats-eras">
          <h3 style={s.heading}>Eras</h3>
          <div style={s.eraGrid}>
            {extras.decades.map(([decade, count], i) => (
              <React.Fragment key={decade}>
                <span style={s.label}>{decade}</span>
                <span className="prism-bar-track">
                  <span
                    className="prism-bar-fill"
                    style={{ width: `${(count / eraMost) * 100}%`, ["--tag" as any]: ERA_COLOURS[i % ERA_COLOURS.length], ["--delay" as any]: `${i * 60}ms` }}
                  />
                </span>
                <span style={s.count}>{count}</span>
              </React.Fragment>
            ))}
          </div>
          {extras.oldest && (
            <p style={s.line}>
              Oldest: <b>{extras.oldest.name}</b> · {extras.oldest.year}
            </p>
          )}
          {extras.newest && (
            <p style={s.line}>
              Newest: <b>{extras.newest.name}</b> · {extras.newest.year}
            </p>
          )}
        </section>
      )}

      {keyed > 0 && (
        <section className="prism-glass-panel" style={s.panel} data-prism="stats-key">
          <h3 style={s.heading}>Key</h3>
          {/* One bar split in two: major keys usually sound brighter, minor keys darker or moodier. */}
          <span className="prism-bar-track" style={{ display: "flex", overflow: "hidden" }}>
            {extras.major > 0 && (
              <span className="prism-bar-fill" style={{ width: `${(extras.major / keyed) * 100}%`, borderRadius: 0, ["--tag" as any]: MAJOR }} />
            )}
            {extras.minor > 0 && (
              <span className="prism-bar-fill" style={{ width: `${(extras.minor / keyed) * 100}%`, borderRadius: 0, ["--tag" as any]: MINOR }} />
            )}
          </span>
          <div style={s.legend}>
            <span style={s.legendItem}>
              <span style={{ ...s.dot, background: MAJOR }} />
              {extras.major} major (brighter)
            </span>
            <span style={s.legendItem}>
              <span style={{ ...s.dot, background: MINOR }} />
              {extras.minor} minor (moodier)
            </span>
          </div>
          {extras.topKey && (
            <p style={s.line}>
              Most common key: <b>{extras.topKey}</b>
            </p>
          )}
        </section>
      )}
    </>
  );
}

const shared: Record<string, React.CSSProperties> = {
  line: { margin: 0, fontSize: 12, color: "var(--spice-subtext)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  label: { fontSize: 12, color: "var(--spice-text)", fontVariantNumeric: "tabular-nums" },
  count: { fontSize: 13, fontWeight: 600, color: "#ffffff", fontVariantNumeric: "tabular-nums" },
  eraGrid: { display: "grid", gridTemplateColumns: "max-content 1fr auto", alignItems: "center", columnGap: 8, rowGap: 6 },
  legend: { display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "var(--spice-subtext)" },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: "50%" },
};
const big: Record<string, React.CSSProperties> = {
  ...shared,
  panel: { display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px", minWidth: 0 },
  // Same sizes as the stats page's own panels (StatsScreen.tsx).
  heading: { margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "var(--spice-subtext)" },
  big: { margin: 0, fontSize: 16, fontWeight: 700, color: "#ffffff" },
};
const small: Record<string, React.CSSProperties> = {
  ...shared,
  panel: { display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", minWidth: 0 },
  heading: { margin: 0, fontSize: 12, fontWeight: 700, color: "#cdb8ff" },
  big: { margin: 0, fontSize: 13, fontWeight: 700, color: "#ffffff" },
};
