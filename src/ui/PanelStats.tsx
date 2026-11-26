// Prism stats in Spotify's right-hand Now Playing panel (layout "P2",
// developer's pick): a slim strip with the song playing now at the top, then
// the open Prism playlist's stats: name and where it came from, the
// fingerprint bubbles, the tags it was built from, songs / length / tempo /
// top mood, the top genres as bars, the tempo split with the slowest and
// fastest song, the longest and shortest song, how close the songs are to
// the seed (grown playlists), the main lyrics moods, and a button to the
// full stats page.
//
// Shown by src/ui/panelHost.tsx on any playlist page: a saved record for
// playlists Prism made or organized, an estimate for the rest (with a
// "Scanning songs" line while the missing songs are looked up). The tabs
// ("Prism stats" | "Now playing") sit at the top. Read-only: nothing here
// changes Spotify.
//
// The root has the class "prism-cosmos" (styles.ts): the twilight background,
// and Spotify's buttons re-coloured lavender, like on Prism's own page.

import React from "react";
import { builtFromTags, chartRows, genreCounts, topMood, FAST_FROM, SLOW_BELOW, type PrismPlaylistRecord } from "../stats/playlistStats";
import { Fingerprint } from "./Fingerprint";
import { moodColour, tagColours } from "./tagLabels";
import { ExtraStats, toneFitText, useExtras, useToneFit } from "./ExtraStats";
import type { ToneSummary } from "../tone/tone";
import type { PlaylistExtras } from "../stats/playlistExtras";
import { formatClock, formatLength, madeOn, panelSubtitle } from "./sidePanel";
import { ScoreRing } from "./ScoreRing";
import type { ScanProgress } from "../scan/scan";

export interface NowPlaying {
  name: string;
  artists: string;
  image: string | null;
}

export interface PanelStatsProps {
  record: PrismPlaylistRecord;
  nowPlaying: NowPlaying | null;
  onOpenStats: () => void;
  loadExtras?: (uri: string) => Promise<PlaylistExtras>;
  loadToneFit?: (uri: string) => Promise<ToneSummary | null>;
  tabs?: React.ReactNode; // PanelTabs, at the very top
  scanning?: ScanProgress | null; // an estimate whose missing songs are being scanned
}

export function PanelStats({ record, nowPlaying, onOpenStats, loadExtras, loadToneFit, tabs, scanning }: PanelStatsProps) {
  const extras = useExtras(record.uri, loadExtras);
  const toneFit = useToneFit(record.uri, loadToneFit);
  const rows = chartRows(record, 6);
  const moreGenres = genreCounts(record).length - rows.length;
  const builtFrom = builtFromTags(record);
  // One colour per genre in this panel (bubbles, bars and chips match, no repeats).
  const colours = tagColours([...chartRows(record, 8).map((row) => row.name), ...builtFrom]);
  const colourOf = (name: string) => colours.get(name) ?? "#d5c2ff";
  const date = madeOn(record);
  const mood = topMood(record);
  const tempo = record.tempo;
  const tempoKnown = tempo ? tempo.slow + tempo.mid + tempo.fast : 0;
  const tempoParts: [string, number, string][] = tempo
    ? [
        ["slow", tempo.slow, "#a9cdff"],
        ["mid", tempo.mid, "#d5c2ff"],
        ["fast", tempo.fast, "#ffb8d9"],
      ]
    : [];
  const most = rows.length ? Math.max(...rows.map((r) => r.count)) : 1;
  const moods = record.moodCounts.slice(0, 3);

  return (
    <div className="prism-cosmos" style={styles.root} data-prism="panel-stats">
      <div style={styles.scroll}>
        {tabs}
        {nowPlaying && (
          <div style={styles.strip} data-prism="panel-now-playing">
            {nowPlaying.image ? <img src={nowPlaying.image} alt="" style={styles.art} /> : <div style={styles.art} />}
            <div style={{ minWidth: 0 }}>
              <p style={styles.songName}>{nowPlaying.name}</p>
              <p style={styles.small}>{nowPlaying.artists}</p>
            </div>
          </div>
        )}
        <div style={styles.divider} />

        <div>
          <p style={styles.title} data-prism="panel-name">
            {record.name}
          </p>
          <p style={styles.small}>
            {panelSubtitle(record)}
            {date ? ` · ${date}` : ""}
          </p>
        </div>

        {scanning && scanning.total > 0 && <ScanLine progress={scanning} />}

        {builtFrom.length > 0 && (
          <div style={styles.chips} data-prism="panel-built-from">
            {builtFrom.slice(0, 8).map((name) => (
              <span key={name} className="prism-tag shared" style={{ ["--tag" as any]: colourOf(name) }}>
                <span className="prism-tag-text">{name}</span>
              </span>
            ))}
          </div>
        )}

        <div className="prism-glass-panel" style={styles.fingerprint}>
          <Fingerprint rows={chartRows(record, 8)} size={200} colourOf={colourOf} />
        </div>

        {/* Numbers card, layout "B" (developer's pick 2026-11-25): the tone fit
            as the standard score ring on the left (only with a tone), the four
            numbers in a 2x2 grid beside it. */}
        <div className="prism-glass-panel" style={styles.quick}>
          {toneFit && toneFit.average !== null && (
            <div style={styles.ringCell} title={toneFitText(toneFit)} data-prism="panel-tone-fit">
              <ScoreRing score={toneFit.average} label="tone fit" testId="panel-tone-ring" />
              <p style={styles.small}>tone fit</p>
            </div>
          )}
          <div style={styles.quickGrid}>
            <Quick value={String(record.songCount)} label="songs" />
            <Quick value={record.length && record.length.known ? formatLength(record.length.totalMs) : "–"} label="length" />
            <Quick value={record.averageBpm ? String(record.averageBpm) : "–"} label="avg BPM" />
            <Quick value={mood ?? "–"} label="top mood" />
          </div>
        </div>

        {rows.length > 0 && (
          <div className="prism-glass-panel" style={styles.card} data-prism="panel-genres">
            <p style={styles.cardTitle}>Genre mix</p>
            {/* One grid for all rows: the label column fits the longest label (up
                to 130px; longer names wrap inside their pill) and the bars line up. */}
            <div style={styles.barGrid}>
              {rows.map((row, i) => (
                <React.Fragment key={row.name}>
                  <span className="prism-tag shared wrap" style={{ ...styles.tag, ["--tag" as any]: colourOf(row.name) }}>
                    <span className="prism-tag-text">{row.name}</span>
                  </span>
                  <span className="prism-bar-track">
                    <span
                      className="prism-bar-fill"
                      style={{ width: `${(row.count / most) * 100}%`, ["--tag" as any]: colourOf(row.name), ["--delay" as any]: `${i * 60}ms` }}
                    />
                  </span>
                  <span style={styles.count}>{row.count}</span>
                </React.Fragment>
              ))}
            </div>
            {moreGenres > 0 && <p style={styles.small}>+ {moreGenres} more genres</p>}
          </div>
        )}

        {tempo && tempoKnown > 0 && (
          <div className="prism-glass-panel" style={styles.card} data-prism="panel-tempo">
            <p style={styles.cardTitle}>Tempo</p>
            {/* One bar split in three: slow (under SLOW_BELOW BPM), mid, fast (FAST_FROM+). */}
            <span className="prism-bar-track" style={styles.splitTrack} title={`slow = under ${SLOW_BELOW} BPM, fast = ${FAST_FROM}+ BPM`}>
              {tempoParts.map(([label, count, colour]) =>
                count > 0 ? (
                  <span
                    key={label}
                    className="prism-bar-fill"
                    style={{ width: `${(count / tempoKnown) * 100}%`, borderRadius: 0, ["--tag" as any]: colour, ["--delay" as any]: "200ms" }}
                  />
                ) : null
              )}
            </span>
            <div style={styles.legend}>
              {tempoParts.map(([label, count, colour]) => (
                <span key={label} style={styles.legendItem}>
                  <span style={{ ...styles.dot, background: colour }} />
                  {count} {label}
                </span>
              ))}
            </div>
            {tempo.slowest && <Line label="Slowest" name={tempo.slowest.name} value={`${tempo.slowest.value} BPM`} />}
            {tempo.fastest && <Line label="Fastest" name={tempo.fastest.name} value={`${tempo.fastest.value} BPM`} />}
          </div>
        )}

        {record.length && (record.length.longest || record.length.shortest) && (
          <div className="prism-glass-panel" style={styles.card} data-prism="panel-lengths">
            <p style={styles.cardTitle}>Songs</p>
            {record.length.longest && <Line label="Longest" name={record.length.longest.name} value={formatClock(record.length.longest.value)} />}
            {record.length.shortest && <Line label="Shortest" name={record.length.shortest.name} value={formatClock(record.length.shortest.value)} />}
          </div>
        )}

        {record.match && (
          <div className="prism-glass-panel" style={styles.card} data-prism="panel-match">
            <p style={styles.cardTitle}>Match to the seed song</p>
            <p style={styles.big}>{Math.round(record.match.average * 100)}% average</p>
            {record.match.best && <Line label="Closest" name={record.match.best.name} value={`${Math.round(record.match.best.value * 100)}%`} />}
          </div>
        )}

        {extras && <ExtraStats extras={extras} compact />}

        {moods.length > 0 && (
          <div className="prism-glass-panel" style={styles.card}>
            <p style={styles.cardTitle}>Mood mix</p>
            <div style={styles.chips}>
              {moods.map(([mood, count]) => (
                <span key={mood} className="prism-tag shared mood" style={{ ["--tag" as any]: moodColour(mood) }}>
                  <span className="prism-tag-text">{mood}</span>
                  <span className="prism-tag-count">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}>
          <button type="button" className="prism-glass-button" onClick={onOpenStats} data-prism="panel-open-stats">
            View full stats
          </button>
        </div>
      </div>
    </div>
  );
}

// "Slowest: Song name · 72 BPM", with long names cut off neatly.
function Line({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <p style={styles.line}>
      <span style={{ color: "#cdb8ff" }}>{label}: </span>
      <b>{name}</b> · {value}
    </p>
  );
}

// "Scanning songs…" + the standard progress bar + "12 of 30" (the Inline
// progress element in docs/ui-elements.md).
function ScanLine({ progress }: { progress: ScanProgress }) {
  const percent = Math.round((progress.done / progress.total) * 100);
  return (
    <div style={styles.scanLine} role="status" data-prism="panel-scanning">
      <span>Scanning songs…</span>
      <span className="prism-progress" style={styles.scanBar}>
        <span className="prism-progress-fill" style={{ display: "block", width: `${percent}%` }} />
      </span>
      <span style={styles.scanCount}>
        {progress.done} of {progress.total}
      </span>
    </div>
  );
}

function Quick({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={styles.quickValue}>{value}</p>
      <p style={styles.small}>{label}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { position: "absolute", inset: 0, borderRadius: 8, color: "#ffffff" },
  scroll: { position: "relative", zIndex: 1, height: "100%", overflowY: "auto", boxSizing: "border-box", padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  strip: { display: "flex", alignItems: "center", gap: 10 },
  art: { width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.08)" },
  songName: { margin: 0, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  small: { margin: 0, fontSize: 12, color: "#cdb8ff", overflow: "hidden", textOverflow: "ellipsis" },
  divider: { borderTop: "1px solid rgba(255,255,255,0.15)" },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: "#f3e8ff" },
  fingerprint: { display: "flex", justifyContent: "center", padding: "10px 0" },
  quick: { display: "flex", alignItems: "center", justifyContent: "space-evenly", gap: 16, padding: 12 },
  ringCell: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 },
  // Columns as wide as their numbers with one even gap; the ring and this grid
  // are spread evenly across the card (equal halves left a wide gap after short numbers).
  quickGrid: { flex: "0 1 auto", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, max-content))", rowGap: 10, columnGap: 28 },
  quickValue: { margin: 0, fontSize: 16, fontWeight: 700 },
  card: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 },
  cardTitle: { margin: 0, fontSize: 12, fontWeight: 700, color: "#cdb8ff" },
  barGrid: { display: "grid", gridTemplateColumns: "fit-content(130px) 1fr 24px", alignItems: "center", columnGap: 8, rowGap: 6 },
  tag: { justifySelf: "start" },
  count: { fontWeight: 600, fontSize: 12, fontVariantNumeric: "tabular-nums" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  splitTrack: { display: "flex", overflow: "hidden" },
  legend: { display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: "50%" },
  line: { margin: 0, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  big: { margin: 0, fontSize: 16, fontWeight: 700 },
  scanLine: { display: "flex", alignItems: "center", gap: 8, fontSize: 12 },
  scanBar: { flex: "1 1 auto", maxWidth: 140, display: "block" },
  scanCount: { color: "#cdb8ff", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
};
