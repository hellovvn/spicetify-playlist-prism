// Remix into moods (step 13, "Organize playlists" in the code): pick several
// playlists and sort ALL their songs into new playlists by genre and mood.
// Your playlists are only READ.
//
// Screens ("two doors" flow, mockup A, 2026-11-23):
//   setup    the SAME playlist picker as the Prism flow, and nothing else
//   scan     the same scan screen as the Prism flow (tags, BPM/key, mood)
//   choose   ONE question, two big cards: "Sort them for me" (Prism suggests
//            the groups) or "I'll pick the vibes" (you pick genres/moods per
//            group; one group = one playlist)
//   groups   the album-cover cards (src/ui/GroupReview.tsx): edit, "More
//            options" (how many / group mostly by / overlap), "Not included"

import React from "react";
import type { SourceOption } from "../sources/sources";
import { summarize } from "../scan/scan";
import { groupSongs, type GroupFocus } from "../organize/grouping";
import { GroupReview, type GroupReviewProps, type RemixMode } from "./GroupReview";
import { DEFAULT_SETTINGS, type OrganizeSettings } from "./RemixOptions";
import { SourcePicker } from "./SourcePicker";
import { ScanScreen, type ScanOutcome, type ScanScreenProps } from "./ScanScreen";
import { SCREEN_HEIGHT } from "./styles";

export type { GroupCount, OrganizeSettings } from "./RemixOptions";

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
  const [screen, setScreen] = React.useState<"setup" | "scan" | "choose" | "groups">("setup");
  // Kept here (not in the screens) so going Back keeps the user's choices.
  const [selected, setSelected] = React.useState<string[]>([]);
  const [picked, setPicked] = React.useState<SourceOption[]>([]);
  const [settings, setSettings] = React.useState<OrganizeSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = React.useState<RemixMode | null>(null);
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
        intro="Pick the playlists to remix. Prism sorts their songs into new playlists by genre and mood. Your playlists are never changed."
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
          setScreen("choose");
        }}
        nextLabel="Next"
      />
    );
  } else if (screen === "choose") {
    body = (
      <ChooseMode
        songCount={scan?.songs.length ?? 0}
        mode={mode}
        setMode={setMode}
        onBack={() => setScreen("setup")}
        onNext={() => setScreen("groups")}
      />
    );
  } else {
    body = (
      <Groups
        scan={scan}
        sources={picked}
        mode={mode ?? "auto"}
        settings={settings}
        setSettings={setSettings}
        onBack={() => setScreen("choose")}
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
      <h2 className="prism-screen-title" style={styles.title}>Remix into moods</h2>
      {body}
    </div>
  );
}

// ----- The two doors: how do you want to remix? -----

const DOORS: { mode: RemixMode; title: string; text: string; icon: React.ReactNode }[] = [
  {
    mode: "auto",
    title: "Sort them for me",
    text: "Prism finds the groups by genre, mood and tempo. You can rename them, move songs and combine groups after.",
    icon: (
      // A big sparkle and a small one.
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z" />
        <path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z" />
      </svg>
    ),
  },
  {
    mode: "me",
    title: "I'll pick the vibes",
    text: "Choose the genres and moods for each new playlist. Make just one playlist, or several.",
    icon: (
      // Three sliders.
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M5 4v16M12 4v16M19 4v16" />
        <circle cx="5" cy="15" r="2.2" fill="#2a1d55" />
        <circle cx="12" cy="8" r="2.2" fill="#2a1d55" />
        <circle cx="19" cy="13" r="2.2" fill="#2a1d55" />
      </svg>
    ),
  },
];

function ChooseMode({
  songCount,
  mode,
  setMode,
  onBack,
  onNext,
}: {
  songCount: number;
  mode: RemixMode | null;
  setMode: (mode: RemixMode) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  return (
    <div style={styles.screen} data-prism-state="organize-choose">
      <p style={styles.question}>How do you want to remix {songCount} songs?</p>
      {/* role="radiogroup": two choices, one picked (arrow keys aren't wired,
          Tab + Space/Enter works like any button). */}
      <div style={styles.doors} role="radiogroup" aria-label="How to remix">
        {DOORS.map((door) => (
          <button
            key={door.mode}
            type="button"
            role="radio"
            aria-checked={mode === door.mode}
            className={`prism-glass-panel prism-door${mode === door.mode ? " on" : ""}`}
            style={styles.door}
            onClick={() => setMode(door.mode)}
            onDoubleClick={onNext}
            data-prism={`mode-${door.mode}`}
          >
            <span style={styles.doorIcon}>{door.icon}</span>
            <span style={styles.doorTitle}>{door.title}</span>
            <span style={styles.doorText}>{door.text}</span>
          </button>
        ))}
      </div>
      <span style={styles.middle} />
      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack}>
          Back
        </ButtonSecondary>
        <span style={{ flex: 1 }} />
        {/* Next only once a door is picked (Spotify's button has no
            "disabled" look we can rely on, so it's simply not shown). */}
        {mode && (
          <ButtonPrimary buttonSize="sm" onClick={onNext} data-prism="choose-next">
            Next
          </ButtonPrimary>
        )}
      </div>
    </div>
  );
}

// ----- The groups screen -----

const FOCUS_WORDS: Record<GroupFocus, string> = {
  balanced: "genre, mood and tempo together",
  genre: "mostly genre",
  mood: "mostly mood",
  energy: "mostly energy (tempo)",
};

function Groups({
  scan,
  sources,
  mode,
  settings,
  setSettings,
  onBack,
  ...creating
}: {
  scan: ScanOutcome | null;
  sources: SourceOption[];
  mode: RemixMode;
  settings: OrganizeSettings;
  setSettings: (s: OrganizeSettings) => void;
  onBack: () => void;
} & Pick<GroupReviewProps, "create" | "describeError" | "onOpenPlaylist" | "onFinish">) {
  const songs = scan?.songs ?? [];
  const s = summarize(songs);
  // useMemo: group once, not again on every re-render (it's real work). Only
  // the "Sort them for me" door needs Prism's suggestions.
  const grouping = React.useMemo(
    () => (mode === "auto" ? groupSongs(songs, { count: settings.count, overlap: settings.overlap, focus: settings.focus }) : null),
    [scan, settings, mode]
  );
  const suggested = grouping?.groups ?? [];
  const placed = suggested.reduce((n, g) => n + g.songs.length, 0);
  return (
    <GroupReview
      songs={songs}
      suggested={suggested}
      mode={mode}
      settings={settings}
      setSettings={setSettings}
      onBack={onBack}
      sourceNames={sources.map((source) => source.name)}
      {...creating}
      intro={
        <>
          {s.total} songs from {sources.length} playlist{sources.length === 1 ? "" : "s"} into{" "}
          <b style={{ color: "#fff" }}>{suggested.length} groups</b>, grouped by {FOCUS_WORDS[settings.focus]}
          {settings.overlap && placed > s.total ? ` · ${placed - s.total} songs are in more than one` : ""}.
        </>
      }
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { margin: "0 0 12px", height: 34, lineHeight: "34px" },
  screen: { display: "flex", flexDirection: "column", gap: 12, height: SCREEN_HEIGHT },
  question: { margin: "8px 0 4px", color: "#ffffff", fontSize: 16, fontWeight: 600 },
  doors: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  door: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "22px 20px", minHeight: 170,
    textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit",
  },
  doorIcon: { color: "#f4c0d1", display: "flex" },
  doorTitle: { color: "#ffffff", fontSize: 16, fontWeight: 700 },
  doorText: { color: "var(--spice-subtext)", fontSize: 13, lineHeight: 1.5 },
  middle: { flex: 1 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
};
