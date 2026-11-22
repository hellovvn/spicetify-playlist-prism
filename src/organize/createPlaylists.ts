// Organize, step 13d: turning the reviewed groups into NEW playlists.
// PURE: the actual Spotify write is passed in (`create`), and it always goes
// through src/spotify/write.ts (guarded: only playlists made this session).
// Unit-tested in tests/createPlaylists.test.ts.

import type { EditableGroup } from "./editGroups";

// The prefix Prism playlists get. src/ui/prismRows.ts uses this same value
// to spot older Prism playlists (without a saved record) in the sidebar.
export const NAME_PREFIX = "Prism · ";

export interface PlannedPlaylist {
  groupId: string;
  name: string; // the final playlist name (with the prefix if chosen)
  songs: string[]; // song URIs, in the group's order
}

// "Love" -> "Prism · Love". A name that already starts with the prefix
// isn't given it twice.
export function withPrefix(name: string, prefix: boolean): string {
  const clean = name.trim();
  return prefix && !clean.startsWith(NAME_PREFIX) ? NAME_PREFIX + clean : clean;
}

// Which playlists will be made: one per group that still has songs, in the
// order shown. Empty groups are skipped (listed by name so the screen can say so).
export function planPlaylists(groups: EditableGroup[], prefix: boolean): { planned: PlannedPlaylist[]; skipped: string[] } {
  return {
    planned: groups
      .filter((g) => g.songs.length > 0)
      .map((g) => ({ groupId: g.id, name: withPrefix(g.name, prefix), songs: [...g.songs] })),
    skipped: groups.filter((g) => g.songs.length === 0).map((g) => g.name),
  };
}

export type CreateStatus = "waiting" | "creating" | "created" | "failed";

export interface CreateOutcome {
  created: { groupId: string; name: string; uri: string }[];
  failed: { groupId: string; name: string; error: unknown } | null;
  notTried: string[]; // names after a failure (nothing was done for them)
}

// Creates the playlists ONE AT A TIME, in order, reporting each step.
// If one fails, it STOPS: the rest aren't tried, and the outcome says exactly
// which ones exist, so the user is never left guessing.
export async function createAll(
  planned: PlannedPlaylist[],
  create: (playlist: PlannedPlaylist) => Promise<string>,
  onStatus: (groupId: string, status: CreateStatus) => void = () => {}
): Promise<CreateOutcome> {
  const outcome: CreateOutcome = { created: [], failed: null, notTried: [] };
  for (let i = 0; i < planned.length; i++) {
    const p = planned[i];
    onStatus(p.groupId, "creating");
    try {
      const uri = await create(p);
      outcome.created.push({ groupId: p.groupId, name: p.name, uri });
      onStatus(p.groupId, "created");
    } catch (error) {
      outcome.failed = { groupId: p.groupId, name: p.name, error };
      onStatus(p.groupId, "failed");
      outcome.notTried = planned.slice(i + 1).map((rest) => rest.name);
      break;
    }
  }
  return outcome;
}
