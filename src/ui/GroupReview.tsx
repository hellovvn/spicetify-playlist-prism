// Remix's review screen (step 13c): the groups as album-cover cards. Click a
// card to open it: rename it, move or remove songs, or combine it with
// another group. "Create playlists" (13d) opens the confirm screen
// (CreatePlaylists.tsx), the only place that creates anything.
//
// "Two doors" flow (2026-11-23): the door picked before this screen decides
// where the groups come from, and there's no switching between the two here:
//   "auto"  Prism's suggestions. "More options" changes how many / group
//           mostly by / overlap, and the songs are grouped again at once.
//   "me"    the builder (GroupBuilder.tsx) first: pick genres/moods per
//           group, then "Sort songs" shows the result as the same cards.
//           One group = one playlist, and songs that match none of its picks
//           are left out.
// Songs that end up in no group ("Not included": left out, or taken out by
// you) get their own dashed card. Open it to see each one and why, and add
// any of them back.
//
// The groups are kept as EditableGroup state (src/organize/editGroups.ts:
// pure functions that return new groups), and each group's summary is worked
// out again from its current songs, so it stays right after every edit.

import React from "react";
import type { ScannedSong } from "../scan/scan";
import { closestByMoodAndTempo, summarize, type GroupSummary, type SongGroup } from "../organize/grouping";
import { blankGroups, sortIntoGroups, type CustomGroup } from "../organize/customGroups";
import {
  addSongs,
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
import { RemixOptions, type OrganizeSettings } from "./RemixOptions";

// Which door was picked: Prism sorts ("auto") or you pick the vibes ("me").
export type RemixMode = "auto" | "me";

export interface GroupReviewProps {
  songs: ScannedSong[]; // every scanned song (for names, covers, summaries)
  suggested: SongGroup[]; // what the grouping suggested ("auto" only)
  mode: RemixMode;
  settings: OrganizeSettings;
  setSettings: (next: OrganizeSettings) => void; // "More options"
  intro: React.ReactNode; // e.g. "250 songs from 2 playlists into 8 groups..."
  sourceNames: string[]; // the playlists being remixed
  create: (choice: CreateChoice) => Promise<string>; // makes ONE new playlist (flow.ts)
  describeError: (error: unknown) => string;
  onOpenPlaylist: (uri: string) => void;
  onFinish: () => void; // after creating: to the start page
  onBack: () => void; // to the two doors
}

// What the screen shows: the builder ("me" only), the group cards, or the
// "Not included" songs.
type View = "builder" | "cards" | "left";

export function GroupReview(props: GroupReviewProps) {
  const { songs, suggested, mode, settings, intro, onBack } = props;
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const mine = mode === "me";
  const [groups, setGroups] = React.useState<EditableGroup[]>(() => (mine ? [] : editableGroups(suggested)));
  // The builder's groups (names + picked genres/moods). Starts with ONE:
  // "+ Add group" makes more.
  const [specs, setSpecs] = React.useState<CustomGroup[]>(() => blankGroups(1));
  const [forced, setForced] = React.useState(0); // songs placed by mood/tempo only
  // The genres/moods the user picked per sorted group (by card id), shown
  // first on its card: songs placed by mood/tempo can outnumber them.
  const [pickedLabels, setPickedLabels] = React.useState<Map<string, string[]>>(new Map());
  const [view, setView] = React.useState<View>(mine ? "builder" : "cards");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false); // the confirm/create screen is showing
  const [moreOpen, setMoreOpen] = React.useState(false); // "More options" panel
  // Songs the user took out of their last group by hand, so "Not included"
  // can say why each song is there.
  const [removed, setRemoved] = React.useState<Set<string>>(() => new Set());

  // "Sort them for me": new suggestions (a More options change) replace the
  // groups. useEffect runs after drawing, whenever `suggested` is a new list.
  React.useEffect(() => {
    if (mine) return;
    setGroups(editableGroups(suggested));
    setRemoved(new Set());
    setOpenId(null);
  }, [suggested, mine]);

  // Look songs up by URI quickly (a Map), rebuilt only when the songs change.
  const byUri = React.useMemo(() => new Map(songs.map((s) => [s.uri, s])), [songs]);
  const songsOf = (group: EditableGroup) => group.songs.map((u) => byUri.get(u)).filter((s): s is ScannedSong => !!s);
  const left = songsInNoGroup(groups, songs.map((s) => s.uri));
  const leftSongs = left.map((u) => byUri.get(u)).filter((s): s is ScannedSong => !!s);
  const open = groups.find((g) => g.id === openId) ?? null;
  const single = mine && groups.length === 1; // your one playlist
  const overlap = settings.overlap ? "a song can join every group it fits well" : "each song goes into one group";

  // "I'll pick the vibes": sort every song into the builder's groups.
  const sortNow = (using: OrganizeSettings) => {
    const result = sortIntoGroups(songs, specs, { overlap: using.overlap, focus: using.focus });
    const sorted = editableGroups(result.groups);
    setGroups(sorted);
    setPickedLabels(new Map(sorted.map((g, i) => [g.id, [...specs[i].genres, ...specs[i].moods]])));
    setForced(result.placedByMoodTempo.length);
    setRemoved(new Set());
    setOpenId(null);
  };
  const changeSettings = (next: OrganizeSettings) => {
    props.setSettings(next);
    if (mine) sortNow(next); // Prism's suggestions follow by themselves (the effect above)
  };

  // "Add all": with one playlist they all go into it; otherwise each goes to
  // the group closest to it by lyrics mood + tempo (like untagged songs).
  const addAll = () => {
    if (!groups.length) return;
    const to = groups.length === 1 ? leftSongs.map(() => 0) : closestByMoodAndTempo(groups.map(songsOf), leftSongs, settings.focus);
    setGroups((gs) => addSongs(gs, leftSongs.map((song, j) => ({ uri: song.uri, toId: gs[to[j]].id }))));
  };

  if (view === "builder") {
    return (
      <GroupBuilder
        songs={songs}
        groups={specs}
        setGroups={setSpecs}
        intro={
          <>
            Make one playlist or several: give each a name and pick its genres and/or moods. Prism then sorts the{" "}
            {songs.length} songs into them.
            {groups.length > 0 && " Sorting again undoes your edits to the sorted groups."}
          </>
        }
        onBack={onBack}
        onSort={() => {
          sortNow(settings);
          setView("cards");
        }}
      />
    );
  }

  // Step 13d: confirm and create the groups now on screen.
  if (creating) {
    // "Built from" for the stats page: the labels picked for your own groups,
    // otherwise the group's most common tags.
    const labelsOf = (group: EditableGroup) =>
      (mine && pickedLabels.get(group.id)) || summarize(songsOf(group)).tags.slice(0, 3).map(([name]) => name);
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

  if (view === "left") {
    return (
      <NotIncluded
        songs={leftSongs}
        groups={groups}
        removed={removed}
        onAdd={(uri, toId) => setGroups((gs) => addSongs(gs, [{ uri, toId }]))}
        onAddAll={addAll}
        onClose={() => setView("cards")}
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
        onRemove={(uri) => {
          setGroups((gs) => removeSong(gs, uri, open.id));
          setRemoved((r) => new Set(r).add(uri));
        }}
        onMerge={(otherId) => setGroups((gs) => mergeGroups(gs, open.id, otherId))}
      />
    );
  }

  const placed = groups.reduce((n, g) => n + g.songs.length, 0);
  return (
    <div style={styles.screen} data-prism-state="organize-groups" data-prism-view={mine ? "custom" : "suggested"}>
      <div style={styles.headRow}>
        <p style={{ ...styles.sub, flex: 1 }}>
          {!mine ? (
            intro
          ) : single ? (
            <>
              <b style={{ color: "#fff" }}>{placed}</b> of {songs.length} songs match your picks.
            </>
          ) : (
            <>
              {songs.length} songs sorted into <b style={{ color: "#fff" }}>your {groups.length} groups</b> ({overlap})
              {forced > 0 ? ` · ${forced} matched none of your genres/moods and went to the closest group by mood and tempo` : ""}
              {settings.overlap && placed > songs.length ? ` · ${placed - songs.length} songs are in more than one` : ""}.
            </>
          )}
        </p>
        {/* One playlist has nothing to tune: no More options. */}
        {!single && (
          <button
            type="button"
            className="prism-menu-button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
            data-prism="more-options"
          >
            <span>More options</span>
            <span aria-hidden="true" style={{ display: "inline-block", transform: moreOpen ? "rotate(180deg)" : "none" }}>
              ▾
            </span>
          </button>
        )}
      </div>
      {moreOpen && !single && <RemixOptions settings={settings} onChange={changeSettings} showCount={!mine} />}
      <div style={styles.grid} data-prism="organize-group-list">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            groupSongs={songsOf(group)}
            picked={mine ? pickedLabels.get(group.id) : undefined}
            onOpen={() => setOpenId(group.id)}
          />
        ))}
        {left.length > 0 && <NotIncludedCard songs={leftSongs} onOpen={() => setView("left")} />}
      </div>
      <p className="prism-notice" style={{ fontSize: 13 }}>
        Click a group to rename it, move or remove songs, or combine it. Nothing is created until you confirm on the
        next screen.
      </p>
      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack} data-prism="groups-back">
          Back
        </ButtonSecondary>
        <span style={{ flex: 1 }} />
        {mine && (
          <ButtonSecondary buttonSize="sm" onClick={() => setView("builder")} data-prism="edit-picks">
            {single ? "Edit my picks" : "Edit my groups"}
          </ButtonSecondary>
        )}
        <ButtonPrimary buttonSize="sm" onClick={() => setCreating(true)} data-prism="open-create">
          {groups.length === 1 ? "Create playlist" : "Create playlists"}
        </ButtonPrimary>
      </div>
    </div>
  );
}

// ----- "Not included": the songs in no group -----

// The dashed card beside the groups. Its picture is the left-out songs' own
// covers, faded, with a "+" on top, so it still looks like part of the set.
function NotIncludedCard({ songs, onOpen }: { songs: ScannedSong[]; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="prism-glass-panel prism-group-card prism-left-card"
      style={styles.card}
      onClick={onOpen}
      data-prism="organize-not-included"
      aria-label={`Not included: ${plural(songs.length)}. Open to see them and add them back`}
    >
      <span style={styles.leftPicture}>
        <span style={{ display: "block", opacity: 0.35 }}>
          <CoverMosaic songs={songs} summary={summarize(songs)} size={TILE_COVER} />
        </span>
        <span style={styles.leftMark} aria-hidden="true">
          +
        </span>
      </span>
      <span style={styles.cardText}>
        <span style={styles.cardName}>Not included</span>
        <span style={styles.cardCount}>{plural(songs.length)}</span>
        <span style={styles.cardLine}>See them and add any back</span>
      </span>
    </button>
  );
}

// Why a song is in no group, in plain words.
function whyLeftOut(song: ScannedSong, takenOut: boolean): string {
  if (takenOut) return "you took it out of its group";
  if (!song.tags.length && !song.mood) return "no genre tags or lyrics mood found";
  return "has none of the genres or moods you picked";
}

interface NotIncludedProps {
  songs: ScannedSong[];
  groups: EditableGroup[];
  removed: Set<string>;
  onAdd: (uri: string, toId: string) => void;
  onAddAll: () => void;
  onClose: () => void;
}

function NotIncluded({ songs, groups, removed, onAdd, onAddAll, onClose }: NotIncludedProps) {
  const { ButtonSecondary } = Spicetify.ReactComponent as any;
  const one = groups.length === 1 ? groups[0] : null;
  return (
    <div style={styles.screen} data-prism-state="organize-not-included">
      <div>
        <p style={styles.leftTitle}>Not included · {plural(songs.length)}</p>
        <p style={styles.sub}>
          {songs.length ? "These songs won't be in any new playlist. Add the ones you want." : "Every song is in a playlist now."}
        </p>
      </div>
      <div style={styles.songList} data-prism="not-included-list">
        {songs.map((song) => (
          <div key={song.uri} style={styles.songRow} data-prism="not-included-song">
            {song.coverSmall ? <img src={song.coverSmall} alt="" style={styles.thumb} loading="lazy" /> : <span style={styles.thumb} />}
            <span style={styles.songText}>
              <span style={styles.songName}>{song.name}</span>
              <span style={styles.songArtist}>
                {song.artists.join(", ")} · <i>{whyLeftOut(song, removed.has(song.uri))}</i>
              </span>
            </span>
            {one ? (
              <button type="button" className="prism-menu-button" onClick={() => onAdd(song.uri, one.id)} data-prism="add-song">
                <span>Add</span>
              </button>
            ) : (
              <GlassMenu
                label="Add to…"
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
                onPick={(toId) => onAdd(song.uri, toId)}
                ariaLabel={`Add ${song.name} to a group`}
                dataPrism="add-to-menu"
              />
            )}
          </div>
        ))}
      </div>
      <div className="prism-actions" style={styles.detailActions}>
        <ButtonSecondary buttonSize="sm" onClick={onClose} data-prism="not-included-back">
          Back
        </ButtonSecondary>
        {songs.length > 0 && (
          <ButtonSecondary
            buttonSize="sm"
            onClick={onAddAll}
            data-prism="add-all"
            title={one ? undefined : "Each song goes to the group closest to it by mood and tempo"}
          >
            {songs.length === 1
              ? one
                ? "Add it"
                : "Add it to its closest group"
              : one
                ? `Add all ${songs.length}`
                : `Add all ${songs.length} to their closest group`}
          </ButtonSecondary>
        )}
      </div>
    </div>
  );
}

// ----- One card: cover mosaic, name, count, genres, mood/tempo line -----
// Look "A, door tiles" (developer's pick 2026-11-23): wide glass tiles, two
// per row, like the two doors before this screen: the cover mosaic on the
// left, the text beside it, and the doors' pink edge + glow on hover.

const TILE_COVER = 84; // px, the cover mosaic on a tile

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
      aria-label={`${group.name}, ${plural(group.songs.length)}. Open to edit`}
    >
      <CoverMosaic songs={groupSongs} summary={summary} size={TILE_COVER} />
      <span style={styles.cardText}>
      <span style={styles.cardName}>{group.name}</span>
      <span style={styles.cardCount}>{plural(group.songs.length)}</span>
      {/* A box as wide as the card that cuts off labels that don't fit, so a
          long label can't spill over into the next card. */}
      <span style={styles.labelClip}>
        <TagLabels labels={labels.map((name) => ({ name, colour: tagColour(name), shared: true }))} />
      </span>
      <span style={styles.cardLine}>{summaryLine(summary)}</span>
      </span>
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

const plural = (n: number) => `${n} song${n === 1 ? "" : "s"}`;

// The combine question. It counts only the songs that will really be added:
// with overlap on, some of the other group's songs can already be in this
// one (mergeGroups adds each song once), so "all N" would say too much.
function combineText(group: EditableGroup, other: EditableGroup): string {
  const added = other.songs.filter((s) => !group.songs.includes(s)).length;
  const already = other.songs.length - added;
  const gone = `the "${other.name}" group will disappear.`;
  if (added === 0) {
    return `Every song in "${other.name}" is already in "${group.name}", so nothing new is added. Combine anyway? The "${other.name}" group will disappear.`;
  }
  return (
    `Add ${plural(added)} from "${other.name}" to "${group.name}"` +
    (already > 0 ? ` (${already} ${already === 1 ? "is" : "are"} already here)` : "") +
    `? "${group.name}" will have ${plural(group.songs.length + added)}, and ${gone}`
  );
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
          <div key={song.uri} style={styles.songRow} data-prism="group-song">
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
            {combineText(group, combineWith)}
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
    flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gap: 14, padding: "2px 4px 4px 2px",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", alignContent: "start",
  },
  card: {
    display: "flex", flexDirection: "row", alignItems: "center", gap: 14, padding: 16, textAlign: "left",
    cursor: "pointer", color: "inherit", font: "inherit", minWidth: 0,
  },
  cardText: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minWidth: 0, flex: 1 },
  cardName: { color: "#ffffff", fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" },
  cardCount: { color: "var(--spice-subtext)", fontSize: 13 },
  cardLine: { color: "var(--spice-subtext)", fontSize: 12 },
  labelClip: { display: "block", width: "100%", overflow: "hidden" },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
  headRow: { display: "flex", alignItems: "center", gap: 12 },
  leftPicture: { position: "relative", display: "block", width: TILE_COVER, height: TILE_COVER, flexShrink: 0 },
  leftMark: {
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    color: "#f4c0d1", fontSize: 32, fontWeight: 300,
  },
  leftTitle: { margin: "0 0 4px", color: "#ffffff", fontSize: 18, fontWeight: 600 },
  detailHead: { display: "flex", gap: 14, alignItems: "flex-start" },
  detailText: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 },
  nameInput: { fontSize: 18, fontWeight: 600, padding: "6px 12px" },
  songList: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, paddingRight: 4 },
  songRow: { display: "flex", alignItems: "center", gap: 10, padding: "5px 4px", borderTop: "1px solid rgba(255,255,255,0.06)" },
  thumb: { width: 36, height: 36, borderRadius: 4, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.08)" },
  songText: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  songName: { color: "var(--spice-text)", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  songArtist: { color: "var(--spice-subtext)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  detailActions: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  confirm: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13 },
  confirmButtons: { display: "flex", gap: 8, flexShrink: 0 },
};
