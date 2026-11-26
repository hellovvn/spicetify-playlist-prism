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
import type { RankedSong } from "../scoring/rank";

export interface SeedData {
  track: TrackInfo;
  tags: SourcedTag[];
  audio: AudioAttributes | null;
  mood: MoodProfile | null; // from the lyrics (step 10); null = unknown
}

export interface SeedPanelProps {
  // Loads everything about the seed. The panel calls it once when it opens.
  load: () => Promise<SeedData>;
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
//   screen "sources": playlist picker
//   screen "scan":    scanning progress, then a summary
//   screen "preview": ranked matches with scores; pick what goes in
export function SeedPanel({ load, loadSources, runScan, describeError, onCancel, onScanningChange, onCreate, findNew }: SeedPanelProps) {
  const [data, setData] = React.useState<SeedData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [screen, setScreen] = React.useState<"seed" | "sources" | "scan" | "preview">("seed");
  const [scan, setScan] = React.useState<ScanOutcome | null>(null); // the finished scan
  const [offNames, setOffNames] = React.useState<string[]>([]); // chips switched off
  const [selectedSources, setSelectedSources] = React.useState<string[]>([]); // ticked playlist URIs
  const [picked, setPicked] = React.useState<SourceOption[]>([]); // the sources being scanned

  // useEffect runs code AFTER the panel is on screen (so the spinner can
  // appear first). The empty [] means "only once, when it opens".
  React.useEffect(() => {
    // If the panel goes away before loading finishes, don't update a
    // component that's gone. The function we return runs when it goes.
    let closed = false;
    load()
      .then((loaded) => !closed && setData(loaded))
      .catch((err) => {
        console.error("[Prism] loading the seed failed", err);
        if (!closed) setError(describeError(err));
      });
    return () => {
      closed = true;
    };
  }, []);

  let body: React.ReactNode;
  if (error) {
    body = (
      <div className="prism-fade-in" style={styles.centered} data-prism-state="error">
        <p style={styles.text}>{error}</p>
      </div>
    );
  } else if (!data) {
    body = (
      <div style={styles.centered} data-prism-state="loading">
        <div className="prism-spinner" />
        <p style={styles.subtext}>Reading the song...</p>
      </div>
    );
  } else if (screen === "seed") {
    body = (
      <SeedContent
        data={data}
        offNames={offNames}
        setOffNames={setOffNames}
        onNext={() => setScreen("sources")}
        onCancel={onCancel}
      />
    );
  } else if (screen === "sources") {
    body = (
      // The wrapper's `key` makes React treat each screen as new, so the
      // fade-in plays when switching screens.
      <div key="sources" className="prism-fade-in">
        <SourcePicker
          loadSources={loadSources}
          describeError={describeError}
          selected={selectedSources}
          setSelected={setSelectedSources}
          onBack={() => setScreen("seed")}
          onNext={(sources) => {
            setPicked(sources);
            setScreen("scan");
          }}
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
          seed={data}
          kept={keptTags(data.tags, offNames)}
          songs={scan?.songs ?? []}
          // Back goes to the playlist picker (re-scanning is quick thanks to the cache).
          onBack={() => setScreen("sources")}
          describeError={describeError}
          onCreate={(name, songs) => onCreate({ name, seed: data, kept: keptTags(data.tags, offNames), sources: picked, songs })}
          findNew={findNew && ((onProgress, shouldStop) => findNew(data, keptTags(data.tags, offNames), onProgress, shouldStop))}
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
  data: SeedData;
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
          Next: choose playlists
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
};
