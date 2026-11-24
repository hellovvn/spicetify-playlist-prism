// Organize's review screen (step 13c): the suggested groups as album-cover
// cards. Click a card to open it: rename it, move or remove songs, or merge
// it into another group. Or "Start from scratch" (13c-2): make your own
// groups in the builder (GroupBuilder.tsx), and the sorted result shows as
// the same cards. "Create playlists" (13d) opens the confirm screen
// (CreatePlaylists.tsx), the only place that creates anything.
//
// The groups are kept as EditableGroup state (src/organize/editGroups.ts:
// pure functions that return new groups), and each group's summary is worked
// out again from its current songs, so it stays right after every edit.

import React from "react";
import type { ScannedSong } from "../scan/scan";
import { summarize, type GroupFocus, type GroupSummary, type SongGroup } from "../organize/grouping";
import { blankGroups, sortIntoGroups, type CustomGroup } from "../organize/customGroups";
import {
  editableGroups,
  mergeGroups,
  moveSong,
  removeSong,
  renameGroup,
  songsInNoGroup,
  type EditableGroup,
} from "../organize/editGroups";
import { tagColour } from "./tagLabels";
import { TagLabels } from "./GenreLabels";
import { GlassMenu } from "./GlassMenu";
import { GroupBuilder } from "./GroupBuilder";
import { CoverMosaic } from "./CoverMosaic";
import { CreatePlaylists, type CreateChoice } from "./CreatePlaylists";

export interface GroupReviewProps {
  songs: ScannedSong[]; // every scanned song (for names, covers, summaries)
  suggested: SongGroup[]; // what the grouping suggested
  settings: { count: number | "auto"; overlap: boolean; focus: GroupFocus }; // chosen in Organize's setup
  intro: React.ReactNode; // e.g. "250 songs from 2 playlists into 8 groups..."
  sourceNames: string[]; // the playlists being organized
  create: (choice: CreateChoice) => Promise<string>; // makes ONE new playlist (flow.ts)
  describeError: (error: unknown) => string;
  onOpenPlaylist: (uri: string) => void;
  onFinish: () => void; // after creating: to the start page
  onBack: () => void;
}

// What the screen shows: the suggested groups, the user's own sorted
// groups, or the "Start from scratch" builder.
type View = "suggested" | "custom" | "builder";

export function GroupReview(props: GroupReviewProps) {
  const { songs, suggested, settings, intro, onBack } = props;
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  // Two separate sets of groups, so switching between "Use suggestions" and
  // your own groups never loses the edits made to either one.
  const [suggestedGroups, setSuggestedGroups] = React.useState<EditableGroup[]>(() => editableGroups(suggested));
  const [customGroups, setCustomGroups] = React.useState<EditableGroup[]>([]);
  // The builder's groups (names + picked genres/moods), kept while you switch.
  const [specs, setSpecs] = React.useState<CustomGroup[]>(() => blankGroups(settings.count === "auto" ? 3 : settings.count));
  const [forced, setForced] = React.useState(0); // songs placed by mood/tempo only
  // The genres/moods the user picked per sorted group (by card id), shown
  // first on its card: songs placed by mood/tempo can outnumber them.
  const [pickedLabels, setPickedLabels] = React.useState<Map<string, string[]>>(new Map());
  // One playlist: suggestions would just be "every song", so go straight to
  // the builder with one group to pick genres/moods for.
  const single = settings.count === 1;
  const [view, setView] = React.useState<View>(single ? "builder" : "suggested");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false); // the confirm/create screen is showing
  const groups = view === "custom" ? customGroups : suggestedGroups;
  const setGroups = view === "custom" ? setCustomGroups : setSuggestedGroups;
  // Look songs up by URI quickly (a Map), rebuilt only when the songs change.
  const byUri = React.useMemo(() => new Map(songs.map((s) => [s.uri, s])), [songs]);
  const songsOf = (group: EditableGroup) => group.songs.map((u) => byUri.get(u)).filter((s): s is ScannedSong => !!s);
  const left = songsInNoGroup(groups, songs.map((s) => s.uri));
  const open = groups.find((g) => g.id === openId) ?? null;
  const overlap = settings.overlap ? "a song can join every group it fits well" : "each song goes into one group";

  if (view === "builder") {
    return (
      <GroupBuilder
        songs={songs}
        groups={specs}
        setGroups={setSpecs}
        intro={
          single ? (
            <>
              Pick the genres and/or moods for your playlist. Prism collects the songs among these {songs.length} that match
              (songs that don't match are left out).
            </>
          ) : (
            <>
              Make your own groups: give each one a name and pick its genres and/or moods. Then Prism sorts all{" "}
              {songs.length} songs into them ({overlap}).
              {customGroups.length > 0 && " Sorting again replaces your edits to the sorted groups."}
            </>
          )
        }
        onUseSuggestions={single ? undefined : () => setView("suggested")}
        onSort={() => {
          const result = sortIntoGroups(songs, specs, { overlap: settings.overlap, focus: settings.focus });
          const sorted = editableGroups(result.groups);
          setCustomGroups(sorted);
          setPickedLabels(new Map(sorted.map((g, i) => [g.id, [...specs[i].genres, ...specs[i].moods]])));
          setForced(result.placedByMoodTempo.length);
          setView("custom");
        }}
      />
    );
  }

  // Step 13d: confirm and create the groups now on screen.
  if (creating) {
    // "Built from" for the stats page: the labels picked for your own groups,
    // otherwise the group's most common tags.
    const labelsOf = (group: EditableGroup) =>
      (view === "custom" && pickedLabels.get(group.id)) || summarize(songsOf(group)).tags.slice(0, 3).map(([name]) => name);
    return (
      <CreatePlaylists
        groups={groups}
        songsOf={songsOf}
        labelsOf={labelsOf}
        sourceNames={props.sourceNames}
        leftOut={left.length}
        create={props.create}
        describeError={props.describeError}
        onBack={() => setCreating(false)}
        onOpen={props.onOpenPlaylist}
        onFinish={props.onFinish}
      />
    );
  }

  if (open) {
    return (
      <GroupDetail
        group={open}
        groupSongs={songsOf(open)}
        others={groups.filter((g) => g.id !== open.id)}
        onClose={() => setOpenId(null)}
        onRename={(name) => setGroups((gs) => renameGroup(gs, open.id, name))}
        onMove={(uri, toId) => setGroups((gs) => moveSong(gs, uri, open.id, toId))}
        onRemove={(uri) => setGroups((gs) => removeSong(gs, uri, open.id))}
        onMerge={(otherId) => setGroups((gs) => mergeGroups(gs, open.id, otherId))}
      />
    );
  }

  const placed = groups.reduce((n, g) => n + g.songs.length, 0);
  return (
    <div style={styles.screen} data-prism-state="organize-groups" data-prism-view={view}>
      <p style={styles.sub}>
        {view === "suggested" ? (
          intro
        ) : single ? (
          <>
            <b style={{ color: "#fff" }}>{placed}</b> of {songs.length} songs match your picks.
          </>
        ) : (
          <>
            {songs.length} songs sorted into <b style={{ color: "#fff" }}>your {groups.length} groups</b>
            {forced > 0 ? ` · ${forced} matched none of your genres/moods and went to the closest group by mood and tempo` : ""}
            {settings.overlap && placed > songs.length ? ` · ${placed - songs.length} songs are in more than one` : ""}.
          </>
        )}
      </p>
      <div style={styles.grid} data-prism="organize-group-list">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            groupSongs={songsOf(group)}
            picked={view === "custom" ? pickedLabels.get(group.id) : undefined}
            onOpen={() => setOpenId(group.id)}
          />
        ))}
      </div>
      {left.length > 0 && (
        <p style={styles.sub} data-prism="organize-left-out">
          {single
            ? `${left.length} song${left.length === 1 ? "" : "s"} didn't match, so ${left.length === 1 ? "it's" : "they're"} left out.`
            : `${left.length} song${left.length === 1 ? "" : "s"} removed from every group (won't be in any new playlist).`}
        </p>
      )}
      <p className="prism-notice" style={{ fontSize: 13 }}>
        Click a group to rename it, move or remove songs, or merge it. Nothing is created until you confirm on the
        next screen.
      </p>
      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack}>
          Back
        </ButtonSecondary>
        <span style={{ flex: 1 }} />
        {view === "custom" && !single && (
          <ButtonSecondary buttonSize="sm" onClick={() => setView("suggested")} data-prism="use-suggestions">
            Use suggestions
          </ButtonSecondary>
        )}
        <ButtonSecondary buttonSize="sm" onClick={() => setView("builder")} data-prism="start-from-scratch">
          {view === "custom" ? (single ? "Edit my picks" : "Edit my groups") : customGroups.length ? "My own groups" : "Start from scratch"}
        </ButtonSecondary>
        <ButtonPrimary buttonSize="sm" onClick={() => setCreating(true)} data-prism="open-create">
          {groups.length === 1 ? "Create playlist" : "Create playlists"}
        </ButtonPrimary>
      </div>
    </div>
  );
}

// ----- One card: cover mosaic, name, count, genres, mood/tempo line -----

interface GroupCardProps {
  group: EditableGroup;
  groupSongs: ScannedSong[];
  picked?: string[]; // your own groups: the labels you picked come first
  onOpen: () => void;
}

function GroupCard({ group, groupSongs, picked = [], onOpen }: GroupCardProps) {
  const summary = summarize(groupSongs);
  const labels = [...picked, ...summary.tags.map(([name]) => name).filter((n) => !picked.includes(n))].slice(0, 2);
  return (
    <button
      type="button"
      className="prism-glass-panel prism-group-card"
      style={styles.card}
      onClick={onOpen}
      data-prism="organize-group"
      aria-label={`${group.name}, ${group.songs.length} songs. Open to edit`}
    >
      <CoverMosaic songs={groupSongs} summary={summary} size={128} />
      <span style={styles.cardName}>{group.name}</span>
      <span style={styles.cardCount}>{group.songs.length} songs</span>
      {/* A box as wide as the card that cuts off labels that don't fit, so a
          long label can't spill over into the next card. */}
      <span style={styles.labelClip}>
        <TagLabels labels={labels.map((name) => ({ name, colour: tagColour(name), shared: true }))} />
      </span>
      <span style={styles.cardLine}>{summaryLine(summary)}</span>
    </button>
  );
}

// "love, heartbreak · 84 BPM": the group's main moods and average tempo.
function summaryLine(summary: GroupSummary): string {
  const moods = summary.moods.slice(0, 2).map(([m]) => m).join(", ");
  const bpm = summary.tempo.averageBpm !== null ? `${summary.tempo.averageBpm} BPM` : "";
  return [moods, bpm].filter(Boolean).join(" · ");
}

// ----- One group opened: rename, move/remove songs, combine -----

interface GroupDetailProps {
  group: EditableGroup;
  groupSongs: ScannedSong[];
  others: EditableGroup[];
  onClose: () => void;
  onRename: (name: string) => void;
  onMove: (uri: string, toId: string) => void;
  onRemove: (uri: string) => void;
  onMerge: (otherId: string) => void;
}

function GroupDetail({ group, groupSongs, others, onClose, onRename, onMove, onRemove, onMerge }: GroupDetailProps) {
  const { ButtonSecondary } = Spicetify.ReactComponent as any;
  const summary = summarize(groupSongs);
  const [name, setName] = React.useState(group.name);
  // "Combine with another group": which group was picked, waiting for the
  // user to confirm (null = nothing picked).
  const [combineId, setCombineId] = React.useState<string | null>(null);
  const combineWith = others.find((o) => o.id === combineId) ?? null;
  // Rename when the name box loses focus or Enter is pressed (blank = undo).
  // It reads the box's CURRENT text (not the `name` state): state updates are
  // drawn a moment later, so right after a keystroke `name` can be one behind.
  const commitName = (value: string) => {
    if (value.trim()) onRename(value);
    else setName(group.name);
  };
  const t = summary.tempo;
  return (
    <div style={styles.screen} data-prism-state="organize-group-detail">
      <div style={styles.detailHead}>
        <CoverMosaic songs={groupSongs} summary={summary} size={84} />
        <div style={styles.detailText}>
          <input
            className="prism-glass-input"
            style={styles.nameInput}
            value={name}
            maxLength={100}
            aria-label="Group name (the new playlist's name)"
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => commitName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            data-prism="group-name-input"
          />
          <span style={styles.cardLine}>
            {groupSongs.length} songs · {summaryLine(summary) || "no mood/tempo known"}
            {t.averageBpm !== null ? ` (${t.slow} slow, ${t.mid} mid, ${t.fast} fast)` : ""}
            {summary.keys.length ? ` · Keys: ${summary.keys.map(([k, n]) => `${k} ×${n}`).join(", ")}` : ""}
          </span>
          <TagLabels labels={summary.tags.slice(0, 4).map(([n]) => ({ name: n, colour: tagColour(n), shared: true }))} />
        </div>
      </div>

      {/* The songs. "Move to" moves a song straight away; x removes it. */}
      <div style={styles.songList} data-prism="group-song-list">
        {groupSongs.length === 0 && <p style={styles.sub}>No songs left in this group.</p>}
        {groupSongs.map((song) => (
          <div key={song.uri} className="prism-row is-clickable" style={styles.songRow} data-prism="group-song">
            {song.coverSmall ? <img src={song.coverSmall} alt="" style={styles.thumb} loading="lazy" /> : <span style={styles.thumb} />}
            <span style={styles.songText}>
              <span style={styles.songName}>{song.name}</span>
              <span style={styles.songArtist}>{song.artists.join(", ")}</span>
            </span>
            {others.length > 0 && (
              <GlassMenu
                label="Move to…"
                options={others.map((o) => ({ value: o.id, label: o.name }))}
                onPick={(toId) => onMove(song.uri, toId)}
                ariaLabel={`Move ${song.name} to another group`}
                dataPrism="move-menu"
              />
            )}
            <button
              type="button"
              className="prism-icon-button"
              aria-label={`Remove ${song.name} from this group`}
              title="Remove from this group"
              onClick={() => onRemove(song.uri)}
              data-prism="remove-song"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Combining asks first, saying exactly what will happen. */}
      {combineWith && (
        <div className="prism-notice" role="alert" style={styles.confirm} data-prism="combine-confirm">
          <span>
            Move all {combineWith.songs.length} songs from "{combineWith.name}" into "{group.name}"? The "
            {combineWith.name}" group will disappear.
          </span>
          <span style={styles.confirmButtons}>
            <ButtonSecondary buttonSize="sm" onClick={() => setCombineId(null)} data-prism="combine-cancel">
              Cancel
            </ButtonSecondary>
            <ButtonSecondary
              buttonSize="sm"
              onClick={() => {
                onMerge(combineWith.id);
                setCombineId(null);
              }}
              data-prism="combine-yes"
            >
              Combine
            </ButtonSecondary>
          </span>
        </div>
      )}

      <div className="prism-actions" style={styles.detailActions}>
        {/* "Back" like every other screen; it returns to the group cards.
            (The test hook keeps its old name "all-groups".) */}
        <ButtonSecondary buttonSize="sm" onClick={onClose} data-prism="all-groups">
          Back
        </ButtonSecondary>
        {others.length > 0 && (
          <GlassMenu
            label="Combine with another group…"
            options={others.map((o) => ({ value: o.id, label: `${o.name} (${o.songs.length} songs)` }))}
            onPick={setCombineId}
            ariaLabel="Combine another group into this one"
            dataPrism="combine-menu"
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: { display: "flex", flexDirection: "column", gap: 12, height: 560 },
  sub: { margin: 0, color: "var(--spice-subtext)", fontSize: 13 },
  grid: {
    flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gap: 12, paddingRight: 4,
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", alignContent: "start",
  },
  card: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, padding: 11, textAlign: "left",
    cursor: "pointer", color: "inherit", font: "inherit", minWidth: 0,
  },
  cardName: { color: "#ffffff", fontSize: 14, fontWeight: 700, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" },
  cardCount: { color: "var(--spice-subtext)", fontSize: 12 },
  cardLine: { color: "var(--spice-subtext)", fontSize: 12 },
  labelClip: { display: "block", width: "100%", overflow: "hidden" },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
  detailHead: { display: "flex", gap: 14, alignItems: "flex-start" },
  detailText: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 },
  nameInput: { fontSize: 18, fontWeight: 600, padding: "6px 12px" },
  songList: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, paddingRight: 4 },
  songRow: { display: "flex", alignItems: "center", gap: 10, padding: "5px 8px" },
  thumb: { width: 36, height: 36, borderRadius: 4, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.08)" },
  songText: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  songName: { color: "var(--spice-text)", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  songArtist: { color: "var(--spice-subtext)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  detailActions: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  confirm: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13 },
  confirmButtons: { display: "flex", gap: 8, flexShrink: 0 },
};
