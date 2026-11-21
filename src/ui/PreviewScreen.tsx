// Preview screen: screen 4 of the Prism popup. Shows every matching song,
// best first, with its score and WHY it matched. The best ones start ticked;
// the user can change any tick. The seed song is always first.
//
// Nothing is created here: "Create playlist" hands the picks to step 9.

import React from "react";
import type { ScannedSong } from "../scan/scan";
import { defaultPicks, rankSongs, type RankedSong } from "../scoring/rank";
import type { SourcedTag } from "../tags/combineTags";
import { formatAudio } from "../spotify/audio";
import { allShownSelected, clearShown, selectShown } from "../sources/sources";
import type { SeedData } from "./SeedPanel";
import { SCREEN_HEIGHT } from "./styles";
import { toggleTag as toggleInList } from "./tagSelection";

export interface PreviewScreenProps {
  seed: SeedData;
  kept: SourcedTag[]; // the seed tags the user kept ON
  songs: ScannedSong[]; // everything the scan found
  onBack: () => void;
  onCreate: (picked: RankedSong[]) => void;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function PreviewScreen({ seed, kept, songs, onBack, onCreate }: PreviewScreenProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;

  // useMemo: remember the ranking and only recompute it if its inputs change,
  // not on every tick of a checkbox (ranking 900 songs is wasted work to repeat).
  const ranking = React.useMemo(
    () => rankSongs({ ...seed.track, tags: kept, audio: seed.audio }, songs),
    [seed, kept, songs]
  );
  // The RECOMMENDED songs (top 30 by rank) start ticked; the user unticks
  // what they don't want. The other matches are hidden under "Show more".
  const recommendedUris = React.useMemo(() => defaultPicks(ranking.matches), [ranking]);
  const [picked, setPicked] = React.useState<string[]>(recommendedUris);
  const [showMore, setShowMore] = React.useState(false);

  const { matches, noMatch } = ranking;
  const recommended = matches.filter((m) => recommendedUris.includes(m.uri));
  const more = matches.filter((m) => !recommendedUris.includes(m.uri));
  // "Select all" (for the recommended list) reuses the playlist picker's helpers.
  const asRows = recommended.map((m) => ({ uri: m.uri, name: m.name, trackCount: 0, folder: null, owner: "" }));
  const allTicked = allShownSelected(asRows, picked);
  const someTicked = recommended.some((m) => picked.includes(m.uri));
  const pickedSongs = matches.filter((m) => picked.includes(m.uri));

  const renderRow = (song: RankedSong) => (
    <label
      key={song.uri}
      style={styles.row}
      // A tooltip with the full breakdown, on hover.
      title={breakdown(song)}
    >
      <input
        type="checkbox"
        checked={picked.includes(song.uri)}
        onChange={() => setPicked(toggleInList(picked, song.uri))}
        style={styles.checkbox}
      />
      <span style={styles.rowText}>
        <span style={styles.name}>{song.name}</span>
        <span style={styles.meta}>
          {song.artists.join(", ")} · {song.match.matchedTags.join(", ")}
          {song.tagStatus === "artist" ? " (artist tags)" : ""}
        </span>
      </span>
      <span style={styles.score} data-prism="preview-score">
        {percent(song.match.score)}
      </span>
    </label>
  );

  return (
    <div style={styles.screen} data-prism-state="preview">
      <p style={styles.subtext}>
        {matches.length === 0
          ? "No songs in those playlists share this vibe's tags."
          : `We recommend these ${recommended.length} songs, best first. Untick any you don't want.`}
      </p>

      {/* The seed: always first in the playlist, can't be unticked. */}
      <div style={{ ...styles.row, ...styles.seedRow }} data-prism="preview-seed">
        <span style={styles.lockedTick}>✓</span>
        <span style={styles.rowText}>
          <span style={styles.name}>{seed.track.name}</span>
          <span style={styles.meta}>{seed.track.artists.join(", ")} · seed song, always first</span>
        </span>
      </div>

      {recommended.length > 0 && (
        <label style={{ ...styles.row, ...styles.selectAllRow }} data-prism="preview-select-all">
          <input
            type="checkbox"
            checked={allTicked}
            ref={(el) => {
              if (el) el.indeterminate = someTicked && !allTicked;
            }}
            onChange={() => setPicked(allTicked ? clearShown(asRows, picked) : selectShown(asRows, picked))}
            style={styles.checkbox}
          />
          <span style={styles.name}>All recommended ({recommended.length})</span>
        </label>
      )}

      <div style={styles.list} data-prism="preview-list">
        <div data-prism="preview-recommended">{recommended.map(renderRow)}</div>

        {/* Other matches, weaker than the recommended ones. Hidden at first;
            the user can open the list and tick any to add them. */}
        {more.length > 0 && (
          <>
            <button
              type="button"
              style={styles.moreToggle}
              data-prism="preview-more-toggle"
              aria-expanded={showMore}
              onClick={() => setShowMore(!showMore)}
            >
              {showMore ? "▾ Hide" : "▸ Show"} {more.length} more matches (weaker, not ticked)
            </button>
            {showMore && <div data-prism="preview-more">{more.map(renderRow)}</div>}
          </>
        )}
      </div>

      <p style={styles.note}>
        {noMatch > 0 ? `${noMatch} scanned songs share none of the tags and were left out. ` : ""}
        Hover a song to see its score breakdown.
      </p>

      <div style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack}>
          Back
        </ButtonSecondary>
        <ButtonPrimary buttonSize="sm" onClick={() => onCreate(pickedSongs)}>
          Create playlist ({pickedSongs.length + 1} songs)
        </ButtonPrimary>
      </div>
    </div>
  );
}

// e.g. "Score 82% · tags 90% (r&b, dark) · tempo 75% (98 BPM, G minor (6A)) · key 80%"
function breakdown(song: RankedSong): string {
  const parts = [`Score ${percent(song.match.score)}`, `tags ${percent(song.match.tagScore)} (${song.match.matchedTags.join(", ")})`];
  parts.push(song.match.bpmScore === null ? "tempo unknown" : `tempo ${percent(song.match.bpmScore)}`);
  parts.push(song.match.keyScore === null ? "key unknown" : `key ${percent(song.match.keyScore)}`);
  return `${parts.join(" · ")}\n${formatAudio(song.audio)}`;
}

const styles: Record<string, React.CSSProperties> = {
  screen: { display: "flex", flexDirection: "column", gap: 10, height: SCREEN_HEIGHT },
  subtext: { color: "var(--spice-subtext)", margin: 0 },
  note: { color: "var(--spice-subtext)", margin: 0, fontSize: 13, height: "3em", overflow: "hidden" },
  list: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "6px 4px", borderRadius: 4, cursor: "pointer" },
  seedRow: { background: "var(--spice-card)", cursor: "default" },
  selectAllRow: { borderBottom: "1px solid var(--spice-card)", borderRadius: 0 },
  lockedTick: { width: 18, textAlign: "center", color: "var(--spice-button)", fontWeight: 700, flexShrink: 0 },
  checkbox: { width: 18, height: 18, accentColor: "var(--spice-button)", cursor: "pointer", flexShrink: 0 },
  rowText: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  name: { color: "var(--spice-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { color: "var(--spice-subtext)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  score: {
    color: "var(--spice-text)", fontWeight: 700, fontVariantNumeric: "tabular-nums",
    minWidth: 44, textAlign: "right", flexShrink: 0,
  },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
  moreToggle: {
    background: "none", border: "none", padding: "10px 4px", textAlign: "left", cursor: "pointer",
    color: "var(--spice-subtext)", fontWeight: 600, fontSize: 14,
  },
};
