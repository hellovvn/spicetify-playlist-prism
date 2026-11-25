// "Add with Prism" on the Prism page: the 5 playlists that fit a song best,
// each with its score ring, the shared genres, and an Add button. Reached
// from the right-click flyout's "More on the Prism page…" and from the start
// page's "Add a song to your playlists" bar (which first asks for a song:
// the one playing now, or a pasted link).
// Built only from existing elements (docs/ui-elements.md): list rows, score
// ring, tag labels, secondary buttons, notice, glass input.

import React from "react";
import type { SongFits } from "../flow";
import { ScoreRing } from "./PreviewScreen";
import { TagLabels } from "./GenreLabels";
import { tagColour } from "./tagLabels";
import { parseTrackLink } from "../nav";

interface AddToScreenProps {
  song?: string; // the song's URI; none = ask for one first
  playing: { uri: string; name: string; artists: string } | null;
  find: (uri: string) => Promise<SongFits>;
  add: (playlist: { uri: string; name: string }, song: SongFits["song"]) => Promise<void>;
  describeError: (error: unknown) => string;
  onOpenPlaylist: (uri: string) => void;
  onHome: () => void;
}

type AddStatus = "adding" | "added" | { error: string };

export function AddToScreen({ song: initialSong, playing, find, add, describeError, onOpenPlaylist, onHome }: AddToScreenProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [song, setSong] = React.useState(initialSong ?? null);
  const [result, setResult] = React.useState<SongFits | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Record<string, AddStatus>>({});
  const [link, setLink] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!song) return;
    let live = true;
    setResult(null);
    setError(null);
    setStatus({});
    find(song).then(
      (r) => live && setResult(r),
      (e) => live && setError(describeError(e))
    );
    return () => {
      live = false;
    };
  }, [song]);

  async function addTo(fit: { uri: string; name: string }) {
    if (!result) return;
    setStatus((s) => ({ ...s, [fit.uri]: "adding" }));
    try {
      await add(fit, result.song);
      setStatus((s) => ({ ...s, [fit.uri]: "added" }));
    } catch (e) {
      setStatus((s) => ({ ...s, [fit.uri]: { error: describeError(e) } }));
    }
  }

  function useLink() {
    const uri = parseTrackLink(link);
    if (!uri) {
      setLinkError("That isn't a Spotify song link. In Spotify: song's ... menu > Share > Copy Song Link.");
      return;
    }
    setSong(uri);
  }

  const title = <h2 className="prism-screen-title">Add a song to your playlists</h2>;

  // 1. No song yet: pick one (same choices as Grow's start).
  if (!song) {
    return (
      <div className="prism-fade-in" style={styles.column} data-prism-state="addto-pick">
        {title}
        <p style={styles.sub}>Prism finds the 5 playlists of yours that fit a song best, and adds it to the ones you pick.</p>
        <div className="prism-glass-panel" style={styles.panel}>
          <span style={styles.label}>The song playing now</span>
          {playing ? (
            <div style={styles.row}>
              <span data-prism="addto-playing">
                {playing.name} · {playing.artists}
              </span>
              <span style={styles.keep}>
                <ButtonPrimary buttonSize="sm" onClick={() => setSong(playing.uri)} data-prism="addto-use-playing">
                  Use this song
                </ButtonPrimary>
              </span>
            </div>
          ) : (
            <p style={styles.sub}>Nothing is playing (or it isn't a song).</p>
          )}
          <span style={styles.label}>Or paste a song link</span>
          <div style={styles.row}>
            <input
              value={link}
              placeholder="https://open.spotify.com/track/..."
              onChange={(e) => {
                setLink(e.target.value);
                setLinkError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && useLink()}
              className="prism-glass-input"
              style={styles.input}
              aria-label="Spotify song link"
              data-prism="addto-link"
            />
            <ButtonSecondary buttonSize="sm" onClick={useLink} disabled={!link.trim()}>
              Find playlists
            </ButtonSecondary>
          </div>
          {linkError && (
            <p role="alert" style={styles.error}>
              {linkError}
            </p>
          )}
        </div>
        <p style={styles.hint}>Tip: right-click any song in Spotify and choose "Add with Prism".</p>
        <div>
          <ButtonSecondary buttonSize="sm" onClick={onHome}>
            Back
          </ButtonSecondary>
        </div>
      </div>
    );
  }

  // 2. Loading / error / the top 5.
  return (
    <div className="prism-fade-in" style={styles.column} data-prism-state="addto">
      {title}
      {result && (
        <p style={styles.sub} data-prism="addto-song">
          Best homes for "{result.song.name}" · {result.song.artists.join(", ")}
        </p>
      )}

      {!result && !error && (
        <div style={styles.row}>
          <span className="prism-spinner" aria-hidden="true" />
          <span style={styles.sub}>Finding the playlists that fit…</span>
        </div>
      )}
      {error && (
        <p className="prism-notice" role="alert">
          {error}
        </p>
      )}

      {result && !result.tagged && (
        <p className="prism-notice" role="status" data-prism="addto-untagged">
          Last.fm has no genre tags for this song, so Prism can't tell which playlists it fits.
        </p>
      )}
      {result && result.tagged && result.fits.length === 0 && (
        <p className="prism-notice" role="status" data-prism="addto-none">
          None of your playlists share a genre with this song (or the ones that do already have it).
        </p>
      )}

      {result && result.fits.length > 0 && (
        <div className="prism-glass-panel" style={styles.list} data-prism="addto-list">
          {result.fits.map((fit) => {
            const st = status[fit.uri];
            return (
              <div key={fit.uri} className="prism-row" style={styles.fitRow} data-prism="addto-row" data-uri={fit.uri}>
                <ScoreRing score={fit.score} />
                <span style={styles.rowText}>
                  <span style={styles.rowName}>{fit.name}</span>
                  <TagLabels labels={fit.reasons.map((name) => ({ name, colour: tagColour(name), shared: true }))} />
                  <span style={styles.rowSub}>
                    Judged on {fit.known} of {fit.total} songs
                  </span>
                  {typeof st === "object" && (
                    <span role="alert" style={styles.error}>
                      {st.error}
                    </span>
                  )}
                </span>
                <span style={styles.keep}>
                  {st === "added" ? (
                    <ButtonSecondary buttonSize="sm" onClick={() => onOpenPlaylist(fit.uri)} data-prism="addto-open">
                      Added ✓ Open
                    </ButtonSecondary>
                  ) : (
                    <ButtonSecondary buttonSize="sm" disabled={st === "adding"} onClick={() => addTo(fit)} data-prism="addto-add">
                      {st === "adding" ? "Adding…" : "Add"}
                    </ButtonSecondary>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {result && result.unjudged > 0 && (
        <p style={styles.hint} data-prism="addto-unjudged">
          {result.unjudged} playlist{result.unjudged === 1 ? " wasn't" : "s weren't"} judged: Prism hasn't scanned enough of
          {result.unjudged === 1 ? " its" : " their"} songs yet. Scanning them once in Grow or Remix includes them next time.
        </p>
      )}

      <div style={styles.row}>
        <ButtonSecondary buttonSize="sm" onClick={() => setSong(null)} data-prism="addto-other">
          Another song
        </ButtonSecondary>
        <ButtonSecondary buttonSize="sm" onClick={onHome}>
          Home
        </ButtonSecondary>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  column: { display: "flex", flexDirection: "column", gap: 16 },
  panel: { display: "flex", flexDirection: "column", gap: 10, padding: 20 },
  label: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  keep: { flexShrink: 0, whiteSpace: "nowrap" },
  sub: { color: "var(--spice-subtext)", margin: 0 },
  hint: { margin: 0, color: "var(--spice-subtext)", fontSize: 12 },
  input: { flex: 1, width: "auto", minWidth: 0, fontSize: 13, padding: "7px 12px" },
  error: { margin: 0, color: "#ffb3d1", fontSize: 12 },
  list: { display: "flex", flexDirection: "column", padding: 8 },
  fitRow: { display: "flex", alignItems: "center", gap: 14, padding: "10px 12px" },
  rowText: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  rowName: { fontSize: 15, fontWeight: 600, color: "var(--spice-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowSub: { color: "var(--spice-subtext)", fontSize: 12 },
};
