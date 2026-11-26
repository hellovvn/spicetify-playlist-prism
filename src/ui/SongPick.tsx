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
}

type Choice = "playing" | "link";

export function SongPick({ id, title, intro, hint, nextLabel, playing, onPick, onBack }: SongPickProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [choice, setChoice] = React.useState<Choice>(playing ? "playing" : "link");
  const [link, setLink] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);

  // The song stopped (or isn't a song any more): the playing row can't be used.
  React.useEffect(() => {
    if (!playing && choice === "playing") setChoice("link");
  }, [playing, choice]);

  const canGo = choice === "playing" ? !!playing : link.trim() !== "";

  function next() {
    if (choice === "playing") {
      if (playing) onPick(playing.uri);
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

  return (
    <div className="prism-fade-in" data-prism-state={`${id}-pick`}>
      <h2 className="prism-screen-title" style={styles.title}>
        {title}
      </h2>
      <div style={styles.column}>
        <p style={styles.sub}>{intro}</p>
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
              {playing ? (
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
              <input
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
              />
              {linkError && (
                <span role="alert" style={styles.error}>
                  {linkError}
                </span>
              )}
            </span>
          </label>
        </div>
        <p style={styles.hint}>{hint}</p>
        <div style={{ flex: 1 }} />
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
};
