// Scan screen: screen 3 of the Prism flow. Starts the scan as soon as it
// opens, shows a progress bar, and ends with a summary of what was found.
//
// Leaving the page (or Cancel / Back) STOPS the scan: nothing keeps running
// in the background yet (step 12b changes that). Everything already looked up is saved in the cache, so
// scanning again later picks up where it stopped.

import React from "react";
import type { SourceOption } from "../sources/sources";
import { summarize, timeLeftText, type ScanProgress, type ScannedSong } from "../scan/scan";
import { SCREEN_HEIGHT } from "./styles";
import { ScanningPrism } from "./PrismIcon";

export interface ScanOutcome {
  songs: ScannedSong[];
  cancelled: boolean;
  moodFailed: number; // lyrics lookups skipped (Spotify's limit); the next scan retries them
  duplicates: number;
}

export interface ScanScreenProps {
  sources: SourceOption[];
  runScan: (
    sources: SourceOption[],
    onProgress: (progress: ScanProgress) => void,
    shouldStop: () => boolean
  ) => Promise<ScanOutcome>;
  describeError: (error: unknown) => string;
  onBack: () => void;
  onNext: (scan: ScanOutcome) => void;
  // Told true while a scan is running, false when it ends or this screen goes.
  // (The page uses it to warn before "Start page" stops a scan.)
  onRunningChange?: (running: boolean) => void;
  nextLabel?: string; // the button after the scan (default "Next: see matches")
}

export function ScanScreen({ sources, runScan, describeError, onBack, onNext, onRunningChange, nextLabel }: ScanScreenProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [progress, setProgress] = React.useState<ScanProgress | null>(null);
  const [outcome, setOutcome] = React.useState<ScanOutcome | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stopping, setStopping] = React.useState(false);

  // useRef: a box that holds a value across re-renders WITHOUT causing one.
  // The scan reads stopRef.current to know whether to stop; changing it
  // shouldn't redraw anything, so it's a ref, not state.
  const stopRef = React.useRef(false);
  const startedAt = React.useRef(Date.now());

  React.useEffect(() => {
    let closed = false;
    runScan(sources, (p) => !closed && setProgress(p), () => stopRef.current)
      .then((result) => !closed && setOutcome(result))
      .catch((err) => {
        console.error("[Playlist Prism] scan failed", err);
        if (!closed) setError(describeError(err));
      });
    // Cleanup: runs when this screen goes away (Back, or the popup closes).
    return () => {
      closed = true;
      stopRef.current = true;
    };
  }, []);

  // Report running / not running whenever that changes, and "not running"
  // when this screen goes away.
  const running = !outcome && !error;
  React.useEffect(() => {
    onRunningChange?.(running);
  }, [running]);
  React.useEffect(() => () => onRunningChange?.(false), []);

  function cancel() {
    stopRef.current = true;
    setStopping(true); // the songs already being looked up still finish
  }

  // ----- Error -----
  if (error) {
    return (
      <div style={styles.screen} data-prism-state="scan-error">
        <div style={styles.middle}>
          <p style={styles.text}>{error}</p>
        </div>
        <div className="prism-actions" style={styles.buttons}>
          <ButtonSecondary buttonSize="sm" onClick={onBack}>
            Back
          </ButtonSecondary>
        </div>
      </div>
    );
  }

  // ----- Finished (or cancelled) -----
  if (outcome) {
    const s = summarize(outcome.songs);
    const rows: [string, number, string][] = [
      ["With their own song tags", s.songTags, "best matches"],
      ["Artist tags only", s.artistOnly, "broader matches"],
      ["No tags found", s.noTags, "little to match on"],
      ["Lookup failed", s.failed, "skipped; try scanning again later"],
    ];
    return (
      <div className="prism-fade-in" style={styles.screen} data-prism-state="scan-done">
        <div>
          <div className="prism-screen-title">
            {outcome.cancelled ? `Stopped after ${s.total} songs` : `Scanned ${s.total} songs`}
          </div>
          <p style={styles.subtext}>
            {outcome.duplicates > 0 && `${outcome.duplicates} duplicates skipped · `}
            BPM/key found for {s.withBpm} of {s.total} · lyrics mood for {s.withMood}
            {outcome.moodFailed > 0 && ` · ${outcome.moodFailed} more next scan`}
          </p>
        </div>
        <table style={styles.table} data-prism="scan-summary">
          <tbody>
            {rows
              .filter(([, count], i) => count > 0 || i < 2)
              .map(([label, count, note]) => (
                <tr key={label}>
                  <td style={styles.count}>{count}</td>
                  <td style={styles.text}>{label}</td>
                  <td style={styles.note}>{note}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div style={styles.middle} />
        <div className="prism-actions" style={styles.buttons}>
          <ButtonSecondary buttonSize="sm" onClick={onBack}>
            Back
          </ButtonSecondary>
          <ButtonPrimary buttonSize="sm" disabled={s.total === 0} onClick={() => s.total > 0 && onNext(outcome)}>
            {nextLabel ?? "Next: see matches"}
          </ButtonPrimary>
        </div>
      </div>
    );
  }

  // ----- Running -----
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const timeLeft = progress ? timeLeftText(progress, Date.now() - startedAt.current) : null;
  return (
    <div style={styles.screen} data-prism-state="scanning">
      <div style={styles.middle}>
        {/* Big diamond with shimmering rainbow rays: shows the scan is working. */}
        <div style={styles.prism}>
          <ScanningPrism size={168} />
        </div>
        <div className="prism-screen-title" style={styles.titleSlot}>
          {progress ? `Scanning ${progress.total} songs` : "Reading your playlists..."}
        </div>
        {/* role="progressbar" + aria values: screen readers announce the percentage. */}
        <div
          className="prism-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          data-prism="scan-bar"
        >
          <div className="prism-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {/* Each text below sits in a FIXED-height slot and never wraps, so
            changing text ("575 of 704", "about 3 min left"...) can't change
            the layout and make the bar jump up and down. */}
        <p style={styles.slotLine} data-prism="scan-count">
          {progress ? `${progress.done} of ${progress.total} songs` : ""}
        </p>
        <p style={styles.slotLine} data-prism="scan-detail">
          {[progress?.fromCache ? `${progress.fromCache} remembered from last time` : "", timeLeft ?? ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p style={styles.slotNote}>
          {stopping
            ? "Stopping..."
            : "Tags come from Last.fm, a few songs per second. Songs scanned before are remembered, so next time is faster."}
        </p>
      </div>
      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={cancel} disabled={stopping}>
          Cancel
        </ButtonSecondary>
      </div>
    </div>
  );
}

// DEV/TEST ONLY (used by the smoke test via the debug hook): the scan screen
// with a FAKE scan that never finishes. It puts setPreviewProgress on the
// debug hook so a test can set the progress by hand and check the layout for
// any numbers, even when every song is cached and a real scan ends at once.
export function ScanDemo({ onRunningChange }: { onRunningChange?: (running: boolean) => void }) {
  const pushRef = React.useRef<(progress: ScanProgress) => void>(() => {});
  // useMemo with []: create the fake scan once, so re-renders don't restart it.
  const fakeScan = React.useMemo<ScanScreenProps["runScan"]>(
    () => (_sources, onProgress) => {
      pushRef.current = onProgress;
      return new Promise(() => {}); // never resolves: stays on the progress view
    },
    []
  );
  React.useEffect(() => {
    const hook = ((window as any).__playlistPrism ??= {});
    hook.setPreviewProgress = (progress: ScanProgress) => pushRef.current(progress);
    return () => {
      delete hook.setPreviewProgress;
    };
  }, []);
  return (
    <div data-prism="scan-preview">
      <ScanScreen sources={[]} runScan={fakeScan} describeError={String} onBack={() => {}} onNext={() => {}} onRunningChange={onRunningChange} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: { display: "flex", flexDirection: "column", gap: 16, height: SCREEN_HEIGHT },
  middle: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 },
  titleSlot: { height: "1.4em", lineHeight: "1.4em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  text: { color: "var(--spice-text)", margin: 0 },
  subtext: { color: "var(--spice-subtext)", margin: 0, minHeight: "1.4em" },
  note: { color: "var(--spice-subtext)", margin: 0, fontSize: 13 },
  // One line, always the same height; too-long text is cut with "..." instead of wrapping.
  // tabular-nums: every digit is the same width, so "111" and "888" take equal space.
  slotLine: {
    color: "var(--spice-subtext)", margin: 0, height: "1.5em", lineHeight: "1.5em",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums",
  },
  // Room for exactly two lines, whether the note is long or just "Stopping...".
  slotNote: { color: "var(--spice-subtext)", margin: 0, fontSize: 13, height: "3em", lineHeight: "1.5em", overflow: "hidden" },
  // The width animates smoothly between updates instead of jumping.
  prism: { display: "flex", justifyContent: "center", marginBottom: 8 },
  table: { borderCollapse: "collapse", width: "100%" },
  count: { color: "var(--spice-text)", fontWeight: 700, padding: "6px 12px 6px 0", textAlign: "right", width: 48 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
};
