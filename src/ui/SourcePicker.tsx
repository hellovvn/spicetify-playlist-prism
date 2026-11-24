// Source picker: the user ticks playlists (and/or Liked Songs). Those are only
// READ. Shared by both modes so they look and work the same: the Prism flow
// (where songs may come FROM) and Organize (which playlists to split up).
// Each mode can set its own intro text, add its own settings (`extra`) and
// name the Next button.

import React from "react";
import {
  allShownSelected,
  clearShown,
  filterSources,
  selectedSongCount,
  selectShown,
  type SourceOption,
} from "../sources/sources";
import { toggleTag as toggleInList } from "./tagSelection"; // same on/off logic, for URIs
import { SCREEN_HEIGHT } from "./styles";

export interface SourcePickerProps {
  loadSources: () => Promise<SourceOption[]>;
  describeError: (error: unknown) => string;
  // Lifted up to the parent so the ticks survive going Back and Next again.
  selected: string[];
  setSelected: (uris: string[]) => void;
  onBack: () => void;
  onNext: (sources: SourceOption[]) => void;
  intro?: string; // text at the top (default: the Prism flow's)
  extra?: React.ReactNode; // mode-specific settings, shown above the buttons
  nextLabel?: string; // the Next button (default "Next: scan songs")
}

export function SourcePicker({ loadSources, describeError, selected, setSelected, onBack, onNext, intro, extra, nextLabel }: SourcePickerProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [sources, setSources] = React.useState<SourceOption[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  // Load the list once when this screen opens (same pattern as the seed).
  React.useEffect(() => {
    let closed = false;
    loadSources()
      .then((list) => !closed && setSources(list))
      .catch((err) => {
        console.error("[Playlist Prism] loading playlists failed", err);
        if (!closed) setError(describeError(err));
      });
    return () => {
      closed = true;
    };
  }, []);

  if (error) {
    return (
      <div style={styles.centered}>
        <p style={styles.text}>{error}</p>
      </div>
    );
  }
  if (!sources) {
    return (
      <div style={styles.centered} data-prism-state="loading">
        <div className="prism-spinner" />
        <p style={styles.subtext}>Loading your playlists...</p>
      </div>
    );
  }

  const shown = filterSources(sources, query);
  const songCount = selectedSongCount(sources, selected);
  const picked = sources.filter((s) => selected.includes(s.uri));
  const allSelected = allShownSelected(shown, selected);
  const someSelected = shown.some((s) => selected.includes(s.uri));

  return (
    <div style={styles.column} data-prism-state="sources">
      <p style={styles.subtext}>
        {intro ??
          "Pick where songs can come from. Only songs in these will be considered, and nothing in them is changed. A song in several playlists is only counted once."}
      </p>

      <input
        type="search"
        value={query}
        placeholder="Search your playlists"
        aria-label="Search your playlists"
        onChange={(event) => setQuery(event.target.value)}
        className="prism-glass-input"
      />

      {/* "Select all" row: acts on the SHOWN rows, so with a search typed it
          only ticks the matches. Its checkbox shows a dash ("indeterminate")
          when only some shown rows are ticked. It's always there (just
          disabled when nothing matches), so the layout never jumps. */}
      <label className="prism-row is-clickable is-head" style={{ ...styles.row, paddingBottom: 10, opacity: shown.length ? 1 : 0.5 }} data-prism="select-all">
          <input
            type="checkbox"
            disabled={shown.length === 0}
            checked={allSelected}
            // indeterminate can't be set as a JSX attribute, only on the element
            // itself, so a "ref callback" sets it after React draws the checkbox.
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={() => setSelected(allSelected ? clearShown(shown, selected) : selectShown(shown, selected))}
            className="prism-check"
          />
          <span style={styles.name}>
            {query.trim() ? `Select all ${shown.length} shown` : `Select all (${shown.length})`}
          </span>
        </label>

      {/* A scrolling list. Each row is a <label> wrapping a checkbox, so
          clicking anywhere on the row ticks it (and screen readers read the name). */}
      <div style={styles.list} data-prism="source-list">
        {shown.length === 0 && <p style={{ ...styles.subtext, padding: "8px 4px" }}>No playlists match "{query}".</p>}
        {shown.map((source) => (
          <label key={source.uri} className="prism-row is-clickable" style={styles.row}>
            <input
              type="checkbox"
              checked={selected.includes(source.uri)}
              onChange={() => setSelected(toggleInList(selected, source.uri))}
              className="prism-check"
            />
            <span style={styles.rowText}>
              <span style={styles.name}>{source.name}</span>
              <span style={styles.meta}>
                {[source.folder && `in ${source.folder}`, `${source.trackCount} songs`, source.owner && `by ${source.owner}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </label>
        ))}
      </div>

      <p style={styles.summary} data-prism="source-summary">
        {picked.length === 0
          ? "Nothing picked yet."
          : `${picked.length} picked · up to ${songCount} songs`}
      </p>

      {extra}

      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack}>
          Back
        </ButtonSecondary>
        <ButtonPrimary
          buttonSize="sm"
          disabled={picked.length === 0}
          onClick={() => picked.length > 0 && onNext(picked)}
          data-prism="sources-next"
        >
          {nextLabel ?? "Next: scan songs"}
        </ButtonPrimary>
      </div>
    </div>
  );
}

// The screen is ONE fixed height, whatever the search shows, so the popup
// never resizes while typing (and the buttons stay put under the mouse).
// The list takes whatever height is left (flex: 1) and scrolls inside it.
// SCREEN_HEIGHT is shared with the scan screen (src/ui/styles.ts).

const styles: Record<string, React.CSSProperties> = {
  column: { display: "flex", flexDirection: "column", gap: 12, height: SCREEN_HEIGHT },
  // The loading spinner uses the same height, so nothing jumps when the list arrives.
  centered: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 12, height: SCREEN_HEIGHT,
  },
  text: { color: "var(--spice-text)", margin: 0 },
  subtext: { color: "var(--spice-subtext)", margin: 0 },
  // minHeight: 0 lets a flex child shrink below its content and scroll instead.
  list: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 },
  // Keep the summary to one line so it can't change the layout either.
  summary: { color: "var(--spice-subtext)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  // Look (corners, lines, hover) comes from .prism-row in styles.ts.
  row: { display: "flex", alignItems: "center", gap: 12, padding: "8px" },
  rowText: { display: "flex", flexDirection: "column", minWidth: 0 },
  name: { color: "var(--spice-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { color: "var(--spice-subtext)", fontSize: 13 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
};
