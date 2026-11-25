// Source options: the playlists (and Liked Songs) the user can pick songs FROM.
// PURE helpers, unit-tested in tests/sources.test.ts. Reading them from
// Spotify happens in src/spotify/read.ts (getSources).
//
// Sources are only ever READ. The new playlist is the only thing we create.

export interface SourceOption {
  uri: string;
  name: string;
  trackCount: number;
  folder: string | null; // the folder it sits in, if any
  owner: string; // display name, e.g. "Vivian" or "Spotify"
  // Spotify says the user may edit its details (their own playlists). Only
  // Merge uses it, to know which originals can get the "[merged] " tag.
  canRename?: boolean;
  // Spotify says the user may ADD songs (their own or collaborative playlists).
  // Only "Add with Prism" uses it.
  canAdd?: boolean;
}

// Spotify's URI for Liked Songs.
export const LIKED_SONGS_URI = "spotify:collection:tracks";

// Spotify's playlist list is a tree (folders can hold playlists and other
// folders). This flattens it into one list, remembering each playlist's folder.
// Empty playlists are skipped: there's nothing in them to scan.
// `any`: this is Spotify's raw data; we only read the fields we checked exist.
export function flattenRootlist(items: any[], folder: string | null = null): SourceOption[] {
  const result: SourceOption[] = [];
  for (const item of items ?? []) {
    if (item?.type === "folder") {
      // A folder inside a folder shows as "Outer / Inner".
      const name = folder ? `${folder} / ${item.name}` : item.name;
      result.push(...flattenRootlist(item.items, name)); // recursion: the function calls itself
    } else if (item?.type === "playlist" && typeof item.uri === "string" && item.totalLength > 0) {
      result.push({
        uri: item.uri,
        name: item.name ?? "(untitled)",
        trackCount: item.totalLength,
        folder,
        owner: item.owner?.displayName ?? item.owner?.username ?? "",
        // canEditMetadata is false here even for your own playlists (checked
        // 2026-11-23), so ownership is what counts. Collaborators can't rename.
        canRename: item.isOwnedBySelf === true || item.canEditMetadata === true,
        canAdd: item.canAdd === true,
      });
    }
  }
  return result;
}

// Search box: matches the playlist name or its folder, ignoring capitals.
export function filterSources(sources: SourceOption[], query: string): SourceOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return sources;
  return sources.filter(
    (s) => s.name.toLowerCase().includes(q) || (s.folder ?? "").toLowerCase().includes(q)
  );
}

// "Select all" works on what's SHOWN: with a search typed, it only ticks the
// matching playlists (the usual behaviour in apps like Gmail).
export function allShownSelected(shown: SourceOption[], selectedUris: string[]): boolean {
  return shown.length > 0 && shown.every((s) => selectedUris.includes(s.uri));
}

// Ticks every shown source, keeping anything already ticked.
export function selectShown(shown: SourceOption[], selectedUris: string[]): string[] {
  const added = shown.map((s) => s.uri).filter((uri) => !selectedUris.includes(uri));
  return [...selectedUris, ...added];
}

// Unticks every shown source; ticks on hidden (filtered-out) sources stay.
export function clearShown(shown: SourceOption[], selectedUris: string[]): string[] {
  const shownUris = shown.map((s) => s.uri);
  return selectedUris.filter((uri) => !shownUris.includes(uri));
}

// Total songs in the selected sources. It's an UPPER bound: a song in two
// playlists counts twice here; the scan (step 7) removes duplicates.
export function selectedSongCount(sources: SourceOption[], selectedUris: string[]): number {
  return sources
    .filter((s) => selectedUris.includes(s.uri))
    .reduce((sum, s) => sum + s.trackCount, 0);
}
