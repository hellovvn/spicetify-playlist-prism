// "Pick a song" screen, shared by Grow a playlist and Add a song to your
// playlists (mockup "A", developer's pick 2026-11-26). Two OPTION ROWS (the
// song playing now / paste a song link), then the standard action row:
// Back + the purple main button, in the same spot as the playlist picker's
// (Merge, Remix). Same frame as SourcePicker: title, then a SCREEN_HEIGHT
// column with the action row at its bottom.
//
// Option row (docs/ui-elements.md): a <label class="prism-option"> holding a
// round radio (`.prism-option-dot`). Clicking or focusing the link box picks
// the link row.

import React from "react";
import { parseTrackLink } from "../nav";
import { SCREEN_HEIGHT } from "./styles";
import { filterSources, type SourceOption } from "../sources/sources";

export interface PlayingSong {
  uri: string;
  name: string;
  artists: string;
}

interface SongPickProps {
  id: string; // data-prism prefix, e.g. "grow" -> "grow-next", "grow-back"
  title: string;
  intro: string;
  hint: string;
  nextLabel: string;
  playing: PlayingSong | null;
  onPick: (uri: string) => void;
  onBack: () => void;
  // Grow only (2026-11-26): a third row "One of your playlists". Choosing it
  // opens the playlist picker under the rows (search, checkbox rows, summary;
  // look of the Remix picker, developer's pick), ONE tick at a time; Next
  // passes that playlist's URI to onPick. Left out (Add a song) =
  // no such row. null = still loading.
  playlists?: SourceOption[] | null;
}

type Choice = "playing" | "link" | "playlist";

export function SongPick({ id, title, intro, hint, nextLabel, playing, onPick, onBack, playlists }: SongPickProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [choice, setChoice] = React.useState<Choice>(playing ? "playing" : "link");
  const [link, setLink] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [playlist, setPlaylist] = React.useState<SourceOption | null>(null);
  const [query, setQuery] = React.useState("");

  // The song stopped (or isn't a song any more): the playing row can't be used.
  React.useEffect(() => {
    if (!playing && choice === "playing") setChoice("link");
  }, [playing, choice]);

  const canGo = choice === "playing" ? !!playing : choice === "playlist" ? !!playlist : link.trim() !== "";

  function next() {
    if (choice === "playing") {
      if (playing) onPick(playing.uri);
      return;
    }
    if (choice === "playlist") {
      if (playlist) onPick(playlist.uri);
      return;
    }
    const uri = parseTrackLink(link);
    if (!uri) {
      setLinkError("That isn't a Spotify song link. In Spotify: song's ... menu > Share > Copy Song Link.");
      return;
    }
    onPick(uri);
  }

  const radioName = `prism-${id}-song`;
  // The playlist row is open (its list takes the room left on the screen).
  const listOpen = choice === "playlist" && !!playlists;
  const shown = playlists ? filterSources(playlists, query) : [];

  return (
    <div className="prism-fade-in" data-prism-state={`${id}-pick`}>
      <h2 className="prism-screen-title" style={styles.title}>
        {title}
      </h2>
      <div style={styles.column}>
        {/* While the playlist picker is open, the intro and the rows' second
            lines hide, so the list gets more room. */}
        {!listOpen && <p style={styles.sub}>{intro}</p>}
        <div role="radiogroup" aria-label="Which song" style={styles.options}>
          <label className={`prism-option${choice === "playing" ? " on" : ""}${playing ? "" : " is-disabled"}`} data-prism={`${id}-option-playing`}>
            <input
              type="radio"
              name={radioName}
              className="prism-option-dot"
              checked={choice === "playing"}
              disabled={!playing}
              onChange={() => setChoice("playing")}
            />
            <span style={styles.optionText}>
              <span style={styles.label}>The song playing now</span>
              {listOpen ? null : playing ? (
                <span data-prism="playing-song">
                  {playing.name} · {playing.artists}
                </span>
              ) : (
                <span style={styles.sub}>Nothing is playing (or it isn't a song).</span>
              )}
            </span>
          </label>
          <label className={`prism-option${choice === "link" ? " on" : ""}`} data-prism={`${id}-option-link`}>
            <input
              type="radio"
              name={radioName}
              className="prism-option-dot"
              checked={choice === "link"}
              onChange={() => setChoice("link")}
            />
            <span style={styles.optionText}>
              <span style={styles.label}>Paste a song link</span>
              {/* Hidden while the playlist picker is open, to give it room. */}
              {!listOpen && <input
                value={link}
                placeholder="https://open.spotify.com/track/..."
                onFocus={() => setChoice("link")}
                onChange={(e) => {
                  setLink(e.target.value);
                  setLinkError(null);
                  setChoice("link");
                }}
                onKeyDown={(e) => e.key === "Enter" && canGo && next()}
                className="prism-glass-input"
                style={styles.input}
                aria-label="Spotify song link"
                data-prism="link-input"
              />}
              {linkError && (
                <span role="alert" style={styles.error}>
                  {linkError}
                </span>
              )}
            </span>
          </label>
          {playlists !== undefined && (
            <label className={`prism-option${choice === "playlist" ? " on" : ""}`} data-prism={`${id}-option-playlist`}>
              <input
                type="radio"
                name={radioName}
                className="prism-option-dot"
                checked={choice === "playlist"}
                onChange={() => setChoice("playlist")}
              />
              <span style={styles.optionText}>
                <span style={styles.label}>One of your playlists</span>
                {!listOpen && <span style={styles.sub}>
                  {playlist && choice !== "playlist" ? `${playlist.name} · ${playlist.trackCount} songs` : "Grow from all of a playlist's songs at once."}
                </span>}
              </span>
            </label>
          )}
        </div>
        {choice === "playlist" && playlists === null && <p style={styles.sub}>Loading your playlists...</p>}
        {listOpen ? (
          // The playlist picker (same look as SourcePicker on Remix / Merge /
          // Grow's sources), but ONE tick at a time and no "Select all".
          <>
            <input
              type="search"
              value={query}
              placeholder="Search your playlists"
              aria-label="Search your playlists"
              onChange={(e) => setQuery(e.target.value)}
              className="prism-glass-input"
              data-prism="seed-playlist-search"
            />
            <div style={styles.list} data-prism="seed-playlist-list">
              {shown.length === 0 && <p style={{ ...styles.sub, padding: "8px 4px" }}>No playlists match "{query}".</p>}
              {shown.map((source) => (
                <label key={source.uri} className="prism-row is-clickable" style={styles.row} data-uri={source.uri}>
                  <input
                    type="checkbox"
                    checked={playlist?.uri === source.uri}
                    onChange={() => setPlaylist(playlist?.uri === source.uri ? null : source)}
                    className="prism-checkbox"
                  />
                  <span style={styles.rowText}>
                    <span style={styles.rowName}>{source.name}</span>
                    <span style={styles.rowMeta}>
                      {[source.folder && `in ${source.folder}`, `${source.trackCount} songs`, source.owner && `by ${source.owner}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p style={styles.summary} data-prism="seed-playlist-summary">
              {playlist ? `${playlist.name} · ${playlist.trackCount} songs` : "Nothing picked yet."}
            </p>
          </>
        ) : (
          <>
            <p style={styles.hint}>{hint}</p>
            <div style={{ flex: 1 }} />
          </>
        )}
        <div className="prism-actions" style={styles.buttons}>
          <ButtonSecondary buttonSize="sm" onClick={onBack} data-prism={`${id}-back`}>
            Back
          </ButtonSecondary>
          <ButtonPrimary buttonSize="sm" disabled={!canGo} onClick={() => canGo && next()} data-prism={`${id}-next`}>
            {nextLabel}
          </ButtonPrimary>
        </div>
      </div>
    </div>
  );
}

// Title and column match SourcePicker's frame (Merge, Remix), so the action
// row lands in the same spot on every start screen.
const styles: Record<string, React.CSSProperties> = {
  title: { margin: "0 0 12px", height: 34, lineHeight: "34px" },
  column: { display: "flex", flexDirection: "column", gap: 12, height: SCREEN_HEIGHT },
  options: { display: "flex", flexDirection: "column", gap: 8 },
  optionText: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 },
  label: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600 },
  sub: { color: "var(--spice-subtext)", margin: 0 },
  hint: { margin: 0, color: "var(--spice-subtext)", fontSize: 12 },
  input: { width: "100%", boxSizing: "border-box", fontSize: 13, padding: "7px 12px" },
  error: { margin: 0, color: "#ffb3d1", fontSize: 12 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
  // The picker list takes the room left on the screen and scrolls.
  list: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 },
  summary: { color: "var(--spice-subtext)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  // Same as the playlist picker's rows (SourcePicker).
  row: { display: "flex", alignItems: "center", gap: 12, padding: "8px" },
  rowText: { display: "flex", flexDirection: "column", minWidth: 0 },
  rowName: { color: "var(--spice-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowMeta: { color: "var(--spice-subtext)", fontSize: 13 },
};
