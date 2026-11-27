// Seed panel: the Prism flow shown on the Prism page after
// "Grow a playlist with Prism" (it was a popup before step 12a).
//
// It shows a loading spinner at once, then loads the song's details, tags,
// BPM/key and mood itself, and fades the content in.
//
// The user switches off tags they don't want; "Next" hands the kept tags on
// (to step 6's playlist picker). Tag rules (see tagSelection.ts): zero tags =
// blocked, artist-only tags = warning.
//
// Uses Spotify's OWN components (Chip / ButtonPrimary / ButtonSecondary), so it
// looks and behaves like the rest of Spotify.

import React from "react";
import type { TrackInfo } from "../spotify/read";
import { formatAudio, type AudioAttributes } from "../spotify/audio";
import { formatMood, type MoodProfile } from "../mood/lyricsMood";
import type { SourcedTag } from "../tags/combineTags";
import { canContinue, keptTags, seedStatus, splitBySource, toggleTag } from "./tagSelection";
import { tagColour } from "./tagLabels";
import type { SourceOption } from "../sources/sources";
import { SourcePicker } from "./SourcePicker";
import { ScanScreen, type ScanOutcome, type ScanScreenProps } from "./ScanScreen";
import { PreviewScreen } from "./PreviewScreen";
import { NewFindsStep } from "./NewFindsStep";
import { DEFAULT_NEW_COUNT, parseNewCount, type NewCount } from "../discover/discover";
import { loadNewCountText, saveNewCountText } from "../storage";
import type { RankedSong } from "../scoring/rank";
import type { ScanProgress } from "../scan/scan";
import type { PlaylistSeedData, SeedData, SongSeedData } from "../scoring/growSeed";
import { blendMood, blendTags, playlistSeedMessage, tempoRange } from "../scoring/playlistSeed";
import { tagColours } from "./tagLabels";
import { ScanningPrism } from "./PrismIcon";

// The seed types live in src/scoring/growSeed.ts (pure); re-exported here
// because the page code has always imported them from the panel.
export type { SeedData };

// A seed playlist with only the ticked songs, re-blended: what the next
// screens get (their chips, scores and the new playlist follow the ticks).
function withSongs(data: PlaylistSeedData, offSongs: string[]): PlaylistSeedData {
  const songs = data.songs.filter((song) => !offSongs.includes(song.uri));
  return { ...data, songs, tags: blendTags(songs), mood: blendMood(songs.map((song) => song.mood)) };
}

export interface SeedPanelProps {
  // Loads everything about the seed. The panel calls it once when it opens.
  // A seed PLAYLIST reports its scan's progress and stops when the panel closes.
  load: (onProgress: (progress: ScanProgress) => void, shouldStop: () => boolean) => Promise<SeedData>;
  // Loads the playlists the user can pick from (screen 2).
  loadSources: () => Promise<SourceOption[]>;
  // Scans the picked sources (screen 3).
  runScan: ScanScreenProps["runScan"];
  // Turns an error into a message the user can act on.
  describeError: (error: unknown) => string;
  // "Cancel" on the first screen: leave this Prism.
  onCancel: () => void;
  // Told true while a scan is running (see ScanScreen's onRunningChange).
  onScanningChange?: (running: boolean) => void;
  // Creates the new playlist from the preview's picks. Rejects with an error
  // the preview shows (the screen stays so the user can retry).
  onCreate: (choice: {
    name: string;
    seed: SeedData;
    kept: SourcedTag[];
    sources: SourceOption[];
    songs: RankedSong[];
  }) => Promise<void>;
  // DISCOVER: new songs similar to the seed, not in the library (optional).
  findNew?: (
    seed: SeedData,
    kept: SourcedTag[],
    onProgress: (progress: { done: number; total: number }) => void,
    shouldStop: () => boolean
  ) => Promise<RankedSong[]>;
}

// The outer component. It owns the state BOTH screens need, so going
// Back and Next keeps the user's choices ("lifting state up" in React terms).
//   screen "seed":    loading -> tag chips   (or an error)
//   screen "new":     how many new finds (2026-11-26; Off/5/10/20)
//   screen "sources": playlist picker (Skip = new finds only, when not Off)
//   screen "scan":    scanning progress, then a summary
//   screen "preview": ranked matches with scores; pick what goes in
export function SeedPanel({ load, loadSources, runScan, describeError, onCancel, onScanningChange, onCreate, findNew }: SeedPanelProps) {
  const [data, setData] = React.useState<SeedData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [screen, setScreen] = React.useState<"seed" | "new" | "sources" | "scan" | "preview">("seed");
  // How many new finds (remembered; the preview starts from it too).
  const [newCount, setNewCount] = React.useState<NewCount>(() => parseNewCount(loadNewCountText()) ?? DEFAULT_NEW_COUNT);
  const [scan, setScan] = React.useState<ScanOutcome | null>(null); // the finished scan
  const [offNames, setOffNames] = React.useState<string[]>([]); // chips switched off
  const [selectedSources, setSelectedSources] = React.useState<string[]>([]); // ticked playlist URIs
  const [picked, setPicked] = React.useState<SourceOption[]>([]); // the sources being scanned
  const [offSongs, setOffSongs] = React.useState<string[]>([]); // seed playlist songs unticked
  const [loadProgress, setLoadProgress] = React.useState<ScanProgress | null>(null);

  // useEffect runs code AFTER the panel is on screen (so the spinner can
  // appear first). The empty [] means "only once, when it opens".
  React.useEffect(() => {
    // If the panel goes away before loading finishes, don't update a
    // component that's gone. The function we return runs when it goes.
    let closed = false;
    load(
      (progress) => !closed && setLoadProgress(progress),
      () => closed
    )
      .then((loaded) => !closed && setData(loaded))
      .catch((err) => {
        console.error("[Prism] loading the seed failed", err);
        if (!closed) setError(describeError(err));
      });
    return () => {
      closed = true;
    };
  }, []);

  // What the next screens use: a seed playlist with only its ticked songs.
  const seed = React.useMemo(
    () => (data && data.kind === "playlist" ? withSongs(data, offSongs) : data),
    [data, offSongs]
  );
  const kept = seed ? keptTags(seed.tags, offNames) : [];

  let body: React.ReactNode;
  if (error) {
    body = (
      <div className="prism-fade-in" style={styles.centered} data-prism-state="error">
        <p style={styles.text}>{error}</p>
      </div>
    );
  } else if (!data || !seed) {
    body = loadProgress ? (
      // A seed playlist: its songs are scanned first (the standard scanning star).
      <div style={styles.centered} data-prism-state="loading">
        <ScanningPrism size={132} progress={loadProgress.total > 0 ? loadProgress.done / loadProgress.total : null} />
        <p style={styles.subtext} data-prism="seed-load-progress">
          {loadProgress.total > 0
            ? `Reading the playlist's songs: ${loadProgress.done} of ${loadProgress.total}`
            : "Reading the playlist..."}
        </p>
      </div>
    ) : (
      <div style={styles.centered} data-prism-state="loading">
        <div className="prism-spinner" />
        <p style={styles.subtext}>Reading the song...</p>
      </div>
    );
  } else if (screen === "seed") {
    body =
      data.kind === "song" ? (
        <SeedContent
          data={data}
          offNames={offNames}
          setOffNames={setOffNames}
          onNext={() => setScreen(findNew ? "new" : "sources")}
          onCancel={onCancel}
        />
      ) : (
        <PlaylistSeedContent
          data={data}
          seed={seed as PlaylistSeedData}
          offNames={offNames}
          setOffNames={setOffNames}
          offSongs={offSongs}
          setOffSongs={setOffSongs}
          onNext={() => setScreen(findNew ? "new" : "sources")}
          onCancel={onCancel}
        />
      );
  } else if (screen === "new") {
    body = (
      <div key="new" className="prism-fade-in">
        <NewFindsStep
          count={newCount}
          onChoose={(next) => {
            setNewCount(next);
            saveNewCountText(String(next));
          }}
          onBack={() => setScreen("seed")}
          onNext={() => setScreen("sources")}
        />
      </div>
    );
  } else if (screen === "sources") {
    body = (
      // The wrapper's `key` makes React treat each screen as new, so the
      // fade-in plays when switching screens.
      <div key="sources" className="prism-fade-in">
        <SourcePicker
          // A seed playlist isn't offered as a source: its songs are in already.
          loadSources={
            data.kind === "playlist" ? () => loadSources().then((all) => all.filter((s) => s.uri !== data.playlist.uri)) : loadSources
          }
          describeError={describeError}
          selected={selectedSources}
          setSelected={setSelectedSources}
          onBack={() => setScreen(findNew ? "new" : "seed")}
          onNext={(sources) => {
            setPicked(sources);
            setScreen("scan");
          }}
          intro={
            findNew && newCount !== "off"
              ? "Pick playlists your songs can also come from, or skip this to get only new finds. Nothing in them is changed."
              : undefined
          }
          // Skip = new finds only (no playlist songs, no scan). Not when new
          // finds are Off: the playlist would only have the seed.
          onSkip={
            findNew && newCount !== "off"
              ? () => {
                  setPicked([]);
                  setScan(null);
                  setScreen("preview");
                }
              : undefined
          }
        />
      </div>
    );
  } else if (screen === "scan") {
    body = (
      <div key="scan" className="prism-fade-in">
        <ScanScreen
          sources={picked}
          runScan={runScan}
          describeError={describeError}
          onRunningChange={onScanningChange}
          // Back stops the scan (the screen closes) and returns to the picker.
          onBack={() => setScreen("sources")}
          onNext={(outcome) => {
            setScan(outcome);
            setScreen("preview");
          }}
        />
      </div>
    );
  } else {
    body = (
      <div key="preview" className="prism-fade-in">
        <PreviewScreen
          seed={seed}
          kept={kept}
          songs={scan?.songs ?? []}
          // Back goes to the playlist picker (re-scanning is quick thanks to the cache).
          onBack={() => setScreen("sources")}
          fromPlaylists={picked.length > 0}
          describeError={describeError}
          onCreate={(name, songs) => onCreate({ name, seed, kept, sources: picked, songs })}
          findNew={findNew && ((onProgress, shouldStop) => findNew(seed, kept, onProgress, shouldStop))}
        />
      </div>
    );
  }

  return (
    <div style={styles.panel} data-prism="seed-panel">
      {body}
    </div>
  );
}

// The loaded content: song info, chips, and buttons.
interface SeedContentProps {
  data: SongSeedData;
  // The names of the tags the user switched off (empty = all on). Owned by
  // the parent so it survives going to the next screen and back.
  offNames: string[];
  // React's own setter type: it also accepts a function (previous) => next.
  setOffNames: React.Dispatch<React.SetStateAction<string[]>>;
  onNext: () => void;
  onCancel: () => void;
}

function SeedContent({ data, offNames, setOffNames, onNext, onCancel }: SeedContentProps) {
  // Read Spotify's components here, not at the top of the file: the file can
  // load before Spicetify is ready, but this runs only when the panel shows.
  // `as any`: the buttons are missing from Spicetify's type definitions file.
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;

  const { track, tags, audio, mood } = data;
  const kept = keptTags(tags, offNames);
  const { song, artist } = splitBySource(tags);
  const status = seedStatus(tags, kept);
  const allowed = canContinue(status);

  // One switchable tag label per tag: the same frosted pill with a colour dot
  // as the Remix builder (bright = on). role="checkbox" + aria-checked tell
  // screen readers (and the smoke test) whether it's on.
  const renderChips = (list: SourcedTag[]) => (
    <div style={styles.chipRow}>
      {list.map((tag) => {
        const on = !offNames.includes(tag.name);
        return (
          <button
            key={tag.name}
            type="button"
            role="checkbox"
            aria-checked={on}
            className={`prism-tag prism-tag-pick prism-tag-big${on ? " shared" : ""}`}
            style={{ ["--tag" as any]: tagColour(tag.name) }}
            // A "functional update": React passes the LATEST list, so quick clicks
            // in a row all count (offNames from this render could be out of date).
            onClick={() => setOffNames((previous) => toggleTag(previous, tag.name))}
          >
            <span className="prism-tag-text">{tag.name}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="prism-fade-in" style={styles.panel} data-prism-state="ready">
      <div>
        <div className="prism-screen-title">{track.name}</div>
        <div style={styles.subtext}>{track.artists.join(", ")}</div>
        <div style={styles.subtext}>{formatAudio(audio)}</div>
        <div style={styles.subtext} data-prism="seed-mood">
          {formatMood(mood)}
        </div>
      </div>

      {tags.length > 0 && (
        <>
          <p style={styles.subtext}>Switch off any tags that don't fit the vibe you want.</p>
          {song.length > 0 && (
            <section>
              <h3 className="prism-heading">Song tags</h3>
              {renderChips(song)}
            </section>
          )}
          {artist.length > 0 && (
            <section>
              <h3 className="prism-heading">From the artist (less specific)</h3>
              {renderChips(artist)}
            </section>
          )}
          <p style={styles.subtext} data-prism="kept-count">
            {kept.length} of {tags.length} tags on
          </p>
        </>
      )}

      {/* prism-notice: see-through box with a rainbow edge (styles.ts).
          role="status" makes screen readers announce the message when it appears. */}
      {"message" in status && (
        <p role="status" data-prism="status" data-prism-kind={status.kind} className="prism-notice">
          {status.message}
        </p>
      )}

      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onCancel}>
          Cancel
        </ButtonSecondary>
        <ButtonPrimary buttonSize="sm" disabled={!allowed} onClick={() => allowed && onNext()}>
          Next: new finds
        </ButtonPrimary>
      </div>
    </div>
  );
}

// A seed PLAYLIST (2026-11-26, mockup "B", developer's pick): cover + name +
// a summary line, one row per genre (Tag switch + Bar + song count), and the
// seed songs as a Show/hide list of checkbox rows: unticked songs stay out of
// the blend, the scores and the new playlist. All catalogue elements.
interface PlaylistSeedContentProps {
  data: PlaylistSeedData; // everything loaded
  seed: PlaylistSeedData; // only the ticked songs, re-blended
  offNames: string[];
  setOffNames: React.Dispatch<React.SetStateAction<string[]>>;
  offSongs: string[];
  setOffSongs: React.Dispatch<React.SetStateAction<string[]>>;
  onNext: () => void;
  onCancel: () => void;
}

function PlaylistSeedContent({ data, seed, offNames, setOffNames, offSongs, setOffSongs, onNext, onCancel }: PlaylistSeedContentProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [showSongs, setShowSongs] = React.useState(false);

  const kept = keptTags(seed.tags, offNames);
  const included = seed.songs.length;
  const tagged = seed.songs.filter((song) => song.tags.length > 0).length;
  const message = playlistSeedMessage(seed.tags, kept, included);
  const colours = tagColours(seed.tags.map((tag) => tag.name));
  const tempo = tempoRange(seed.songs.map((song) => song.audio));
  const summary = [
    included === data.songs.length ? `${included} songs` : `${included} of ${data.songs.length} songs`,
    tempo ? (tempo.min === tempo.max ? `${tempo.min} BPM` : `${tempo.min}–${tempo.max} BPM`) : null,
    formatMood(seed.mood),
  ].filter(Boolean);
  const allTicked = offSongs.length === 0;

  return (
    <div className="prism-fade-in" style={styles.panel} data-prism-state="ready" data-prism-seed="playlist">
      <div style={styles.head}>
        {data.playlist.cover && <img src={data.playlist.cover} alt="" style={styles.cover} />}
        <div style={{ minWidth: 0 }}>
          <div className="prism-screen-title">{data.playlist.name}</div>
          <div style={styles.subtext} data-prism="seed-summary">
            {summary.join(" · ")}
          </div>
        </div>
      </div>

      {seed.tags.length > 0 && (
        <>
          <p style={styles.subtext}>Genres in this playlist. Switch off any you don't want more of.</p>
          <div style={styles.genreGrid} data-prism="seed-genres">
            {seed.tags.map((tag, i) => {
              const on = !offNames.includes(tag.name);
              const colour = colours.get(tag.name) ?? tagColour(tag.name);
              return (
                <React.Fragment key={tag.name}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`prism-tag prism-tag-pick prism-tag-big${on ? " shared" : ""}`}
                    style={{ ["--tag" as any]: colour, justifySelf: "start" }}
                    onClick={() => setOffNames((previous) => toggleTag(previous, tag.name))}
                  >
                    <span className="prism-tag-text">{tag.name}</span>
                  </button>
                  <span className="prism-bar-track" style={{ opacity: on ? 1 : 0.4 }}>
                    <span
                      className="prism-bar-fill"
                      style={{
                        width: `${(tag.count / Math.max(tagged, 1)) * 100}%`,
                        ["--tag" as any]: colour,
                        ["--delay" as any]: `${i * 60}ms`,
                      }}
                    />
                  </span>
                  <span style={styles.count}>{tag.count}</span>
                </React.Fragment>
              );
            })}
          </div>
          <p style={styles.subtext} data-prism="kept-count">
            {kept.length} of {seed.tags.length} genres on · {tagged} of {included} songs have tags
          </p>
        </>
      )}

      {/* Show/hide list (catalogue): the seed songs, all ticked at first. */}
      <div>
        <button
          type="button"
          className="prism-quiet-button"
          aria-expanded={showSongs}
          aria-controls="prism-seed-songs"
          onClick={() => setShowSongs(!showSongs)}
          data-prism="seed-songs-toggle"
        >
          {showSongs ? "▴ Hide seed songs" : `▾ Show seed songs (${data.songs.length})`}
          {" · untick any that don't fit"}
        </button>
        {showSongs && (
          <div id="prism-seed-songs" className="prism-glass-panel" style={styles.songList} data-prism="seed-songs">
            <label className="prism-row is-clickable is-head" style={styles.songRow}>
              <input
                type="checkbox"
                className="prism-checkbox"
                checked={allTicked}
                ref={(el) => {
                  if (el) el.indeterminate = !allTicked && offSongs.length < data.songs.length;
                }}
                onChange={() => setOffSongs(allTicked ? data.songs.map((song) => song.uri) : [])}
              />
              <span style={styles.songName}>All songs ({data.songs.length})</span>
            </label>
            {data.songs.map((song) => (
              <label key={song.uri} className="prism-row is-clickable" style={styles.songRow} data-uri={song.uri}>
                <input
                  type="checkbox"
                  className="prism-checkbox"
                  checked={!offSongs.includes(song.uri)}
                  onChange={() => setOffSongs((previous) => toggleTag(previous, song.uri))}
                />
                <span style={styles.songName}>
                  {song.name} <span style={styles.subtext}>· {song.artists.join(", ")}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {message && (
        <p role="status" data-prism="status" className="prism-notice">
          {message}
        </p>
      )}

      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onCancel}>
          Cancel
        </ButtonSecondary>
        <ButtonPrimary buttonSize="sm" disabled={!!message} onClick={() => !message && onNext()}>
          Next: new finds
        </ButtonPrimary>
      </div>
    </div>
  );
}

// Inline styles, using Spotify's theme colours (CSS variables), so the panel
// follows whatever Spicetify theme the user has.
const styles: Record<string, React.CSSProperties> = {
  panel: { display: "flex", flexDirection: "column", gap: 16 },
  centered: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0" },
  text: { color: "var(--spice-text)", margin: 0, textAlign: "center" },
  subtext: { color: "var(--spice-subtext)", margin: 0 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
  head: { display: "flex", alignItems: "center", gap: 16 },
  cover: { width: 64, height: 64, borderRadius: 4, objectFit: "cover", flexShrink: 0 },
  // Same grid as the stats page's bars: label column fits the widest pill.
  genreGrid: { display: "grid", gridTemplateColumns: "fit-content(220px) 1fr 32px", gap: "8px 12px", alignItems: "center" },
  count: { color: "var(--spice-subtext)", fontSize: 13, fontVariantNumeric: "tabular-nums" },
  songList: { maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", padding: "4px 6px", marginTop: 8 },
  songRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px" },
  songName: { color: "var(--spice-text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
};
