// Remix's settings (how many playlists, "Group mostly by", overlap). They used
// to sit under the playlist picker, before anything was scanned. Since the
// "two doors" flow (2026-11-23) they live on the review screen under
// "More options", next to the groups they change, and changing one sorts the
// songs again straight away.

import React from "react";
import type { GroupFocus } from "../organize/grouping";

// How many new playlists: a number, or "auto" (Prism decides, step 13b).
// No 1 here: one playlist is the "I'll pick the vibes" door with one group.
export type GroupCount = number | "auto";
export const GROUP_COUNTS: GroupCount[] = ["auto", 2, 3, 4, 5, 6, 8];

export interface OrganizeSettings {
  count: GroupCount;
  overlap: boolean; // may a song go into more than one new playlist?
  focus: GroupFocus; // "Group mostly by"
}

export const DEFAULT_SETTINGS: OrganizeSettings = { count: "auto", overlap: false, focus: "balanced" };

const FOCUS_CHOICES: [GroupFocus, string][] = [
  ["balanced", "Balanced"],
  ["genre", "Genre"],
  ["mood", "Mood"],
  ["energy", "Energy"],
];

export interface RemixOptionsProps {
  settings: OrganizeSettings;
  onChange: (next: OrganizeSettings) => void;
  showCount: boolean; // only Prism's own groups have a count (your groups: as many as you made)
}

export function RemixOptions({ settings, onChange, showCount }: RemixOptionsProps) {
  // One row = a label and a "segmented control": a row of buttons where one
  // is chosen. aria-pressed tells screen readers which one.
  const row = <T,>(id: string, label: string, choices: [T, string][], current: T, pick: (value: T) => void, testId: (value: T) => string) => (
    <div style={styles.setting}>
      <span style={styles.settingLabel} id={`prism-${id}-label`}>
        {label}
      </span>
      <div className="prism-seg" role="group" aria-labelledby={`prism-${id}-label`}>
        {choices.map(([value, text]) => (
          <button
            key={String(value)}
            type="button"
            className={current === value ? "on" : ""}
            aria-pressed={current === value}
            onClick={() => current !== value && pick(value)}
            data-prism={testId(value)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="prism-glass-panel" style={styles.panel} data-prism="organize-settings">
      {showCount &&
        row<GroupCount>(
          "count",
          "How many",
          GROUP_COUNTS.map((c) => [c, c === "auto" ? "Auto" : String(c)]),
          settings.count,
          (count) => onChange({ ...settings, count }),
          (c) => `count-${c}`
        )}
      {row<GroupFocus>("focus", "Group mostly by", FOCUS_CHOICES, settings.focus, (focus) => onChange({ ...settings, focus }), (f) => `focus-${f}`)}
      {row<boolean>(
        "overlap",
        "A song in more than one?",
        [
          [false, "One each"],
          [true, "Allow overlap"],
        ],
        settings.overlap,
        (overlap) => onChange({ ...settings, overlap }),
        (o) => (o ? "overlap-on" : "overlap-off")
      )}
      <span style={styles.note}>Changing these sorts the songs again, so edits to the groups are undone.</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { display: "flex", flexWrap: "wrap", gap: "10px 24px", padding: "12px 14px" },
  setting: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  settingLabel: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600 },
  note: { color: "var(--spice-subtext)", fontSize: 12, width: "100%" },
};
