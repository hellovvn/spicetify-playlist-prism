// Preview screen: screen 4 of the Prism flow. Shows every matching song,
// best first, with its score and WHY it matched. The best ones start ticked;
// the user can change any tick. The seed song is always first.
//
// Each row: tick box, a score ring, the song, its genre labels (frosted glass
// with a colour dot; bright = shared with the seed, faint = extra), and on
// the right its BPM/key and lyrics mood.
//
// Nothing is created here: "Create playlist" hands the picks to step 9.

import React from "react";
import type { ScannedSong } from "../scan/scan";
import {
  DEFAULT_PICK_COUNT,
  MAX_CUSTOM_COUNT,
  PICK_COUNTS,
  parsePickCount,
  picksFor,
  rankSongs,
  type PickCount,
  type RankedSong,
} from "../scoring/rank";
import { loadNewCountText, loadPickCountText, saveNewCountText, savePickCountText } from "../storage";
import { DEFAULT_NEW_COUNT, mergeByScore, NEW_COUNTS, newPicks, parseNewCount, type NewCount } from "../discover/discover";
import type { SourcedTag } from "../tags/combineTags";
import { formatAudio } from "../spotify/audio";
import { formatMood, topMoods, type MoodProfile } from "../mood/lyricsMood";
import type { AudioAttributes } from "../spotify/audio";
import { labelsFor, tagColour } from "./tagLabels";
import { TagLabels } from "./GenreLabels";
import { allShownSelected, clearShown, selectShown } from "../sources/sources";
import type { SeedData } from "./SeedPanel";
import { SCREEN_HEIGHT } from "./styles";
import { toggleTag as toggleInList } from "./tagSelection";

export interface PreviewScreenProps {
  seed: SeedData;
  kept: SourcedTag[]; // the seed tags the user kept ON
  songs: ScannedSong[]; // everything the scan found
  onBack: () => void;
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

export function PreviewScreen({ seed, kept, songs, onBack, onCreate, describeError, findNew }: PreviewScreenProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [name, setName] = React.useState(`Prism · ${seed.track.name}`);
  // "creating" blocks a second click, which would otherwise make TWO playlists.
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  // Is the "name your playlist" popup open?
  const [naming, setNaming] = React.useState(false);

  // useMemo: remember the ranking and only recompute it if its inputs change,
  // not on every tick of a checkbox (ranking 900 songs is wasted work to repeat).
  const ranking = React.useMemo(
    () => rankSongs({ ...seed.track, tags: kept, audio: seed.audio, mood: seed.mood }, songs),
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
  // How many to tick (Off/5/10/20, remembered), the songs found, and how the
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
        console.error("[Playlist Prism] looking for new finds failed", error);
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
      const counter = newProgress.total ? ` ${newProgress.done} of ${newProgress.total}` : "";
      return `✦ Looking for similar songs…${counter}`;
    }
    if (newState === "error") return "Couldn't look for new songs this time";
    if (newState === "done" && newSongs.length === 0) return "No new songs share this vibe's tags";
    if (newState === "done") return `✦ ${newSongs.length} found that aren't in your library`;
    return "";
  };

  const renderRow = (song: RankedSong) => (
    <label
      key={song.uri}
      style={styles.row}
      // New finds: mint glass row + "New find" pill + sparkles (styles.ts).
      className={song.newFind ? "prism-new-find" : undefined}
      data-prism={song.newFind ? "new-find" : undefined}
      // A tooltip with the full breakdown, on hover.
      title={breakdown(song)}
    >
      <input
        type="checkbox"
        checked={picked.includes(song.uri)}
        onChange={() => setPicked(toggleInList(picked, song.uri))}
        style={styles.checkbox}
      />
      {song.newFind ? (
        <span className="prism-ring-wrap">
          <ScoreRing score={song.match.score} />
          <span className="prism-sparkle" style={{ top: -2, right: -3, fontSize: 12 }} aria-hidden="true">✦</span>
          <span className="prism-sparkle" style={{ bottom: 0, left: -4, fontSize: 10, animationDelay: "0.8s" }} aria-hidden="true">✧</span>
          <span className="prism-sparkle" style={{ top: 20, right: -8, fontSize: 8, animationDelay: "1.6s" }} aria-hidden="true">✦</span>
        </span>
      ) : (
        <ScoreRing score={song.match.score} />
      )}
      <span style={styles.rowText}>
        <span style={styles.name}>
          {song.name} <span style={styles.artist}>· {song.artists.join(", ")}</span>
          {song.newFind && <span className="prism-new-pill">✦ New find</span>}
        </span>
        <TagLabels labels={labelsFor(song.match.matchedTags, song.tags)} artistTags={song.tagStatus === "artist"} />
      </span>
      <SideInfo audio={song.audio} mood={song.mood} />
    </label>
  );

  return (
    <div style={styles.screen} data-prism-state="preview">
      <p style={styles.subtext}>
        {matches.length === 0
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
              onClick={() => setCustomOpen(true)}
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
          <div className="prism-seg" role="group" aria-labelledby="prism-count-new-label">
            {NEW_COUNTS.map((option) => (
              <button
                key={String(option)}
                type="button"
                className={newCount === option ? "on" : ""}
                aria-pressed={newCount === option}
                onClick={() => chooseNewCount(option)}
                data-prism={`new-count-${option}`}
              >
                {option === "off" ? "Off" : option}
              </button>
            ))}
          </div>
          <span style={styles.newStatus} data-prism="new-status" aria-live="polite">
            {newStatusText()}
          </span>
        </div>
      )}

      {/* The seed: always first in the playlist, can't be unticked. */}
      <div style={{ ...styles.row, ...styles.seedRow }} data-prism="preview-seed">
        <span style={styles.lockedTick}>✓</span>
        <span style={styles.rowText}>
          <span style={styles.name}>
            {seed.track.name} <span style={styles.artist}>· {seed.track.artists.join(", ")} · seed song, always first</span>
          </span>
          <TagLabels labels={kept.slice(0, 4).map((tag) => ({ name: tag.name, colour: tagColour(tag.name), shared: true }))} />
        </span>
        <SideInfo audio={seed.audio} mood={seed.mood} />
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

      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack}>
          Back
        </ButtonSecondary>
        {/* Opens the naming popup; nothing is created until "Create" in there. */}
        <ButtonPrimary buttonSize="sm" onClick={() => setNaming(true)} data-prism="open-naming">
          {`Create playlist (${pickedSongs.length + 1} songs)`}
        </ButtonPrimary>
      </div>

      {naming && (
        <NamePopup
          name={name}
          setName={setName}
          songCount={pickedSongs.length + 1}
          seedName={seed.track.name}
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
              console.error("[Playlist Prism] creating the playlist failed", error);
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
  seedName: string;
  creating: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: () => void;
}

function NamePopup({ name, setName, songCount, seedName, creating, error, onCancel, onCreate }: NamePopupProps) {
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
        <h2 id="prism-name-title" style={styles.popupTitle}>Name your playlist</h2>
        <p style={styles.popupSub}>
          {songCount} songs, starting with {seedName}, then the rest in shuffled order
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
function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const round = 2 * Math.PI * r;
  const pct = Math.round(score * 100);
  return (
    <svg width={52} height={52} viewBox="0 0 52 52" style={{ flexShrink: 0 }} data-prism="preview-score" role="img" aria-label={`${pct}% match`}>
      <defs>
        <linearGradient id="prism-score-fill" x1="0" x2="1">
          <stop offset="0" stopColor="#cdb8ff" />
          <stop offset="1" stopColor="#ffb3c7" />
        </linearGradient>
      </defs>
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4} />
      <circle
        cx={26} cy={26} r={r} fill="none" stroke="url(#prism-score-fill)" strokeWidth={4} strokeLinecap="round"
        strokeDasharray={`${(round * pct) / 100} ${round}`} transform="rotate(-90 26 26)"
      />
      <text x={26} y={31} textAnchor="middle" fontSize={15} fontWeight={700} fill="#ffffff">
        {pct}
        <tspan fontSize={10}>%</tspan>
      </text>
    </svg>
  );
}

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
  popupTitle: { margin: 0, fontSize: 22, fontWeight: 300, letterSpacing: "0.02em", fontFamily: '"Segoe UI Variable Display", "Segoe UI", sans-serif', color: "#ffffff" },
  popupSub: { margin: "0 0 4px", color: "var(--spice-subtext)", fontSize: 13 },
  subtext: { color: "var(--spice-subtext)", margin: 0 },
  countRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  countLabel: { fontSize: 13, fontWeight: 600, color: "var(--spice-text)" },
  customInput: { width: 76, padding: "5px 10px", fontSize: 13 },
  countHint: { fontSize: 12, color: "#ffb3c7" },
  newStatus: { fontSize: 12, color: "#bff3e1" },
  note: { color: "var(--spice-subtext)", margin: 0, fontSize: 13, height: "3em", overflow: "hidden" },
  list: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "6px 4px", borderRadius: 6, cursor: "pointer", borderTop: "1px solid rgba(255,255,255,0.06)" },
  seedRow: { background: "var(--spice-card)", cursor: "default" },
  selectAllRow: { borderBottom: "1px solid var(--spice-card)", borderRadius: 0 },
  lockedTick: { width: 18, textAlign: "center", color: "var(--spice-button)", fontWeight: 700, flexShrink: 0 },
  checkbox: { width: 18, height: 18, accentColor: "var(--spice-button)", cursor: "pointer", flexShrink: 0 },
  rowText: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 },
  artist: { color: "var(--spice-subtext)", fontWeight: 400, fontSize: 13 },
  side: { display: "flex", flexDirection: "column", alignItems: "flex-end", color: "var(--spice-subtext)", fontSize: 12, flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  name: { color: "var(--spice-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
  // Box + rainbow edge come from the prism-notice class (styles.ts).
  error: { fontSize: 13, padding: "6px 10px 6px 14px" },
  moreToggle: {
    background: "none", border: "none", padding: "10px 4px", textAlign: "left", cursor: "pointer",
    color: "var(--spice-subtext)", fontWeight: 600, fontSize: 14,
  },
};
