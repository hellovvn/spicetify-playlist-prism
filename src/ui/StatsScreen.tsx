// Playlist stats page (step 12e): how a Prism playlist was made.
// Opened by right-clicking a Prism playlist > "Prism stats".
//
// Shows: the playlist's name, its seed song and date, its "Prism fingerprint"
// (a rainbow artwork made from its genre mix), the tags it was built from,
// four stat cards (songs, length, average tempo, top mood), the genre mix as
// frosted glass bars, and glass panels for the lyrics-mood mix, the tempo
// spread, how close the songs are to the seed, and the longest/shortest song.
//
// The numbers come from the record saved when the playlist was created, or,
// for other playlists, an estimate from songs Prism has scanned
// (src/stats/playlistStats.ts, loadPlaylistStats in src/flow.ts).
// It's read-only: nothing here changes Spotify.

import React from "react";
import { chartRows, FAST_FROM, SLOW_BELOW, topMood, type PrismPlaylistRecord } from "../stats/playlistStats";
import { Fingerprint } from "./Fingerprint";
import { tagColour } from "./tagLabels";
import { TagLabels } from "./GenreLabels";

export interface StatsScreenProps {
  // Loads the stats (saved record or estimate). Called once when the screen opens.
  load: () => Promise<PrismPlaylistRecord>;
  onOpenPlaylist?: (uri: string) => void;
}

export function StatsScreen({ load, onOpenPlaylist }: StatsScreenProps) {
  const [record, setRecord] = React.useState<PrismPlaylistRecord | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let closed = false;
    load()
      .then((loaded) => !closed && setRecord(loaded))
      .catch((error) => {
        console.error("[Playlist Prism] loading playlist stats failed", error);
        if (!closed) setFailed(true);
      });
    return () => {
      closed = true;
    };
  }, []);

  if (failed) {
    return (
      <div className="prism-fade-in" style={styles.empty} data-prism-state="stats-missing">
        <p style={styles.text}>Couldn't read this playlist.</p>
        <p style={styles.subtext}>It may have been deleted, or Spotify didn't answer. Details are in the console.</p>
      </div>
    );
  }
  if (!record) {
    return (
      <div style={{ ...styles.empty, alignItems: "center" }} data-prism-state="stats-loading">
        <div className="prism-spinner" />
        <p style={styles.subtext}>Counting genres...</p>
      </div>
    );
  }
  return <StatsContent record={record} onOpenPlaylist={onOpenPlaylist} />;
}

function StatsContent({ record, onOpenPlaylist }: { record: PrismPlaylistRecord; onOpenPlaylist?: (uri: string) => void }) {
  const { ButtonSecondary } = Spicetify.ReactComponent as any;
  const rows = chartRows(record);
  const mood = topMood(record);
  const date =
    record.createdAt === null
      ? null
      : new Date(record.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const estimate = record.estimate;

  return (
    <div className="prism-fade-in" style={styles.screen} data-prism-state="stats">
      <div style={styles.titleRow}>
        <div style={{ minWidth: 0 }}>
          <h2 style={styles.name} data-prism="stats-name">
            {record.name}
          </h2>
          <p style={styles.subtext}>
            {record.seed
              ? `Made from "${record.seed.name}" by ${record.seed.artists.join(", ")}${date ? ` · ${date}` : ""}`
              : `${record.songCount} songs`}
          </p>
        </div>
        <div style={styles.titleSide}>
          <Fingerprint rows={chartRows(record, 8)} size={96} />
          {onOpenPlaylist && (
            <ButtonSecondary buttonSize="sm" onClick={() => onOpenPlaylist(record.uri)} data-prism="stats-open">
              Open playlist
            </ButtonSecondary>
          )}
        </div>
      </div>

      {estimate ? (
        // No saved record: say what the numbers are based on.
        <p className="prism-notice" style={styles.estimate} data-prism="stats-estimate">
          {estimate.scanned === 0
            ? "Prism hasn't scanned any songs in this playlist yet, so there's no genre mix. Pick it as a source in a Prism to scan it."
            : `Worked out from the ${estimate.scanned} of ${record.songCount} songs Prism has scanned before. Which tags it was built from wasn't saved back then.`}
        </p>
      ) : (
        <section>
          <h3 style={styles.heading}>Built from these tags</h3>
          <TagLabels labels={record.keptTags.map((name) => ({ name, colour: tagColour(name), shared: true }))} />
        </section>
      )}

      <div style={styles.cards}>
        <StatCard label="Songs" value={String(record.songCount)} />
        <StatCard label="Length" value={record.length && record.length.known ? formatLength(record.length.totalMs) : "–"} small />
        <StatCard label="Average tempo" value={record.averageBpm ? String(record.averageBpm) : "–"} unit={record.averageBpm ? "BPM" : ""} />
        <StatCard label="Top mood" value={mood ?? "–"} small />
      </div>

      <section className="prism-glass-panel" style={styles.chart} data-prism="stats-chart">
        <h3 style={styles.heading}>Genre mix</h3>
        {rows.map((row, i) => (
          <div key={row.name} style={styles.barRow} title={`${row.count} of ${estimate ? estimate.scanned : record.songCount} songs`}>
            <span className="prism-tag shared" style={{ ...styles.barLabel, ["--tag" as any]: tagColour(row.name) }}>
              <span className="prism-tag-text">{row.name}</span>
            </span>
            <span className="prism-bar-track">
              <span
                className="prism-bar-fill"
                // --tag: the bar's colour; --delay: bars grow in one after another.
                style={{ width: `${row.share * 100}%`, ["--tag" as any]: tagColour(row.name), ["--delay" as any]: `${i * 60}ms` }}
              />
            </span>
            <span style={styles.barCount}>{row.count}</span>
          </div>
        ))}
        {rows.length === 0 && <p style={styles.subtext}>No genres to show yet.</p>}
        <p style={styles.note}>
          Number of {estimate ? "scanned " : ""}songs with each tag (a song can have several).
        </p>
      </section>

      <div style={styles.twoCols}>
        <MoodMix record={record} />
        <TempoPanel record={record} />
      </div>
      <div style={styles.twoCols}>
        <MatchPanel record={record} />
        <LengthPanel record={record} />
      </div>
    </div>
  );
}

// ----- Panels -----

// A colour per lyrics mood, from the same pastel family as the genres.
const MOOD_COLOURS: Record<string, string> = {
  love: "#ff8cc3",
  heartbreak: "#be9bff",
  desire: "#f08cff",
  party: "#ffcd6e",
  anger: "#ffa07a",
  dark: "#78b4ff",
  hopeful: "#6ee1aa",
  numb: "#5fd7e6",
};

// Lyrics moods as small glass bars (longest = the most common mood).
function MoodMix({ record }: { record: PrismPlaylistRecord }) {
  const most = record.moodCounts.reduce((max, [, n]) => Math.max(max, n), 1);
  return (
    <section className="prism-glass-panel" style={styles.panel} data-prism="stats-moods">
      <h3 style={styles.heading}>Mood mix (from lyrics)</h3>
      {record.moodCounts.length === 0 && <p style={styles.subtext}>No lyrics moods known yet.</p>}
      {record.moodCounts.slice(0, 5).map(([mood, count], i) => (
        <div key={mood} style={styles.smallBarRow}>
          <span style={styles.smallLabel}>{mood}</span>
          <span className="prism-bar-track" style={styles.thinTrack}>
            <span
              className="prism-bar-fill"
              style={{ width: `${(count / most) * 100}%`, ["--tag" as any]: MOOD_COLOURS[mood] ?? "#be9bff", ["--delay" as any]: `${300 + i * 60}ms` }}
            />
          </span>
          <span style={styles.smallCount}>{count}</span>
        </div>
      ))}
    </section>
  );
}

// Slow / mid / fast as one glass bar split in three, plus slowest & fastest.
function TempoPanel({ record }: { record: PrismPlaylistRecord }) {
  const tempo = record.tempo;
  const known = tempo ? tempo.slow + tempo.mid + tempo.fast : 0;
  const parts: [string, number, string][] = tempo
    ? [
        [`slow (under ${SLOW_BELOW})`, tempo.slow, "#78b4ff"],
        ["mid", tempo.mid, "#be9bff"],
        [`fast (${FAST_FROM}+)`, tempo.fast, "#ff8cc3"],
      ]
    : [];
  return (
    <section className="prism-glass-panel" style={styles.panel} data-prism="stats-tempo">
      <h3 style={styles.heading}>Tempo</h3>
      {!tempo || known === 0 ? (
        <p style={styles.subtext}>No BPMs known.</p>
      ) : (
        <>
          <span className="prism-bar-track" style={styles.splitTrack}>
            {parts.map(([label, count, colour]) =>
              count > 0 ? (
                <span
                  key={label}
                  className="prism-bar-fill"
                  title={`${count} ${label}`}
                  style={{ width: `${(count / known) * 100}%`, borderRadius: 0, ["--tag" as any]: colour, ["--delay" as any]: "300ms" }}
                />
              ) : null
            )}
          </span>
          <div style={styles.legend}>
            {parts.map(([label, count, colour]) => (
              <span key={label} style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: colour }} />
                {count} {label}
              </span>
            ))}
          </div>
          {tempo.slowest && (
            <p style={styles.line}>
              Slowest: <b>{tempo.slowest.name}</b> · {tempo.slowest.value} BPM
            </p>
          )}
          {tempo.fastest && (
            <p style={styles.line}>
              Fastest: <b>{tempo.fastest.name}</b> · {tempo.fastest.value} BPM
            </p>
          )}
        </>
      )}
    </section>
  );
}

// How close the picked songs are to the seed (saved at creation only).
function MatchPanel({ record }: { record: PrismPlaylistRecord }) {
  const match = record.match;
  const most = match ? Math.max(1, ...match.bands.map(([, n]) => n)) : 1;
  return (
    <section className="prism-glass-panel" style={styles.panel} data-prism="stats-match">
      <h3 style={styles.heading}>How close to the seed</h3>
      {!match ? (
        <p style={styles.subtext}>
          Only known for playlists Prism makes from now on (it saves each song's match score when it creates them).
        </p>
      ) : (
        <>
          <p style={styles.line}>
            Average match <b>{Math.round(match.average * 100)}%</b>
          </p>
          {match.bands.map(([band, count], i) => (
            <div key={band} style={styles.smallBarRow}>
              <span style={styles.smallLabel}>{band}</span>
              <span className="prism-bar-track" style={styles.thinTrack}>
                <span
                  className="prism-bar-fill"
                  style={{ width: `${(count / most) * 100}%`, ["--tag" as any]: "#cdb8ff", ["--delay" as any]: `${300 + i * 60}ms` }}
                />
              </span>
              <span style={styles.smallCount}>{count}</span>
            </div>
          ))}
          {match.best && (
            <p style={styles.line}>
              Closest: <b>{match.best.name}</b> · {Math.round(match.best.value * 100)}%
            </p>
          )}
        </>
      )}
    </section>
  );
}

// Total length plus the longest and shortest song.
function LengthPanel({ record }: { record: PrismPlaylistRecord }) {
  const length = record.length;
  return (
    <section className="prism-glass-panel" style={styles.panel} data-prism="stats-length">
      <h3 style={styles.heading}>Song lengths</h3>
      {!length || length.known === 0 ? (
        <p style={styles.subtext}>Song lengths weren't saved for this playlist.</p>
      ) : (
        <>
          <p style={styles.bigLine}>{formatLength(length.totalMs)}</p>
          {length.known < record.songCount && (
            <p style={styles.subtext}>
              for {length.known} of {record.songCount} songs
            </p>
          )}
          {length.longest && (
            <p style={styles.line}>
              Longest: <b>{length.longest.name}</b> · {formatClock(length.longest.value)}
            </p>
          )}
          {length.shortest && (
            <p style={styles.line}>
              Shortest: <b>{length.shortest.name}</b> · {formatClock(length.shortest.value)}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// 6744000 ms -> "1 h 52 min"; under an hour -> "48 min".
function formatLength(ms: number): string {
  const minutes = Math.round(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

// 146000 ms -> "2:26".
function formatClock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}


function StatCard({ label, value, unit = "", small = false }: { label: string; value: string; unit?: string; small?: boolean }) {
  return (
    <div className="prism-glass-panel" style={styles.card}>
      <span style={styles.cardLabel}>{label}</span>
      <span style={{ ...styles.cardValue, fontSize: small ? 18 : 24 }}>
        {value} {unit && <span style={styles.cardUnit}>{unit}</span>}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: { display: "flex", flexDirection: "column", gap: 16 },
  empty: { display: "flex", flexDirection: "column", gap: 6, padding: "32px 0" },
  titleRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  name: {
    margin: 0, fontSize: 24, fontWeight: 300, letterSpacing: "0.02em", color: "#ffffff",
    fontFamily: '"Segoe UI Variable Display", "Segoe UI", sans-serif',
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  text: { margin: 0, color: "var(--spice-text)", fontWeight: 700 },
  subtext: { margin: 0, color: "var(--spice-subtext)", fontSize: 13 },
  heading: { margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--spice-subtext)" },
  cards: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 },
  titleSide: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 },
  twoCols: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  panel: { display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px", minWidth: 0 },
  smallBarRow: { display: "grid", gridTemplateColumns: "84px 1fr 24px", alignItems: "center", gap: 8 },
  smallLabel: { color: "var(--spice-text)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  smallCount: { color: "#ffffff", fontWeight: 600, fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  thinTrack: { height: 8 },
  splitTrack: { display: "flex", height: 14 },
  legend: { display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "var(--spice-subtext)" },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: "50%" },
  line: { margin: 0, fontSize: 12, color: "var(--spice-subtext)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  bigLine: { margin: 0, fontSize: 22, fontWeight: 600, color: "#ffffff" },
  card: { display: "flex", flexDirection: "column", gap: 2, padding: "12px 14px" },
  cardLabel: { color: "var(--spice-subtext)", fontSize: 12 },
  cardValue: { color: "#ffffff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cardUnit: { fontSize: 13, fontWeight: 400, color: "var(--spice-subtext)" },
  chart: { display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px" },
  barRow: { display: "grid", gridTemplateColumns: "120px 1fr 32px", alignItems: "center", gap: 10 },
  barLabel: { justifySelf: "start", maxWidth: 120, overflow: "hidden" },
  barCount: { color: "#ffffff", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  note: { margin: "4px 0 0", color: "var(--spice-subtext)", fontSize: 12 },
  estimate: { fontSize: 13 },
};
