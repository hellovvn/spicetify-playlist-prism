// Organize playlists (step 13): pick several playlists and split ALL their
// songs into new playlists by genre and mood. Your playlists are only READ.
//
// Screens:
//   setup    the SAME playlist picker as the Prism flow, plus Organize's own
//            settings panel: how many new playlists, overlap on/off, and
//            "Group mostly by" (Balanced / Genre / Mood / Energy)
//   scan     the same scan screen as the Prism flow (tags, BPM/key, mood)
//   groups   the suggested groups as album-cover cards you can open and
//            edit: rename, move/remove songs, merge (src/ui/GroupReview.tsx),
//            or "Start from scratch" with your own groups (GroupBuilder.tsx)

import React from "react";
import type { SourceOption } from "../sources/sources";
import { summarize } from "../scan/scan";
import { groupSongs, type GroupFocus } from "../organize/grouping";
import { GroupReview, type GroupReviewProps } from "./GroupReview";
import { SourcePicker } from "./SourcePicker";
import { ScanScreen, type ScanOutcome, type ScanScreenProps } from "./ScanScreen";
import { SCREEN_HEIGHT } from "./styles";

// How many new playlists: a number, or "auto" (Prism decides, step 13b).
export type GroupCount = number | "auto";
export const GROUP_COUNTS: GroupCount[] = [2, 3, 4, 5, 6, 8, "auto"];

export interface OrganizeSettings {
  count: GroupCount;
  overlap: boolean; // may a song go into more than one new playlist?
  focus: GroupFocus; // "Group mostly by"
}

const FOCUS_CHOICES: [GroupFocus, string][] = [
  ["balanced", "Balanced"],
  ["genre", "Genre"],
  ["mood", "Mood"],
  ["energy", "Energy"],
];

export interface OrganizeFlowProps {
  loadSources: () => Promise<SourceOption[]>;
  createPlaylist: GroupReviewProps["create"]; // flow.ts createOrganizedPlaylist (the only write)
  onOpenPlaylist: (uri: string) => void;
  runScan: ScanScreenProps["runScan"];
  describeError: (error: unknown) => string;
  onCancel: () => void; // Back on the first screen: to the start page
  onScanningChange?: (running: boolean) => void;
}

export function OrganizeFlow(props: OrganizeFlowProps) {
  const { loadSources, runScan, describeError, onCancel, onScanningChange } = props;
  const [screen, setScreen] = React.useState<"setup" | "scan" | "groups">("setup");
  // Kept here (not in the screens) so going Back keeps the user's choices.
  const [selected, setSelected] = React.useState<string[]>([]);
  const [picked, setPicked] = React.useState<SourceOption[]>([]);
  const [settings, setSettings] = React.useState<OrganizeSettings>({ count: 5, overlap: false, focus: "balanced" });
  const [scan, setScan] = React.useState<ScanOutcome | null>(null);

  let body: React.ReactNode;
  if (screen === "setup") {
    body = (
      <SourcePicker
        loadSources={loadSources}
        describeError={describeError}
        selected={selected}
        setSelected={setSelected}
        onBack={onCancel}
        onNext={(sources) => {
          setPicked(sources);
          setScreen("scan");
        }}
        intro="Pick the playlists to organize. Prism sorts all their songs into new playlists by genre and mood. Your playlists are never changed."
        extra={<SettingsPanel settings={settings} setSettings={setSettings} />}
        nextLabel="Next: scan songs"
      />
    );
  } else if (screen === "scan") {
    body = (
      <ScanScreen
        sources={picked}
        runScan={runScan}
        describeError={describeError}
        onRunningChange={onScanningChange}
        onBack={() => setScreen("setup")}
        onNext={(outcome) => {
          setScan(outcome);
          setScreen("groups");
        }}
        nextLabel="Next: group songs"
      />
    );
  } else {
    body = (
      <Groups
        scan={scan}
        sources={picked}
        settings={settings}
        onBack={() => setScreen("setup")}
        create={props.createPlaylist}
        describeError={describeError}
        onOpenPlaylist={props.onOpenPlaylist}
        onFinish={onCancel}
      />
    );
  }

  return (
    // key on the screen: each screen fades in when it appears.
    <div key={screen} className="prism-fade-in" data-prism="organize" data-prism-organize={screen}>
      <h2 style={styles.title}>Organize playlists</h2>
      {body}
    </div>
  );
}

// ----- The settings panel under the playlist list -----

function SettingsPanel({ settings, setSettings }: { settings: OrganizeSettings; setSettings: (s: OrganizeSettings) => void }) {
  return (
    <div className="prism-glass-panel" style={styles.panel} data-prism="organize-settings">
      <div style={styles.setting}>
        <span style={styles.settingLabel} id="prism-count-label">
          New playlists
        </span>
        {/* A "segmented control": a row of buttons where one is chosen.
            aria-pressed tells screen readers which one. */}
        <div className="prism-seg" role="group" aria-labelledby="prism-count-label">
          {GROUP_COUNTS.map((count) => (
            <button
              key={String(count)}
              type="button"
              className={settings.count === count ? "on" : ""}
              aria-pressed={settings.count === count}
              onClick={() => setSettings({ ...settings, count })}
              data-prism={`count-${count}`}
            >
              {count === "auto" ? "Auto" : count}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.setting}>
        <span style={styles.settingLabel} id="prism-overlap-label">
          A song in more than one?
        </span>
        <div className="prism-seg" role="group" aria-labelledby="prism-overlap-label">
          <button
            type="button"
            className={!settings.overlap ? "on" : ""}
            aria-pressed={!settings.overlap}
            onClick={() => setSettings({ ...settings, overlap: false })}
            data-prism="overlap-off"
          >
            One each
          </button>
          <button
            type="button"
            className={settings.overlap ? "on" : ""}
            aria-pressed={settings.overlap}
            onClick={() => setSettings({ ...settings, overlap: true })}
            data-prism="overlap-on"
          >
            Allow overlap
          </button>
        </div>
      </div>
      <div style={styles.setting}>
        <span style={styles.settingLabel} id="prism-focus-label">
          Group mostly by
        </span>
        <div className="prism-seg" role="group" aria-labelledby="prism-focus-label">
          {FOCUS_CHOICES.map(([focus, label]) => (
            <button
              key={focus}
              type="button"
              className={settings.focus === focus ? "on" : ""}
              aria-pressed={settings.focus === focus}
              onClick={() => setSettings({ ...settings, focus })}
              data-prism={`focus-${focus}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- The suggested groups (13b) -----

const FOCUS_WORDS: Record<GroupFocus, string> = {
  balanced: "genre, mood and tempo together",
  genre: "mostly genre",
  mood: "mostly mood",
  energy: "mostly energy (tempo)",
};

function Groups({
  scan,
  sources,
  settings,
  onBack,
  ...creating
}: {
  scan: ScanOutcome | null;
  sources: SourceOption[];
  settings: OrganizeSettings;
  onBack: () => void;
} & Pick<GroupReviewProps, "create" | "describeError" | "onOpenPlaylist" | "onFinish">) {
  const songs = scan?.songs ?? [];
  const s = summarize(songs);
  // useMemo: group once, not again on every re-render (it's real work).
  const grouping = React.useMemo(
    () => groupSongs(songs, { count: settings.count, overlap: settings.overlap, focus: settings.focus }),
    [scan, settings]
  );
  const placed = grouping.groups.reduce((n, g) => n + g.songs.length, 0);
  // The album-cover cards and editing live in GroupReview (step 13c).
  return (
    <GroupReview
      songs={songs}
      suggested={grouping.groups}
      settings={settings}
      onBack={onBack}
      sourceNames={sources.map((source) => source.name)}
      {...creating}
      intro={
        <>
          {s.total} songs from {sources.length} playlist{sources.length === 1 ? "" : "s"} into{" "}
          <b style={{ color: "#fff" }}>{grouping.groups.length} groups</b>, grouped by {FOCUS_WORDS[settings.focus]}
          {settings.overlap && placed > s.total ? ` · ${placed - s.total} songs are in more than one` : ""}.
        </>
      }
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    margin: "0 0 12px", height: 34, lineHeight: "34px", fontSize: 22, fontWeight: 300, letterSpacing: "0.02em", color: "#ffffff",
    fontFamily: '"Segoe UI Variable Display", "Segoe UI", sans-serif',
  },
  panel: { display: "flex", flexWrap: "wrap", gap: "10px 24px", padding: "12px 14px" },
  setting: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  settingLabel: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600 },
  screen: { display: "flex", flexDirection: "column", gap: 12, height: SCREEN_HEIGHT },
  sub: { margin: 0, color: "var(--spice-subtext)", fontSize: 13 },
  middle: { flex: 1 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
};
