// Merge playlists (2026-11-23): join two or more playlists into ONE new
// playlist without duplicates. Optionally the originals get "[merged] " in
// front of their names, so you can see which ones were merged (the one
// exception to the hard rule, see CLAUDE.md). Their songs are never changed.
//
// Screens:
//   pick     the SAME playlist picker as Grow and Remix (2 or more)
//   review   each playlist's song count, the total, duplicates dropped, the
//            new name, and the rename switch
//   done     Open the new playlist, or back to the start page
//
// Dedupe: src/merge/mergePlaylists.ts (pure). Writing: flow.ts mergePlaylists
// -> src/spotify/write.ts createMergedPlaylist (guarded).

import React from "react";
import type { SourceOption } from "../sources/sources";
import type { ScanTrack } from "../scan/tracks";
import { defaultMergeName, mergeSongs } from "../merge/mergePlaylists";
import { mergedName, type MergeResult } from "../spotify/write";
import { SourcePicker } from "./SourcePicker";
import { SCREEN_HEIGHT } from "./styles";

export interface MergeChoice {
  name: string;
  tracks: ScanTrack[];
  sources: SourceOption[];
  renameSources: boolean;
}

export interface MergeFlowProps {
  loadSources: () => Promise<SourceOption[]>;
  loadTracks: (uri: string) => Promise<ScanTrack[]>; // read-only
  merge: (choice: MergeChoice) => Promise<MergeResult>;
  describeError: (error: unknown) => string;
  onCancel: () => void; // to the start page
  onOpenPlaylist: (uri: string) => void;
}

// Why a playlist can't get the tag (shown on its row while the switch is on).
function cantRenameReason(source: SourceOption): string | null {
  if (!source.uri.startsWith("spotify:playlist:")) return "Liked Songs keeps its name";
  if (!source.canRename) return "not yours, keeps its name";
  if (mergedName(source.name) === source.name) return "already tagged";
  return null;
}

export function MergeFlow(props: MergeFlowProps) {
  const { loadSources, loadTracks, merge, describeError, onCancel, onOpenPlaylist } = props;
  const [screen, setScreen] = React.useState<"pick" | "review">("pick");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [picked, setPicked] = React.useState<SourceOption[]>([]);

  return (
    <div key={screen} className="prism-fade-in" data-prism="merge" data-prism-merge={screen}>
      <h2 className="prism-screen-title" style={styles.title}>Merge playlists</h2>
      {screen === "pick" ? (
        <SourcePicker
          loadSources={loadSources}
          describeError={describeError}
          selected={selected}
          setSelected={setSelected}
          onBack={onCancel}
          onNext={(sources) => {
            // In the order the user ticked them, so the first pick's songs come first.
            setPicked(selected.map((uri) => sources.find((s) => s.uri === uri)!).filter(Boolean));
            setScreen("review");
          }}
          minPicked={2}
          intro="Pick two or more playlists. Prism joins them into one new playlist and leaves out duplicates. The songs in your playlists stay as they are."
          nextLabel="Next: review"
        />
      ) : (
        <MergeReview
          sources={picked}
          loadTracks={loadTracks}
          merge={merge}
          describeError={describeError}
          onBack={() => setScreen("pick")}
          onOpen={onOpenPlaylist}
          onFinish={onCancel}
        />
      )}
    </div>
  );
}

function MergeReview(props: {
  sources: SourceOption[];
  loadTracks: MergeFlowProps["loadTracks"];
  merge: MergeFlowProps["merge"];
  describeError: (error: unknown) => string;
  onBack: () => void;
  onOpen: (uri: string) => void;
  onFinish: () => void;
}) {
  const { sources, loadTracks, merge, describeError, onBack, onOpen, onFinish } = props;
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [lists, setLists] = React.useState<ScanTrack[][] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(() => defaultMergeName(sources.map((s) => s.name)));
  const [rename, setRename] = React.useState(true);
  const [phase, setPhase] = React.useState<"confirm" | "merging" | "done">("confirm");
  const [result, setResult] = React.useState<MergeResult | null>(null);
  const [showDuplicates, setShowDuplicates] = React.useState(false);

  // Read every picked playlist's songs once (read-only).
  React.useEffect(() => {
    let closed = false;
    Promise.all(sources.map((s) => loadTracks(s.uri)))
      .then((all) => !closed && setLists(all))
      .catch((err) => {
        console.error("[Prism] reading playlists to merge failed", err);
        if (!closed) setError(describeError(err));
      });
    return () => {
      closed = true;
    };
  }, []);

  if (!lists) {
    return (
      <div style={styles.centered} data-prism-state={error ? "merge-error" : "loading"}>
        {error ? (
          <>
            <p style={styles.text}>{error}</p>
            <ButtonSecondary buttonSize="sm" onClick={onBack}>
              Back
            </ButtonSecondary>
          </>
        ) : (
          <>
            <div className="prism-spinner" />
            <p style={styles.sub}>Reading your playlists...</p>
          </>
        )}
      </div>
    );
  }

  const plan = mergeSongs(lists);
  const cleanName = name.trim();
  const start = async () => {
    setPhase("merging");
    setError(null);
    try {
      const outcome = await merge({ name: cleanName, tracks: plan.tracks, sources, renameSources: rename });
      setResult(outcome);
      setPhase("done");
      Spicetify.showNotification?.(`Created "${cleanName}" with ${plan.tracks.length} songs`);
    } catch (err) {
      setError(describeError(err));
      setPhase("confirm");
    }
  };

  return (
    <div style={styles.screen} data-prism-state={`merge-${phase}`}>
      <div>
        <p className="prism-screen-title" data-prism="merge-title">
          {phase === "done" ? `Merged into "${cleanName}"` : phase === "merging" ? "Merging…" : `Merge ${sources.length} playlists`}
        </p>
        <p style={styles.sub} data-prism="merge-summary">
          {plan.total} songs → {plan.tracks.length} in the new playlist
          {plan.duplicates > 0 ? ` (${plan.duplicates} duplicate${plan.duplicates === 1 ? "" : "s"} left out)` : " (no duplicates)"}.
          {plan.duplicates > 0 && (
            // Expandable list (catalogue: "Show/hide list"): a quiet button
            // that opens the list right here, under the line it explains.
            <button
              type="button"
              className="prism-quiet-button"
              style={styles.toggle}
              aria-expanded={showDuplicates}
              aria-controls="prism-merge-duplicates"
              onClick={() => setShowDuplicates(!showDuplicates)}
              data-prism="merge-duplicates-toggle"
            >
              {showDuplicates ? "▴ Hide duplicates" : "▾ Show duplicates"}
            </button>
          )}
        </p>
      </div>

      {showDuplicates && plan.duplicates > 0 && (
        <div id="prism-merge-duplicates" className="prism-glass-panel" style={styles.dupes} data-prism="merge-duplicates">
          {plan.dropped.map((d, i) => {
            const same = d.kept.uri === d.track.uri;
            return (
              <div key={i} className="prism-row" style={styles.row}>
                <span style={styles.rowText}>
                  <span style={styles.dupeName}>
                    {d.track.name} · {d.track.artists[0] ?? ""}
                  </span>
                  <span style={styles.rowSub}>in {sources[d.from].name}</span>
                </span>
                <span style={styles.status}>
                  {same
                    ? `already in ${sources[d.keptFrom].name}`
                    : `kept "${d.kept.name}" from ${sources[d.keptFrom].name}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {phase !== "done" && (
        <>
          <label style={styles.field}>
            <span style={styles.label}>Name of the new playlist</span>
            <input
              className="prism-glass-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Name of the new playlist"
              data-prism="merge-name"
              disabled={phase === "merging"}
            />
          </label>
          <label style={{ ...styles.setting, cursor: "pointer", width: "fit-content" }} data-prism="merge-rename">
            <input
              type="checkbox"
              className="prism-checkbox"
              checked={rename}
              onChange={(e) => setRename(e.target.checked)}
              disabled={phase === "merging"}
            />
            <span style={styles.label}>Rename the originals to "[merged] …"</span>
          </label>
        </>
      )}

      <div className="prism-glass-panel" style={styles.list} data-prism="merge-list">
        {sources.map((source, i) => {
          const reason = cantRenameReason(source);
          const done = result?.notRenamed.find((n) => n.name === source.name);
          let right: string;
          if (phase === "done") {
            right = result?.renamed.includes(source.name) ? `renamed to "${mergedName(source.name)}"` : done ? `not renamed: ${done.reason}` : "kept its name";
          } else if (!rename) {
            right = "keeps its name";
          } else {
            right = reason ?? `→ "${mergedName(source.name)}"`;
          }
          return (
            <div key={source.uri} className="prism-row" style={styles.row} data-prism="merge-row">
              <span style={styles.rowText}>
                <span style={styles.rowName}>{source.name}</span>
                <span style={styles.rowSub}>{lists[i].length} songs</span>
              </span>
              <span style={{ ...styles.status, ...(done && phase === "done" ? { color: "#ffb3d1" } : {}) }}>{right}</span>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="prism-notice" role="alert" style={{ fontSize: 13, margin: 0 }} data-prism="merge-error">
          {error}
        </p>
      )}

      <div className="prism-actions" style={styles.buttons}>
        {phase === "done" && result ? (
          <>
            <ButtonSecondary buttonSize="sm" onClick={() => onOpen(result.uri)} data-prism="merge-open">
              Open playlist
            </ButtonSecondary>
            <ButtonPrimary buttonSize="sm" onClick={onFinish} data-prism="merge-finish">
              Home
            </ButtonPrimary>
          </>
        ) : (
          <>
            <ButtonSecondary buttonSize="sm" onClick={onBack} disabled={phase === "merging"} data-prism="merge-back">
              Back
            </ButtonSecondary>
            <ButtonPrimary
              buttonSize="sm"
              onClick={start}
              disabled={phase === "merging" || !cleanName || plan.tracks.length === 0}
              data-prism="merge-go"
            >
              Merge
            </ButtonPrimary>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { margin: "0 0 12px" },
  screen: { display: "flex", flexDirection: "column", gap: 12, height: SCREEN_HEIGHT },
  centered: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, height: SCREEN_HEIGHT },
  text: { color: "var(--spice-text)", margin: 0 },
  sub: { margin: "2px 0 0", color: "var(--spice-subtext)", fontSize: 13 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  setting: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  label: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600 },
  list: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", padding: "4px 6px" },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "8px" },
  rowText: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  rowName: { color: "#ffffff", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowSub: { color: "var(--spice-subtext)", fontSize: 12 },
  toggle: { marginLeft: 8, fontSize: 13 },
  // At most ~4 rows tall; longer lists scroll inside, so the buttons stay put.
  dupes: { flexShrink: 0, maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", padding: "4px 6px" },
  dupeName: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  status: { color: "var(--spice-subtext)", fontSize: 12, fontWeight: 600, textAlign: "right", maxWidth: "50%" },
  buttons: { display: "flex", justifyContent: "space-between", gap: 8 },
};
