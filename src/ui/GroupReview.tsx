// Organize's review screen (step 13c): the suggested groups as album-cover
// cards. Click a card to open it: rename it, move or remove songs, or merge
// it into another group. Nothing is created in Spotify here (that's 13d).
//
// The groups are kept as EditableGroup state (src/organize/editGroups.ts:
// pure functions that return new groups), and each group's summary is worked
// out again from its current songs, so it stays right after every edit.

import React from "react";
import type { ScannedSong } from "../scan/scan";
import { summarize, type GroupSummary, type SongGroup } from "../organize/grouping";
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

export interface GroupReviewProps {
  songs: ScannedSong[]; // every scanned song (for names, covers, summaries)
  suggested: SongGroup[]; // what the grouping suggested
  intro: React.ReactNode; // e.g. "250 songs from 2 playlists into 8 groups..."
  onBack: () => void;
}

export function GroupReview({ songs, suggested, intro, onBack }: GroupReviewProps) {
  const { ButtonSecondary } = Spicetify.ReactComponent as any;
  const [groups, setGroups] = React.useState<EditableGroup[]>(() => editableGroups(suggested));
  const [openId, setOpenId] = React.useState<string | null>(null);
  // Look songs up by URI quickly (a Map), rebuilt only when the songs change.
  const byUri = React.useMemo(() => new Map(songs.map((s) => [s.uri, s])), [songs]);
  const songsOf = (group: EditableGroup) => group.songs.map((u) => byUri.get(u)).filter((s): s is ScannedSong => !!s);
  const left = songsInNoGroup(groups, songs.map((s) => s.uri));
  const open = groups.find((g) => g.id === openId) ?? null;

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

  return (
    <div style={styles.screen} data-prism-state="organize-groups">
      <p style={styles.sub}>{intro}</p>
      <div style={styles.grid} data-prism="organize-group-list">
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} groupSongs={songsOf(group)} onOpen={() => setOpenId(group.id)} />
        ))}
      </div>
      {left.length > 0 && (
        <p style={styles.sub} data-prism="organize-left-out">
          {left.length} song{left.length === 1 ? "" : "s"} removed from every group (won't be in any new playlist).
        </p>
      )}
      <p className="prism-notice" style={{ fontSize: 13 }}>
        Click a group to rename it, move or remove songs, or merge it. Creating the playlists comes in the next
        step (13d). Nothing has been created.
      </p>
      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack}>
          Back
        </ButtonSecondary>
      </div>
    </div>
  );
}

// ----- One card: cover mosaic, name, count, genres, mood/tempo line -----

function GroupCard({ group, groupSongs, onOpen }: { group: EditableGroup; groupSongs: ScannedSong[]; onOpen: () => void }) {
  const summary = summarize(groupSongs);
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
        <TagLabels labels={summary.tags.slice(0, 2).map(([name]) => ({ name, colour: tagColour(name), shared: true }))} />
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

// A 2x2 mosaic of the group's first 4 different album covers, like Spotify's
// own playlist covers. Missing covers become tiles in the group's genre colour.
function CoverMosaic({ songs, summary, size }: { songs: ScannedSong[]; summary: GroupSummary; size: number }) {
  const covers: string[] = [];
  for (const song of songs) {
    if (song.cover && !covers.includes(song.cover)) covers.push(song.cover);
    if (covers.length === 4) break;
  }
  const colour = tagColour(summary.tags[0]?.[0] ?? "prism");
  return (
    <span style={{ ...styles.mosaic, width: size, height: size }} aria-hidden="true">
      {[0, 1, 2, 3].map((i) =>
        covers.length >= 4 || (covers.length > 0 && i < covers.length) ? (
          <img key={i} src={covers[i]} alt="" style={styles.tile} loading="lazy" />
        ) : covers.length > 0 && covers.length < 4 && i >= covers.length ? (
          <img key={i} src={covers[i % covers.length]} alt="" style={styles.tile} loading="lazy" />
        ) : (
          <span key={i} style={{ ...styles.tile, background: `linear-gradient(${135 + i * 40}deg, ${colour}, #2a1748 75%)` }} />
        )
      )}
    </span>
  );
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
        <ButtonSecondary buttonSize="sm" onClick={onClose} data-prism="all-groups">
          All groups
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
  mosaic: { display: "grid", gridTemplateColumns: "1fr 1fr", borderRadius: 10, overflow: "hidden", flexShrink: 0, alignSelf: "center" },
  tile: { width: "100%", height: "100%", objectFit: "cover", display: "block", aspectRatio: "1" },
  cardName: { color: "#ffffff", fontSize: 14, fontWeight: 700, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" },
  cardCount: { color: "var(--spice-subtext)", fontSize: 12 },
  cardLine: { color: "var(--spice-subtext)", fontSize: 12 },
  labelClip: { display: "block", width: "100%", overflow: "hidden" },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
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
