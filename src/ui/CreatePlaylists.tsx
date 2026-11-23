// Organize, step 13d: confirm, then create the new playlists. Layout "B"
// (picked by the developer): a screen of its own listing every playlist that
// will be made; "Create playlists" makes them one by one (each row shows its
// progress), and the screen then becomes the "done" list with Open buttons.
//
// The writing itself: src/organize/createPlaylists.ts (createAll, pure)
// calls `create`, which is flow.ts's createOrganizedPlaylist, which writes
// only through src/spotify/write.ts. Existing playlists are never changed.

import React from "react";
import type { ScannedSong } from "../scan/scan";
import type { EditableGroup } from "../organize/editGroups";
import { createAll, planPlaylists, NAME_PREFIX, type CreateOutcome, type CreateStatus } from "../organize/createPlaylists";
import { summarize } from "../organize/grouping";
import { CoverMosaic } from "./CoverMosaic";

export interface CreateChoice {
  name: string;
  songs: ScannedSong[];
  labels: string[];
  from: string[];
}

export interface CreatePlaylistsProps {
  groups: EditableGroup[];
  songsOf: (group: EditableGroup) => ScannedSong[];
  labelsOf: (group: EditableGroup) => string[]; // "built from" for the stats page
  sourceNames: string[]; // the playlists being organized
  leftOut: number; // songs removed from every group (not added anywhere)
  create: (choice: CreateChoice) => Promise<string>;
  describeError: (error: unknown) => string;
  onBack: () => void; // to the group cards (only before creating)
  onOpen: (uri: string) => void;
  onFinish: () => void; // to the start page
}

type Phase = "confirm" | "creating" | "done";

export function CreatePlaylists(props: CreatePlaylistsProps) {
  const { groups, songsOf, labelsOf, sourceNames, leftOut, create, describeError, onBack, onOpen, onFinish } = props;
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [prefix, setPrefix] = React.useState(true);
  const [phase, setPhase] = React.useState<Phase>("confirm");
  const [status, setStatus] = React.useState<Record<string, CreateStatus>>({});
  const [outcome, setOutcome] = React.useState<CreateOutcome | null>(null);
  const { planned, skipped } = planPlaylists(groups, prefix);
  const byId = new Map(groups.map((g) => [g.id, g]));
  const songCount = new Set(planned.reduce<string[]>((all, p) => all.concat(p.songs), [])).size;

  const start = async () => {
    setPhase("creating");
    // Every row starts as "waiting". (A loop, not Object.fromEntries: this
    // project's TypeScript settings don't include that newer function.)
    const waiting: Record<string, CreateStatus> = {};
    planned.forEach((p) => (waiting[p.groupId] = "waiting"));
    setStatus(waiting);
    const result = await createAll(
      planned,
      (p) => {
        const group = byId.get(p.groupId)!;
        return create({ name: p.name, songs: songsOf(group), labels: labelsOf(group), from: sourceNames });
      },
      // Functional update (s => ...): each step builds on the latest state,
      // even when two updates arrive before React redraws.
      (id, st) => setStatus((s) => ({ ...s, [id]: st }))
    );
    setOutcome(result);
    setPhase("done");
    if (result.created.length) {
      Spicetify.showNotification?.(`Created ${result.created.length} playlist${result.created.length === 1 ? "" : "s"}`);
    }
  };

  const uriOf = (groupId: string) => outcome?.created.find((c) => c.groupId === groupId)?.uri;
  const n = planned.length;

  return (
    <div style={styles.screen} data-prism-state={`organize-create-${phase}`}>
      <div>
        <p style={styles.title} data-prism="create-title">
          {phase === "confirm"
            ? `Ready to create ${n} playlist${n === 1 ? "" : "s"}`
            : phase === "creating"
              ? `Creating ${n} playlist${n === 1 ? "" : "s"}…`
              : outcome?.failed
                ? `${outcome.created.length} of ${n} playlists created`
                : `${n} playlist${n === 1 ? "" : "s"} created`}
        </p>
        <p style={styles.sub}>
          {songCount} songs from {sourceNames.join(", ")}. Your existing playlists stay exactly as they are.
          {phase === "confirm" && " New playlists appear at the top of Your Library (Spotify may make them private)."}
        </p>
      </div>

      {phase === "confirm" && (
        <div style={styles.setting}>
          <span style={styles.settingLabel} id="prism-prefix-label">
            Start names with "{NAME_PREFIX.trim()}"
          </span>
          <div className="prism-seg" role="group" aria-labelledby="prism-prefix-label">
            <button type="button" className={prefix ? "on" : ""} aria-pressed={prefix} onClick={() => setPrefix(true)} data-prism="prefix-on">
              On
            </button>
            <button type="button" className={!prefix ? "on" : ""} aria-pressed={!prefix} onClick={() => setPrefix(false)} data-prism="prefix-off">
              Off
            </button>
          </div>
        </div>
      )}

      <div className="prism-glass-panel" style={styles.list} data-prism="create-list">
        {planned.map((p) => {
          const group = byId.get(p.groupId)!;
          const groupSongs = songsOf(group);
          const st = status[p.groupId];
          const uri = uriOf(p.groupId);
          return (
            <div key={p.groupId} style={styles.row} data-prism="create-row" data-status={st ?? "ready"}>
              <CoverMosaic songs={groupSongs} summary={summarize(groupSongs)} size={44} />
              <span style={styles.rowText}>
                <span style={styles.rowName} data-prism="create-name">
                  {p.name}
                </span>
                <span style={styles.rowSub}>{p.songs.length} songs</span>
              </span>
              {uri ? (
                <ButtonSecondary buttonSize="sm" onClick={() => onOpen(uri)} data-prism="create-open">
                  Open
                </ButtonSecondary>
              ) : (
                <span style={{ ...styles.status, ...(st ? statusStyle[st] : {}) }} aria-live="polite">
                  {st === "waiting" ? "waiting" : st === "creating" ? "adding songs…" : st === "failed" ? "✕ failed" : "ready"}
                </span>
              )}
            </div>
          );
        })}
        {n === 0 && <p style={styles.sub}>Every group is empty, so there's nothing to create.</p>}
      </div>

      {phase === "confirm" && (skipped.length > 0 || leftOut > 0) && (
        <p style={styles.sub} data-prism="create-skipped">
          {skipped.length > 0 && `Skipped (no songs): ${skipped.join(", ")}. `}
          {leftOut > 0 && `${leftOut} song${leftOut === 1 ? " is" : "s are"} in no group and won't be added.`}
        </p>
      )}
      {outcome?.failed && (
        <p className="prism-notice" role="alert" style={{ fontSize: 13, margin: 0 }} data-prism="create-failed">
          "{outcome.failed.name}" failed: {describeError(outcome.failed.error)}
          {outcome.notTried.length > 0 && ` Not tried (nothing was created): ${outcome.notTried.join(", ")}.`}
        </p>
      )}

      <div className="prism-actions" style={styles.buttons}>
        {phase === "confirm" && (
          <>
            <ButtonSecondary buttonSize="sm" onClick={onBack} data-prism="create-back">
              Back
            </ButtonSecondary>
            <ButtonPrimary buttonSize="sm" onClick={start} disabled={n === 0} data-prism="create-go">
              {n === 1 ? "Create playlist" : "Create playlists"}
            </ButtonPrimary>
          </>
        )}
        {phase === "done" && (
          <span style={{ flex: 1 }} />
        )}
        {phase === "done" && (
          <ButtonPrimary buttonSize="sm" onClick={onFinish} data-prism="create-finish">
            Start page
          </ButtonPrimary>
        )}
      </div>
    </div>
  );
}

const statusStyle: Record<CreateStatus, React.CSSProperties> = {
  waiting: {},
  creating: { color: "#cdb8ff" },
  created: { color: "#9ff0c4" },
  failed: { color: "#ffb3c7" },
};

const styles: Record<string, React.CSSProperties> = {
  screen: { display: "flex", flexDirection: "column", gap: 12, height: 560 },
  title: { margin: 0, color: "#ffffff", fontSize: 18, fontWeight: 700 },
  sub: { margin: "2px 0 0", color: "var(--spice-subtext)", fontSize: 13 },
  setting: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  settingLabel: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600 },
  list: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", padding: "4px 14px" },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" },
  rowText: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  rowName: { color: "#ffffff", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowSub: { color: "var(--spice-subtext)", fontSize: 12 },
  status: { color: "var(--spice-subtext)", fontSize: 12, fontWeight: 600, minWidth: 90, textAlign: "right" },
  buttons: { display: "flex", justifyContent: "space-between", gap: 8 },
};
