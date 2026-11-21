// Seed panel: the popup that opens after "Start a Prism playlist".
//
// It opens IMMEDIATELY with a loading spinner, then loads the song's details,
// tags, and BPM/key itself, and fades the content in. (Before, the popup only
// appeared after a ~1 s wait, which felt abrupt.)
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
import type { SourcedTag } from "../tags/combineTags";
import { canContinue, keptTags, seedStatus, splitBySource, toggleTag } from "./tagSelection";

export interface SeedData {
  track: TrackInfo;
  tags: SourcedTag[];
  audio: AudioAttributes | null;
}

export interface SeedPanelProps {
  // Loads everything about the seed. The panel calls it once when it opens.
  load: () => Promise<SeedData>;
  // Turns an error into a message the user can act on.
  describeError: (error: unknown) => string;
  onNext: (kept: SourcedTag[]) => void;
}

// The outer component: loading -> ready (or error).
function SeedPanel({ load, describeError, onNext }: SeedPanelProps) {
  const [data, setData] = React.useState<SeedData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // useEffect runs code AFTER the panel is on screen (so the popup can
  // appear first). The empty [] means "only once, when it opens".
  React.useEffect(() => {
    // If the popup is closed before loading finishes, don't update a
    // component that's gone. The function we return runs on close.
    let closed = false;
    load()
      .then((loaded) => !closed && setData(loaded))
      .catch((err) => {
        console.error("[Playlist Prism] loading the seed failed", err);
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
  } else {
    body = <SeedContent data={data} onNext={onNext} />;
  }

  // data-prism marks this as Prism content (the open animation looks for it).
  return (
    <div style={styles.panel} data-prism="seed-panel">
      {body}
    </div>
  );
}

// The loaded content: song info, chips, and buttons.
function SeedContent({ data, onNext }: { data: SeedData; onNext: SeedPanelProps["onNext"] }) {
  // Read Spotify's components here, not at the top of the file: the file is
  // loaded before Spicetify is ready, but this runs only when the panel opens.
  // `as any`: Chip exists in Spotify (checked in the running app) but is
  // missing from Spicetify's type definitions file.
  const { Chip, ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;

  // The names of the tags the user switched off. Starts empty = all on.
  const [offNames, setOffNames] = React.useState<string[]>([]);

  const { track, tags, audio } = data;
  const kept = keptTags(tags, offNames);
  const { song, artist } = splitBySource(tags);
  const status = seedStatus(tags, kept);
  const allowed = canContinue(status);

  // One chip per tag. `key` helps React tell list items apart.
  const renderChips = (list: SourcedTag[]) => (
    <div style={styles.chipRow}>
      {list.map((tag) => (
        <Chip
          key={tag.name}
          selected={!offNames.includes(tag.name)}
          onClick={() => setOffNames(toggleTag(offNames, tag.name))}
        >
          {tag.name}
        </Chip>
      ))}
    </div>
  );

  return (
    <div className="prism-fade-in" style={styles.panel} data-prism-state="ready">
      <div>
        <div style={styles.songName}>{track.name}</div>
        <div style={styles.subtext}>{track.artists.join(", ")}</div>
        <div style={styles.subtext}>{formatAudio(audio)}</div>
      </div>

      {tags.length > 0 && (
        <>
          <p style={styles.subtext}>Switch off any tags that don't fit the vibe you want.</p>
          {song.length > 0 && (
            <section>
              <h3 style={styles.heading}>Song tags</h3>
              {renderChips(song)}
            </section>
          )}
          {artist.length > 0 && (
            <section>
              <h3 style={styles.heading}>From the artist (less specific)</h3>
              {renderChips(artist)}
            </section>
          )}
          <p style={styles.subtext} data-prism="kept-count">
            {kept.length} of {tags.length} tags on
          </p>
        </>
      )}

      {/* Blocked = red-ish, warning = yellow-ish. role="status" makes screen
          readers announce the message when it appears. */}
      {"message" in status && (
        <p
          role="status"
          data-prism="status"
          data-prism-kind={status.kind}
          style={{ ...styles.notice, borderColor: allowed ? "#f5c542" : "#f15e6c" }}
        >
          {status.message}
        </p>
      )}

      <div style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={() => Spicetify.PopupModal.hide()}>
          Cancel
        </ButtonSecondary>
        <ButtonPrimary buttonSize="sm" disabled={!allowed} onClick={() => allowed && onNext(kept)}>
          Next: choose playlists
        </ButtonPrimary>
      </div>
    </div>
  );
}

// Inline styles, using Spotify's theme colours (CSS variables), so the panel
// follows whatever Spicetify theme the user has.
const styles: Record<string, React.CSSProperties> = {
  panel: { display: "flex", flexDirection: "column", gap: 16, minWidth: 420 },
  centered: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0" },
  songName: { fontSize: 20, fontWeight: 700, color: "var(--spice-text)" },
  text: { color: "var(--spice-text)", margin: 0, textAlign: "center" },
  subtext: { color: "var(--spice-subtext)", margin: 0 },
  heading: { fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: "var(--spice-text)" },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  notice: { margin: 0, padding: "8px 12px", borderLeft: "3px solid", color: "var(--spice-text)", background: "var(--spice-card)", borderRadius: 4 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
};

export function openSeedPanel(props: SeedPanelProps) {
  Spicetify.PopupModal.display({
    title: "Start a Prism playlist",
    // key={Date.now()}: a fresh panel every time, so chips from the last song
    // never carry over (React reuses a component if nothing tells it otherwise).
    content: <SeedPanel key={Date.now()} {...props} />,
  });
}
