// Organize, "Start from scratch" (step 13c-2): the user makes their own
// groups. Layout "B" (picked by the developer): the groups as a list on the
// left; on the right, the picked group's name and the genres and moods to
// choose from (only ones that occur in the scanned songs, with song counts).
// "Sort songs" then puts every song into its best group (pure logic in
// src/organize/customGroups.ts) and shows the usual album-cover cards.

import React from "react";
import type { ScannedSong } from "../scan/scan";
import {
  MAX_CUSTOM_GROUPS,
  MIN_CUSTOM_GROUPS,
  addCustomGroup,
  checkCustomGroups,
  labelChoices,
  matchCount,
  removeCustomGroup,
  renameCustomGroup,
  toggleLabel,
  type CustomGroup,
  type LabelChoice,
  type LabelKind,
} from "../organize/customGroups";
import { tagColour } from "./tagLabels";

// Genres shown before anything is typed in the search box: the most common
// ones that at least 2 songs share (a library can have hundreds of tags).
const TOP_GENRES = 36;

export interface GroupBuilderProps {
  songs: ScannedSong[];
  groups: CustomGroup[];
  setGroups: (update: (groups: CustomGroup[]) => CustomGroup[]) => void;
  intro: React.ReactNode;
  onSort: () => void; // only called when checkCustomGroups found nothing missing
  onUseSuggestions?: () => void; // not offered when making just one playlist
}

export function GroupBuilder({ songs, groups, setGroups, intro, onSort, onUseSuggestions }: GroupBuilderProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [activeId, setActiveId] = React.useState(groups[0]?.id ?? "");
  const [query, setQuery] = React.useState("");
  const [problem, setProblem] = React.useState<string | null>(null);
  // Counting labels goes through every song: do it once, not on every click.
  const choices = React.useMemo(() => labelChoices(songs), [songs]);
  const active = groups.find((g) => g.id === activeId) ?? groups[0];

  // Any change clears the "what's missing" message.
  const edit = (update: (gs: CustomGroup[]) => CustomGroup[]) => {
    setGroups(update);
    setProblem(null);
  };
  const sort = () => {
    const missing = checkCustomGroups(groups);
    if (missing) setProblem(missing);
    else onSort();
  };
  const add = () => {
    const next = addCustomGroup(groups);
    edit(() => next);
    setActiveId(next[next.length - 1].id);
  };

  // Genres to show: what the search matches (or the top ones), plus the ones
  // this group already has, so a picked genre never disappears from view.
  const q = query.trim().toLowerCase();
  const shownGenres = q
    ? choices.genres.filter((g) => g.name.includes(q)).slice(0, 60)
    : choices.genres.filter((g) => g.songs >= 2).slice(0, TOP_GENRES);
  const extra = active ? choices.genres.filter((g) => active.genres.includes(g.name) && !shownGenres.includes(g)) : [];

  return (
    <div style={styles.screen} data-prism-state="organize-builder">
      <p style={styles.sub}>{intro}</p>
      <div style={styles.columns}>
        {/* Left: the groups. Click one to edit it on the right. */}
        <div style={styles.list} data-prism="builder-groups">
          {groups.map((g) => (
            <div key={g.id} style={styles.listRow}>
              <button
                type="button"
                className={`prism-glass-panel prism-builder-group${g.id === active?.id ? " on" : ""}`}
                style={styles.groupButton}
                aria-pressed={g.id === active?.id}
                onClick={() => setActiveId(g.id)}
                data-prism="builder-group"
              >
                <span style={styles.groupName}>{g.name}</span>
                <span style={styles.groupLine}>
                  {g.genres.length + g.moods.length} label{g.genres.length + g.moods.length === 1 ? "" : "s"} · ≈{" "}
                  {matchCount(songs, g)} songs
                </span>
              </button>
              {groups.length > MIN_CUSTOM_GROUPS && (
                <button
                  type="button"
                  className="prism-icon-button"
                  aria-label={`Remove the group ${g.name}`}
                  title="Remove this group"
                  onClick={() => {
                    edit((gs) => removeCustomGroup(gs, g.id));
                    if (g.id === active?.id) setActiveId(groups.find((o) => o.id !== g.id)!.id);
                  }}
                  data-prism="builder-remove-group"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {groups.length < MAX_CUSTOM_GROUPS && (
            <button type="button" className="prism-menu-button" style={styles.addButton} onClick={add} data-prism="builder-add-group">
              <span>+ Add group</span>
            </button>
          )}
        </div>

        {/* Right: the picked group's name, genres and moods. */}
        {active && (
          <div className="prism-glass-panel" style={styles.picker} data-prism="builder-picker">
            <NameBox key={`${active.id}:${active.name}`} group={active} onRename={(name) => edit((gs) => renameCustomGroup(gs, active.id, name))} />
            <span style={styles.heading}>Genres</span>
            <input
              type="search"
              className="prism-glass-input"
              style={styles.search}
              placeholder={`Find a genre (${choices.genres.length} in these songs)`}
              aria-label="Find a genre"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-prism="builder-genre-search"
            />
            <div style={styles.chips} data-prism="builder-genres">
              {[...extra, ...shownGenres].map((c) => (
                <PickChip key={c.name} kind="genre" choice={c} on={active.genres.includes(c.name)} onToggle={() => edit((gs) => toggleLabel(gs, active.id, "genre", c.name))} />
              ))}
              {shownGenres.length === 0 && <span style={styles.groupLine}>No genre matches "{query}".</span>}
            </div>
            <span style={styles.heading}>Moods (from the lyrics)</span>
            <div style={styles.chips} data-prism="builder-moods">
              {choices.moods.map((c) => (
                <PickChip key={c.name} kind="mood" choice={c} on={active.moods.includes(c.name as any)} onToggle={() => edit((gs) => toggleLabel(gs, active.id, "mood", c.name))} />
              ))}
              {choices.moods.length === 0 && <span style={styles.groupLine}>No lyrics moods were found in these songs.</span>}
            </div>
            <span style={styles.groupLine} data-prism="builder-fit">
              ≈ <b style={{ color: "#fff" }}>{matchCount(songs, active)}</b> songs have one of these. A song that fits several groups
              goes where it fits best; songs that fit none go to the closest group by mood and tempo.
            </span>
          </div>
        )}
      </div>

      {problem && (
        <p className="prism-notice" role="alert" style={{ fontSize: 13, margin: 0 }} data-prism="builder-problem">
          {problem}
        </p>
      )}
      <div className="prism-actions" style={styles.buttons}>
        {onUseSuggestions && (
          <ButtonSecondary buttonSize="sm" onClick={onUseSuggestions} data-prism="builder-use-suggestions">
            Use suggestions
          </ButtonSecondary>
        )}
        <ButtonPrimary buttonSize="sm" onClick={sort} data-prism="builder-sort">
          Sort songs
        </ButtonPrimary>
      </div>
    </div>
  );
}

// The group's name box. Saved when it loses focus or on Enter; a blank name
// goes back to the automatic one (named after the labels).
function NameBox({ group, onRename }: { group: CustomGroup; onRename: (name: string) => void }) {
  const [name, setName] = React.useState(group.name);
  return (
    <input
      className="prism-glass-input"
      style={styles.nameInput}
      value={name}
      maxLength={100}
      aria-label="Group name (the new playlist's name)"
      onChange={(e) => setName(e.target.value)}
      onBlur={(e) => e.currentTarget.value !== group.name && onRename(e.currentTarget.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      data-prism="builder-name-input"
    />
  );
}

// A genre/mood label you can turn on and off: the same frosted label with a
// colour dot as everywhere else, as a button. Moods have a dashed edge so
// they're easy to tell from genres. The faint number = songs with it.
function PickChip({ kind, choice, on, onToggle }: { kind: LabelKind; choice: LabelChoice; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`prism-tag prism-tag-pick${on ? " shared" : ""}${kind === "mood" ? " mood" : ""}`}
      style={{ ["--tag" as any]: tagColour(choice.name) }}
      aria-pressed={on}
      onClick={onToggle}
      data-prism={`pick-${kind}`}
      data-label={choice.name}
    >
      <span className="prism-tag-text">{choice.name}</span>
      <span className="prism-tag-count">{choice.songs}</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: { display: "flex", flexDirection: "column", gap: 12, height: 560 },
  sub: { margin: 0, color: "var(--spice-subtext)", fontSize: 13 },
  columns: { flex: 1, minHeight: 0, display: "flex", gap: 12 },
  list: { width: 210, flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 },
  listRow: { display: "flex", alignItems: "center", gap: 6 },
  groupButton: {
    flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "8px 11px",
    textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit",
  },
  groupName: { color: "#ffffff", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" },
  groupLine: { color: "var(--spice-subtext)", fontSize: 12 },
  addButton: { alignSelf: "flex-start", marginTop: 2 },
  picker: { flex: 1, minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px" },
  nameInput: { fontSize: 18, fontWeight: 600, padding: "6px 12px" },
  heading: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600, marginTop: 4 },
  search: { fontSize: 13, padding: "6px 12px" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
};
