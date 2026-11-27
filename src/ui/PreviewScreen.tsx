// Preview screen: screen 4 of the Prism flow. Shows every matching song,
// best first, with its score and WHY it matched. The best ones start ticked;
// the user can change any tick. The seed (song or playlist songs) is always first.
//
// Each row: tick box, a score ring, the song, its genre labels (frosted glass
// with a colour dot; bright = shared with the seed, faint = extra), and on
// the right its BPM/key and lyrics mood.
//
// Nothing is created here: "Create playlist" hands the picks to step 9.

import React from "react";
import { ScoreRing } from "./ScoreRing";
export { ScoreRing };
import type { ScannedSong } from "../scan/scan";
import {
  DEFAULT_PICK_COUNT,
  MAX_CUSTOM_COUNT,
  PICK_COUNTS,
  parsePickCount,
  picksFor,
  rankWith,
  type PickCount,
  type RankedSong,
} from "../scoring/rank";
import { loadNewCountText, loadPickCountText, saveNewCountText, savePickCountText } from "../storage";
import { DEFAULT_NEW_COUNT, mergeByScore, newPicks, parseNewCount, type NewCount } from "../discover/discover";
import { NewCountChoice } from "./NewCountChoice";
import type { SourcedTag } from "../tags/combineTags";
import { formatAudio } from "../spotify/audio";
import { formatMood, topMoods, type MoodProfile } from "../mood/lyricsMood";
import type { AudioAttributes } from "../spotify/audio";
import { labelsFor, tagColour } from "./tagLabels";
import { TagLabels } from "./GenreLabels";
import { allShownSelected, clearShown, selectShown } from "../sources/sources";
import { growScorer, seedExclusions, seedName, seedTrackUris, type SeedData } from "../scoring/growSeed";
import { SCREEN_HEIGHT } from "./styles";
import { toggleTag as toggleInList } from "./tagSelection";

export interface PreviewScreenProps {
  seed: SeedData;
  kept: SourcedTag[]; // the seed tags the user kept ON
  songs: ScannedSong[]; // everything the scan found
  onBack: () => void;
  // false = the user skipped the playlist step: new finds only (2026-11-26).
  fromPlaylists?: boolean;
  // Creates the playlist (step 9). Resolves when done; rejects with an error to show.
  onCreate: (name: string, picked: RankedSong[]) => Promise<void>;
  describeError: (error: unknown) => string;
  // DISCOVER: looks for NEW songs similar to the seed (not in the library).
  // Optional so the preview also works without it.
  findNew?: (
    onProgress: (progress: { done: number; total: number }) => void,
    shouldStop: () => boolean
  ) => Promise<RankedSong[]>;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function PreviewScreen({ seed, kept, songs, onBack, onCreate, describeError, findNew, fromPlaylists = true }: PreviewScreenProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [name, setName] = React.useState(`Prism · ${seedName(seed)}`);
  // How many seed songs go first (1, or a seed playlist's ticked songs).
  const seedCount = seedTrackUris(seed).length;
  // "creating" blocks a second click, which would otherwise make TWO playlists.
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  // Is the "name your playlist" popup open?
  const [naming, setNaming] = React.useState(false);

  // useMemo: remember the ranking and only recompute it if its inputs change,
  // not on every tick of a checkbox (ranking 900 songs is wasted work to repeat).
  const ranking = React.useMemo(
    () => rankWith(growScorer(seed, kept), songs, seedExclusions(seed)),
    [seed, kept, songs]
  );
  // HOW MANY songs to recommend: one of the count chips (10/20/30/50/All) or
  // a custom number. Remembered in LocalStorage for the next Prism.
  const [count, setCount] = React.useState<PickCount>(() => parsePickCount(loadPickCountText()) ?? DEFAULT_PICK_COUNT);
  const [customOpen, setCustomOpen] = React.useState(() => !PICK_COUNTS.includes(count));
  const [customText, setCustomText] = React.useState(() => (typeof count === "number" ? String(count) : ""));
  const customValid = parsePickCount(customText) !== null && customText.trim().toLowerCase() !== "all";

  // The RECOMMENDED songs (the best `count` by rank) start ticked; the user
  // unticks what they don't want. The other matches are hidden under "Show more".
  const recommendedUris = React.useMemo(() => picksFor(ranking.matches, count), [ranking, count]);
  const [picked, setPicked] = React.useState<string[]>(recommendedUris);
  const [showMore, setShowMore] = React.useState(false);

  // ----- New finds (DISCOVER) -----
  // How many to tick (Off/5/10/20/Custom 1-40, remembered), the songs found, and how the
  // search is going. The search starts once, when the count isn't Off.
  const [newCount, setNewCount] = React.useState<NewCount>(() => parseNewCount(loadNewCountText()) ?? DEFAULT_NEW_COUNT);
  const [newSongs, setNewSongs] = React.useState<RankedSong[]>([]);
  const [newState, setNewState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [newProgress, setNewProgress] = React.useState({ done: 0, total: 0 });
  // The count right now, for the search to read when it finishes (the user
  // may change it while it runs). A ref: reading it never re-renders.
  const newCountNow = React.useRef(newCount);
  newCountNow.current = newCount;
  // Set when the screen closes, so a running search stops early.
  const stopped = React.useRef(false);
  React.useEffect(() => () => void (stopped.current = true), []);
  React.useEffect(() => {
    if (!findNew || newCount === "off" || newState !== "idle") return;
    setNewState("loading");
    findNew(setNewProgress, () => stopped.current)
      .then((found) => {
        if (stopped.current) return;
        setNewSongs(found);
        setNewState("done");
        // The best new finds start ticked, like the recommended songs.
        const fresh = newPicks(found, newCountNow.current);
        setPicked((now) => [...now, ...fresh.filter((uri) => !now.includes(uri))]);
      })
      .catch((error) => {
        console.error("[Prism] looking for new finds failed", error);
        if (!stopped.current) setNewState("error");
      });
  }, [findNew, newCount, newState]);

  // Choosing a new-finds count re-ticks the new finds (like the songs count).
  const chooseNewCount = (next: NewCount) => {
    setNewCount(next);
    saveNewCountText(String(next));
    const newUris = newSongs.map((song) => song.uri);
    const fresh = newPicks(newSongs, next);
    setPicked((now) => [...now.filter((uri) => !newUris.includes(uri)), ...fresh]);
  };

  // Choosing a count RE-TICKS: exactly the best N are ticked afterwards
  // (earlier hand-made ticks are replaced). Ticking by hand still works after.
  const chooseCount = (next: PickCount) => {
    setCount(next);
    setPicked(picksFor(ranking.matches, next));
    savePickCountText(String(next));
  };

  const { matches, noMatch } = ranking;
  // New finds, when shown, sit in the same best-first list as library songs.
  const shownNew = newCount === "off" ? [] : newSongs;
  const recommendedNewUris = newPicks(shownNew, newCount);
  const recommendedNew = shownNew.filter((m) => recommendedNewUris.includes(m.uri));
  const recommendedLibrary = matches.filter((m) => recommendedUris.includes(m.uri));
  const recommended = mergeByScore(recommendedLibrary, recommendedNew);
  const more = mergeByScore(
    matches.filter((m) => !recommendedUris.includes(m.uri)),
    shownNew.filter((m) => !recommendedNewUris.includes(m.uri))
  );
  // "Select all" (for the recommended list) reuses the playlist picker's helpers.
  const asRows = recommended.map((m) => ({ uri: m.uri, name: m.name, trackCount: 0, folder: null, owner: "" }));
  const allTicked = allShownSelected(asRows, picked);
  const someTicked = recommended.some((m) => picked.includes(m.uri));
  // What goes into the playlist (after the seed): ticked songs, best first.
  const pickedSongs = mergeByScore(matches, shownNew).filter((m) => picked.includes(m.uri));

  // The line next to the New finds chips.
  const newStatusText = () => {
    if (newCount === "off") return "Only songs from your playlists";
    if (newState === "loading") {
      if (!newProgress.total) return <><span className="prism-star-icon" aria-hidden="true" /> Looking for similar songs…</>;
      // The standard progress bar (docs/ui-elements.md), sized for this row.
      const percent = Math.round((newProgress.done / newProgress.total) * 100);
      return (
        <span style={styles.newLoading}>
          <span><span className="prism-star-icon" aria-hidden="true" /> Looking for similar songs…</span>
          <span
            className="prism-progress"
            style={styles.newBar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            data-prism="new-bar"
          >
            <span className="prism-progress-fill" style={{ display: "block", width: `${percent}%` }} />
          </span>
          <span style={styles.newCounter}>
            {newProgress.done} of {newProgress.total}
          </span>
        </span>
      );
    }
    if (newState === "error") return "Couldn't look for new songs this time";
    if (newState === "done" && newSongs.length === 0) return "No new songs share this vibe's tags";
    if (newState === "done") return <><span className="prism-star-icon" aria-hidden="true" /> {newSongs.length} found that aren't in your library</>;
    return "";
  };

  const renderRow = (song: RankedSong) => (
    <label
      key={song.uri}
      style={styles.row}
      className={`prism-row is-clickable${song.newFind ? " prism-new-find" : ""}`}
      // New finds: mint glass row + "New find" pill + sparkles (styles.ts).
      data-prism={song.newFind ? "new-find" : undefined}
      // A tooltip with the full breakdown, on hover.
      title={breakdown(song)}
    >
      <input
        type="checkbox"
        checked={picked.includes(song.uri)}
        onChange={() => setPicked(toggleInList(picked, song.uri))}
        className="prism-checkbox"
      />
      <ScoreRing score={song.match.score} />
      <span style={styles.rowText}>
        <span style={styles.name}>
          {song.name} <span style={styles.artist}>· {song.artists.join(", ")}</span>
          {song.newFind && <span className="prism-new-pill"><span className="prism-star-icon" aria-hidden="true" />New find</span>}
        </span>
        <TagLabels labels={labelsFor(song.match.matchedTags, song.tags)} artistTags={song.tagStatus === "artist"} />
      </span>
      <SideInfo audio={song.audio} mood={song.mood} />
    </label>
  );

  return (
    <div style={styles.screen} data-prism-state="preview">
      <p style={styles.subtext}>
        {!fromPlaylists
          ? "New finds only: similar songs you don't have yet, best first. Untick any you don't want."
          : matches.length === 0
          ? "No songs in those playlists share this vibe's tags."
          : count === "all"
            ? `All ${recommendedLibrary.length} matching songs${
                recommendedNew.length ? ` + ${recommendedNew.length} new finds` : ""
              }, best first. Untick any you don't want.`
            : `We recommend these ${recommendedLibrary.length} songs${
                recommendedNew.length ? ` + ${recommendedNew.length} new finds` : ""
              }, best first. Untick any you don't want.`}
        {typeof count === "number" && count > recommendedLibrary.length && matches.length > 0
          ? ` (Only ${recommendedLibrary.length} match well enough for ${count}; more are under "Show more".)`
          : ""}
      </p>

      {/* How many songs: the count chips (layout "A", developer's pick). */}
      {matches.length > 0 && (
        <div style={styles.countRow} data-prism="preview-count">
          <span style={styles.countLabel} id="prism-count-songs-label">
            Songs from your playlists
          </span>
          <div className="prism-seg" role="group" aria-labelledby="prism-count-songs-label">
            {PICK_COUNTS.map((option) => {
              const on = !customOpen && count === option;
              return (
                <button
                  key={String(option)}
                  type="button"
                  className={on ? "on" : ""}
                  aria-pressed={on}
                  onClick={() => {
                    setCustomOpen(false);
                    chooseCount(option);
                  }}
                  data-prism={`count-${option}`}
                >
                  {option === "all" ? "All" : option}
                </button>
              );
            })}
            <button
              type="button"
              className={customOpen ? "on" : ""}
              aria-pressed={customOpen}
              onClick={() => {
                setCustomOpen(true);
                // The box keeps its last number: Custom means that number again
                // (otherwise "All" stayed ticked until the number was changed).
                const n = parsePickCount(customText);
                if (typeof n === "number") chooseCount(n);
              }}
              data-prism="count-custom"
            >
              Custom
            </button>
          </div>
          {customOpen && (
            <input
              type="number"
              min={1}
              max={MAX_CUSTOM_COUNT}
              step={1}
              autoFocus
              value={customText}
              placeholder="25"
              onChange={(event) => {
                setCustomText(event.target.value);
                const n = parsePickCount(event.target.value);
                if (typeof n === "number") chooseCount(n);
              }}
              className="prism-glass-input"
              style={styles.customInput}
              aria-label={`Number of songs, 1 to ${MAX_CUSTOM_COUNT}`}
              aria-invalid={!customValid}
              data-prism="count-custom-input"
            />
          )}
          {customOpen && !customValid && <span style={styles.countHint}>1 to {MAX_CUSTOM_COUNT}</span>}
        </div>
      )}

      {/* New finds: similar songs that are NOT in the user's library. */}
      {findNew && (
        <div style={styles.countRow} data-prism="preview-new-count">
          <span style={styles.countLabel} id="prism-count-new-label">
            New finds
          </span>
          {/* No playlist songs: Off would leave only the seed, so it's not offered. */}
          <NewCountChoice
            count={newCount}
            onChoose={chooseNewCount}
            labelledBy="prism-count-new-label"
            allowOff={fromPlaylists}
            prefix="new-count"
          />
          <span style={styles.newStatus} data-prism="new-status" aria-live="polite">
            {newStatusText()}
          </span>
        </div>
      )}

      {/* The seed: always first in the playlist, can't be unticked. */}
      <div className="prism-row is-glass" style={{ ...styles.row, ...styles.seedRow }} data-prism="preview-seed">
        <span
          className="prism-checkbox is-locked"
          role="img"
          aria-label="Always included"
          title={seed.kind === "song" ? "The seed song is always included" : "The seed songs are always included"}
        />
        <span style={styles.rowText}>
          {seed.kind === "song" ? (
            <span style={styles.name}>
              {seed.track.name} <span style={styles.artist}>· {seed.track.artists.join(", ")} · seed song, always first</span>
            </span>
          ) : (
            <span style={styles.name}>
              {seedCount === 1 ? "1 song" : `${seedCount} songs`} from {seed.playlist.name}{" "}
              <span style={styles.artist}>· seed playlist, always first</span>
            </span>
          )}
          <TagLabels labels={kept.slice(0, 4).map((tag) => ({ name: tag.name, colour: tagColour(tag.name), shared: true }))} />
        </span>
        {seed.kind === "song" && <SideInfo audio={seed.audio} mood={seed.mood} />}
      </div>

      {recommended.length > 0 && (
        <label className="prism-row is-clickable is-head" style={styles.row} data-prism="preview-select-all">
          <input
            type="checkbox"
            checked={allTicked}
            ref={(el) => {
              if (el) el.indeterminate = someTicked && !allTicked;
            }}
            onChange={() => setPicked(allTicked ? clearShown(asRows, picked) : selectShown(asRows, picked))}
            className="prism-checkbox"
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
              className="prism-quiet-button"
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

      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack}>
          Back
        </ButtonSecondary>
        {/* Opens the naming popup; nothing is created until "Create" in there. */}
        <ButtonPrimary buttonSize="sm" onClick={() => setNaming(true)} data-prism="open-naming">
          {`Create playlist (${pickedSongs.length + seedCount} songs)`}
        </ButtonPrimary>
      </div>

      {naming && (
        <NamePopup
          name={name}
          setName={setName}
          songCount={pickedSongs.length + seedCount}
          startsWith={seed.kind === "song" ? seed.track.name : `the ${seedCount} songs of ${seed.playlist.name}`}
          creating={creating}
          error={createError}
          onCancel={() => {
            setNaming(false);
            setCreateError(null);
          }}
          onCreate={async () => {
            if (creating || !name.trim()) return;
            setCreating(true);
            setCreateError(null);
            try {
              await onCreate(name, pickedSongs); // on success the page moves on
            } catch (error) {
              console.error("[Prism] creating the playlist failed", error);
              setCreateError(describeError(error));
              setCreating(false);
            }
          }}
        />
      )}
    </div>
  );
}

// ----- The "name your playlist" popup -----
// A liquid-glass card floating over the preview (the preview stays behind
// it, blurred). Enter = Create, Escape = Cancel. The name box starts with
// the suggested name selected, so typing replaces it.
interface NamePopupProps {
  name: string;
  setName: (name: string) => void;
  songCount: number;
  startsWith: string; // "Often", or "the 39 songs of Late night drive"
  creating: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: () => void;
}

function NamePopup({ name, setName, songCount, startsWith, creating, error, onCancel, onCreate }: NamePopupProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const blank = !name.trim();
  return (
    <div
      className="prism-overlay"
      // A click on the dim area outside the card cancels (not while creating).
      onClick={(event) => event.target === event.currentTarget && !creating && onCancel()}
      onKeyDown={(event) => event.key === "Escape" && !creating && onCancel()}
      data-prism="name-popup"
    >
      <div className="prism-glass-card" role="dialog" aria-modal="true" aria-labelledby="prism-name-title">
        <h2 id="prism-name-title" className="prism-screen-title">Name your playlist</h2>
        <p style={styles.popupSub}>
          {songCount} songs, starting with {startsWith}, then the rest in shuffled order
        </p>
        <input
          type="text"
          value={name}
          maxLength={100}
          disabled={creating}
          // autoFocus + select: the cursor is in the box with the text selected.
          autoFocus
          onFocus={(event) => event.target.select()}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && !blank && onCreate()}
          className="prism-glass-input"
          aria-label="Playlist name"
          data-prism="playlist-name"
        />
        {error && (
          <p role="alert" className="prism-notice" style={styles.error} data-prism="create-error">
            {error}
          </p>
        )}
        <div className="prism-actions" style={styles.buttons}>
          <ButtonSecondary buttonSize="sm" onClick={onCancel} disabled={creating} data-prism="name-cancel">
            Cancel
          </ButtonSecondary>
          <ButtonPrimary buttonSize="sm" onClick={onCreate} disabled={creating || blank} data-prism="name-create">
            {creating ? "Creating..." : "Create"}
          </ButtonPrimary>
        </div>
      </div>
    </div>
  );
}

// ----- Row pieces -----

// The score as a ring that fills up (76% = three quarters round), with the
// number in the middle. strokeDasharray draws the ring as one dash as long as
// the score's share of the circle; rotate(-90) starts it at the top.
// The fill is a lavender-to-pink gradient. Every ring defines the same
// gradient id; they're identical, so it doesn't matter which one is used.
// Right side: "102 BPM · 8A" and the main lyrics moods.
function SideInfo({ audio, mood }: { audio: AudioAttributes | null; mood: MoodProfile | null }) {
  const moods = mood ? topMoods(mood) : [];
  return (
    <span style={styles.side}>
      <span>{audio ? `${Math.round(audio.bpm)} BPM · ${audio.camelot}` : ""}</span>
      <span>{moods.join(", ")}</span>
    </span>
  );
}

// e.g. "Score 82% · tags 90% (r&b, dark) · mood 70% · tempo 75% · key 80%"
//      "98 BPM, G minor (6A) · Lyrics mood: heartbreak, dark"
function breakdown(song: RankedSong): string {
  const parts = [`Score ${percent(song.match.score)}`, `tags ${percent(song.match.tagScore)} (${song.match.matchedTags.join(", ")})`];
  parts.push(song.match.moodScore === null ? "mood unknown" : `mood ${percent(song.match.moodScore)}`);
  parts.push(song.match.bpmScore === null ? "tempo unknown" : `tempo ${percent(song.match.bpmScore)}`);
  parts.push(song.match.keyScore === null ? "key unknown" : `key ${percent(song.match.keyScore)}`);
  const newLine = song.newFind
    ? `\nNew find: not in your library. Last.fm rates it ${percent(song.newFind.similarity)} similar to the seed.`
    : "";
  return `${parts.join(" · ")}\n${formatAudio(song.audio)} · ${formatMood(song.mood)}${newLine}`;
}

const styles: Record<string, React.CSSProperties> = {
  // position: relative so the naming popup can cover exactly this screen.
  screen: { display: "flex", flexDirection: "column", gap: 10, height: SCREEN_HEIGHT, position: "relative" },
  popupSub: { margin: "0 0 4px", color: "var(--spice-subtext)", fontSize: 13 },
  subtext: { color: "var(--spice-subtext)", margin: 0 },
  countRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  countLabel: { fontSize: 13, fontWeight: 600, color: "var(--spice-text)" },
  customInput: { width: 76, padding: "5px 10px", fontSize: 13 },
  countHint: { fontSize: 12, color: "#ffb3c7" },
  newStatus: { fontSize: 12, color: "#bff3e1" },
  newLoading: { display: "inline-flex", alignItems: "center", gap: 8 },
  newBar: { display: "block", width: 140 },
  // tabular-nums: the count's width doesn't jitter as the numbers change.
  newCounter: { fontVariantNumeric: "tabular-nums", color: "var(--spice-subtext)" },
  note: { color: "var(--spice-subtext)", margin: 0, fontSize: 13, height: "3em", overflow: "hidden" },
  list: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 },
  // Look (corners, lines, hover) comes from .prism-row in styles.ts.
  row: { display: "flex", alignItems: "center", gap: 12, padding: "6px 8px" },
  seedRow: { cursor: "default", marginBottom: 2 },
  rowText: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 },
  artist: { color: "var(--spice-subtext)", fontWeight: 400, fontSize: 13 },
  side: { display: "flex", flexDirection: "column", alignItems: "flex-end", color: "var(--spice-subtext)", fontSize: 12, flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  name: { color: "var(--spice-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
  // Box + rainbow edge come from the prism-notice class (styles.ts).
  error: { fontSize: 13, padding: "6px 10px 6px 14px" },
  moreToggle: { padding: "10px 8px", fontSize: 14 },
};
