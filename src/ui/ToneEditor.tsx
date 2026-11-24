// Set or edit a playlist's TONE (right-click a playlist > "Prism tone").
// The tone = the genres and lyrics moods the playlist is meant to have, plus
// an optional tempo. With a tone set, the playlist page gets a "✦ Tone"
// switch that shows each song's fit as a score ring (src/ui/toneRows.tsx).
//
// Reuses the Remix builder's pieces: genre search + tag switches (PickChip)
// and the segmented choice for tempo. A new tone starts from a suggestion
// (the playlist's own common genres/moods, suggestTone). Saved ONLY in
// LocalStorage (prism:tones); the playlist itself is never changed.
// Pure logic: src/tone/tone.ts.

import React from "react";
import type { ScannedSong, ScanProgress } from "../scan/scan";
import { labelChoices } from "../organize/customGroups";
import type { Mood } from "../mood/lyricsMood";
import {
  TEMPO_BANDS,
  isToneEmpty,
  scoreAgainstTone,
  suggestTone,
  toneSummary,
  type PlaylistTone,
  type TempoBand,
  type ToneSong,
} from "../tone/tone";
import { PickChip } from "./GroupBuilder";

const TOP_GENRES = 36; // genres shown before anything is typed (like the builder)

export interface ToneEditorProps {
  playlist: string; // URI
  loadName: (uri: string) => Promise<string | null>;
  loadSongs: (uri: string, onProgress: (p: ScanProgress) => void, shouldStop: () => boolean) => Promise<ScannedSong[]>;
  saved: PlaylistTone | null;
  onSave: (tone: PlaylistTone) => void;
  onRemove: () => void;
  onBack: () => void; // page: open the playlist again; pop-up: close it
  describeError: (error: unknown) => string;
  // "popup": inside the pop-up over the playlist (Edit in the tone strip,
  // src/ui/tonePopup.tsx): "Cancel" instead of "Back to playlist", and it
  // fits the window's height. Default "page": the Prism page.
  variant?: "page" | "popup";
}

const asToneSong = (s: ScannedSong): ToneSong => ({ tags: s.tags, bpm: s.audio?.bpm ?? null, mood: s.mood });

export function ToneEditor({ playlist, loadName, loadSongs, saved, onSave, onRemove, onBack, describeError, variant = "page" }: ToneEditorProps) {
  const popup = variant === "popup";
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [name, setName] = React.useState<string | null>(null);
  const [songs, setSongs] = React.useState<ScannedSong[] | null>(null);
  const [progress, setProgress] = React.useState<ScanProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<Pick<PlaylistTone, "genres" | "moods" | "tempo">>(
    saved ?? { genres: [], moods: [], tempo: "any" }
  );
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    let stopped = false;
    loadName(playlist).then((n) => !stopped && setName(n));
    loadSongs(playlist, (p) => !stopped && setProgress(p), () => stopped)
      .then((list) => {
        if (stopped) return;
        setSongs(list);
        // A new tone starts from what the playlist already sounds like.
        if (!saved) setTone(suggestTone(list.map(asToneSong)));
      })
      .catch((e) => !stopped && setError(describeError(e)));
    return () => {
      stopped = true; // leaving the page stops the lookups
    };
  }, [playlist]);

  const choices = React.useMemo(() => labelChoices(songs ?? []), [songs]);
  // Live preview: how many songs fit this tone (scored songs only).
  const fit = React.useMemo(() => {
    if (!songs || isToneEmpty(tone)) return null;
    return toneSummary(songs.map((s) => scoreAgainstTone(tone, asToneSong(s))));
  }, [songs, tone]);

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const q = query.trim().toLowerCase();
  const shown = q ? choices.genres.filter((g) => g.name.includes(q)).slice(0, 60) : choices.genres.filter((g) => g.songs >= 2).slice(0, TOP_GENRES);
  const picked = choices.genres.filter((g) => tone.genres.includes(g.name) && !shown.includes(g));
  // A saved genre that isn't in the songs any more still shows, so it can be turned off.
  const missing = tone.genres.filter((g) => !choices.genres.some((c) => c.name === g)).map((g) => ({ name: g, songs: 0 }));

  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div
      className={popup ? undefined : "prism-fade-in"}
      style={popup ? styles.popupScreen : styles.screen}
      data-prism="tone-editor"
      data-prism-state={songs ? "ready" : "loading"}
    >
      <h2 className="prism-screen-title" style={styles.title} id="prism-tone-title">
        Tone for {name ?? "this playlist"}
      </h2>
      <p style={styles.sub}>
        {popup ? (
          <>Pick the genres and moods this playlist is meant to have. The rings update when you save. </>
        ) : (
          <>
            Pick the genres and moods this playlist is meant to have. Then switch on <b>✦ Tone</b> on the playlist to see how well
            each song fits.{" "}
          </>
        )}
        Only saved on this computer; the playlist itself isn't changed.
      </p>

      {error && (
        <p className="prism-notice" role="alert" style={{ fontSize: 13, margin: 0 }} data-prism="tone-error">
          {error}
        </p>
      )}

      {!songs && !error && (
        <div style={styles.loading}>
          <span style={styles.line}>
            {progress && progress.total > 0
              ? `Reading the songs' tags and moods: ${progress.done} of ${progress.total}`
              : "Reading the playlist…"}
          </span>
          <div className="prism-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-prism="tone-bar">
            <div className="prism-progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {songs && (
        <div className="prism-glass-panel" style={styles.picker} data-prism="tone-picker">
          <span className="prism-heading">Key genres</span>
          <input
            type="search"
            className="prism-glass-input"
            style={styles.search}
            placeholder={`Find a genre (${choices.genres.length} in this playlist)`}
            aria-label="Find a genre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-prism="tone-genre-search"
          />
          <div style={styles.chips} data-prism="tone-genres">
            {[...missing, ...picked, ...shown].map((c) => (
              <PickChip key={c.name} kind="genre" choice={c} on={tone.genres.includes(c.name)} onToggle={() => setTone({ ...tone, genres: toggle(tone.genres, c.name) })} />
            ))}
            {shown.length === 0 && <span style={styles.line}>{q ? `No genre matches "${query}".` : "No Last.fm genres found for these songs."}</span>}
          </div>

          <span className="prism-heading">Moods (from the lyrics)</span>
          <div style={styles.chips} data-prism="tone-moods">
            {choices.moods.map((c) => (
              <PickChip key={c.name} kind="mood" choice={c} on={tone.moods.includes(c.name as Mood)} onToggle={() => setTone({ ...tone, moods: toggle(tone.moods, c.name) as Mood[] })} />
            ))}
            {choices.moods.length === 0 && <span style={styles.line}>No lyrics moods were found in these songs.</span>}
          </div>

          <span className="prism-heading" id="prism-tone-tempo-label">
            Tempo
          </span>
          <div className="prism-seg" role="group" aria-labelledby="prism-tone-tempo-label" style={{ alignSelf: "flex-start" }}>
            {TEMPO_BANDS.map((band) => (
              <button
                key={band.value}
                type="button"
                className={tone.tempo === band.value ? "on" : ""}
                aria-pressed={tone.tempo === band.value}
                onClick={() => setTone({ ...tone, tempo: band.value as TempoBand })}
                data-prism={`tone-tempo-${band.value}`}
              >
                {band.label}
              </button>
            ))}
          </div>
          <span style={styles.line}>Slow is under 90 BPM, mid 90 to 119, fast 120 and up.</span>

          <span style={styles.line} data-prism="tone-fit">
            {fit
              ? <>≈ <b style={{ color: "#fff" }}>{fit.fits}</b> of {fit.fits + fit.drift} songs fit this tone (50% or more).
                  {fit.partial > 0 ? ` ${fit.partial} have no Last.fm tags, so they get a rough guess from mood and tempo (a faded ring).` : ""}
                  {fit.unscored > 0 ? ` ${fit.unscored} can't be scored ("–").` : ""}</>
              : "Pick at least one genre, mood or tempo."}
          </span>
        </div>
      )}

      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack} data-prism="tone-back">
          {popup ? "Cancel" : "Back to playlist"}
        </ButtonSecondary>
        {saved && (
          <ButtonSecondary buttonSize="sm" onClick={onRemove} data-prism="tone-remove">
            Remove tone
          </ButtonSecondary>
        )}
        <span style={{ flex: 1 }} />
        <ButtonPrimary
          buttonSize="sm"
          disabled={!songs || isToneEmpty(tone)}
          onClick={() => onSave({ ...tone, show: true, updatedAt: Date.now() })}
          data-prism="tone-save"
        >
          Save tone
        </ButtonPrimary>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: { display: "flex", flexDirection: "column", gap: 12, height: 560 },
  // In the pop-up: as tall as fits (the card is at most the view's height).
  popupScreen: { display: "flex", flexDirection: "column", gap: 12, height: "min(560px, calc(100vh - 260px))", minHeight: 320 },
  title: { margin: 0 },
  sub: { margin: 0, color: "var(--spice-subtext)", fontSize: 13 },
  loading: { display: "flex", flexDirection: "column", gap: 8, marginTop: 24 },
  picker: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px" },
  search: { fontSize: 13, padding: "6px 12px" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  line: { color: "var(--spice-subtext)", fontSize: 12 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
};
