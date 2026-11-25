// THE ONLY FILE THAT CHANGES ANYTHING IN THE USER'S SPOTIFY.
//
// The writes Prism makes (each only after the user clicks a button for it):
//   1. create a NEW playlist and add songs to it (Grow, Remix, Merge)
//   2. Merge only (createMergedPlaylist): put "[merged] " in front of the
//      NAME of the playlists that went into it, if the user left that switch on
//   3. "Add with Prism" (addSongToPlaylist): add ONE song to the END of one of
//      the user's playlists that Spotify says they may add to. Nothing is
//      ever removed or reordered.
// (The old hard rule "never modify existing playlists" was lifted by the
// developer on 2026-11-24 for "Add with Prism".)
// Adds to NEW playlists check that the target was created by this module in
// this session (assertCreatedThisSession), so a bug elsewhere can't pour a
// whole song list into the wrong playlist.
//
// tests/writeGuard.test.ts also scans the whole src/ folder and fails if any
// OTHER file calls a Spotify write function.
//
// The Spotify calls are passed in (WriteApi), so tests use a fake and never
// touch a real account.

export interface WriteApi {
  createPlaylist: (name: string) => Promise<string | null>;
  addToPlaylist: (playlistUri: string, trackUris: string[]) => Promise<void>;
  // Merge only (see the top of this file). Optional, so fakes in older tests still fit.
  renamePlaylist?: (playlistUri: string, name: string) => Promise<void>;
}

// The real thing. Arguments copied from how Spotify's own app calls them
// (checked in the running app's code): new playlists go to the top of the
// library, songs are added at the end.
export function spotifyWriteApi(): WriteApi {
  return {
    createPlaylist: (name) => Spicetify.Platform.RootlistAPI.createPlaylist(name, { before: "start" }),
    addToPlaylist: (playlistUri, trackUris) => Spicetify.Platform.PlaylistAPI.add(playlistUri, trackUris, { after: "end" }),
    // Spotify's own "Edit details" dialog uses this. Only the name is passed,
    // so the description and cover stay as they are.
    renamePlaylist: (playlistUri, name) => Spicetify.Platform.PlaylistAPI.updateDetails(playlistUri, { name }),
  };
}

// Playlists this module created since Spotify started. Only these may receive songs.
const createdThisSession = new Set<string>();

// Errors with a message meant for the user (shown in the preview as-is).
export class PrismWriteError extends Error {}
// The guard refused a write. Should never happen; if it does, it's a bug.
export class WriteGuardError extends PrismWriteError {}

export function assertCreatedThisSession(playlistUri: string): void {
  if (!createdThisSession.has(playlistUri)) {
    throw new WriteGuardError(
      `Refused to change ${playlistUri}: Prism only adds songs to a playlist it just created.`
    );
  }
}

// Songs are added in batches of this size (smaller requests are safer).
const BATCH_SIZE = 100;

// Creates the new playlist and adds the songs, in the given order.
// Returns the new playlist's URI.
export async function createPrismPlaylist(
  name: string,
  trackUris: string[],
  api: WriteApi = spotifyWriteApi()
): Promise<string> {
  // Check everything BEFORE creating, so a bad request never leaves an empty playlist behind.
  const cleanName = name.trim();
  if (!cleanName) throw new PrismWriteError("The playlist needs a name.");
  const songs = [...new Set(trackUris)]; // no duplicates, first copy keeps its place
  if (songs.length === 0) throw new PrismWriteError("There are no songs to add.");
  const notSongs = songs.filter((uri) => !uri.startsWith("spotify:track:"));
  if (notSongs.length > 0) throw new PrismWriteError(`Only Spotify songs can be added (got ${notSongs[0]}).`);

  // 1. Create.
  const playlistUri = await api.createPlaylist(cleanName);
  if (!playlistUri || !playlistUri.startsWith("spotify:playlist:")) {
    throw new PrismWriteError("Spotify didn't create the playlist. Nothing was changed.");
  }
  createdThisSession.add(playlistUri);

  // 2. Add songs to THAT playlist only.
  try {
    await addToNewPlaylist(playlistUri, songs, api);
  } catch (error) {
    if (error instanceof WriteGuardError) throw error;
    console.error("[Playlist Prism] adding songs failed", error);
    // Honest about the half-done state: the new playlist exists but may be incomplete.
    throw new PrismWriteError(
      `The new playlist "${cleanName}" was created, but adding the songs failed. ` +
        "It may be empty or incomplete; you can delete it from your library and try again."
    );
  }
  return playlistUri;
}

async function addToNewPlaylist(playlistUri: string, trackUris: string[], api: WriteApi): Promise<void> {
  assertCreatedThisSession(playlistUri);
  for (let start = 0; start < trackUris.length; start += BATCH_SIZE) {
    assertCreatedThisSession(playlistUri); // checked before EVERY write, not just once
    await api.addToPlaylist(playlistUri, trackUris.slice(start, start + BATCH_SIZE));
  }
}

// ----- Merge playlists (the one rename exception) -----

export const MERGED_PREFIX = "[merged] ";

// The name an original gets after a merge. Never adds the tag twice.
export function mergedName(name: string): string {
  return name.startsWith(MERGED_PREFIX.trim()) ? name : `${MERGED_PREFIX}${name}`;
}

export interface MergeSource {
  uri: string;
  name: string; // its name now
  canRename: boolean; // Spotify says the user may edit it (not followed, not Liked Songs)
}

export interface MergeResult {
  uri: string; // the new merged playlist
  renamed: string[]; // names (before) of the originals that got the tag
  notRenamed: { name: string; reason: string }[];
}

// Creates the merged playlist (same checks as createPrismPlaylist), THEN, if
// asked, tags the originals' names. A failed rename never undoes the merge:
// it's reported in notRenamed instead.
export async function createMergedPlaylist(
  name: string,
  trackUris: string[],
  sources: MergeSource[],
  renameSources: boolean,
  api: WriteApi = spotifyWriteApi()
): Promise<MergeResult> {
  const uri = await createPrismPlaylist(name, trackUris, api);
  const result: MergeResult = { uri, renamed: [], notRenamed: [] };
  if (!renameSources) return result;
  for (const source of sources) {
    if (source.uri === uri || !source.uri.startsWith("spotify:playlist:")) {
      result.notRenamed.push({ name: source.name, reason: "Liked Songs can't be renamed" });
      continue;
    }
    if (!source.canRename) {
      result.notRenamed.push({ name: source.name, reason: "you don't own it" });
      continue;
    }
    const next = mergedName(source.name);
    if (next === source.name) {
      result.notRenamed.push({ name: source.name, reason: "already tagged" });
      continue;
    }
    try {
      if (!api.renamePlaylist) throw new Error("rename isn't available");
      await api.renamePlaylist(source.uri, next);
      result.renamed.push(source.name);
    } catch (error) {
      console.error("[Playlist Prism] renaming a merged playlist failed", error);
      result.notRenamed.push({ name: source.name, reason: "Spotify refused the rename" });
    }
  }
  return result;
}

// ----- Add with Prism -----

export interface AddTarget {
  uri: string;
  name: string;
  canAdd: boolean; // Spotify says the user may add songs (their own or collaborative)
  hasSong: boolean; // the playlist already has this song
}

// Adds ONE song to the end of an existing playlist the user picked from
// "Add with Prism". Refuses Liked Songs, playlists the user can't add to and
// playlists that already have the song, so nothing ends up there twice.
export async function addSongToPlaylist(target: AddTarget, trackUri: string, api: WriteApi = spotifyWriteApi()): Promise<void> {
  if (!target.uri.startsWith("spotify:playlist:")) throw new PrismWriteError("Prism only adds songs to playlists.");
  if (!trackUri.startsWith("spotify:track:")) throw new PrismWriteError(`Only Spotify songs can be added (got ${trackUri}).`);
  if (!target.canAdd) throw new PrismWriteError(`You can't add songs to "${target.name}".`);
  if (target.hasSong) throw new PrismWriteError(`"${target.name}" already has this song.`);
  try {
    await api.addToPlaylist(target.uri, [trackUri]);
  } catch (error) {
    console.error("[Playlist Prism] adding a song failed", error);
    throw new PrismWriteError(`Spotify didn't add the song to "${target.name}". Nothing was changed.`);
  }
}

// Unit tests only: forget the session so each test starts clean.
export function resetSessionForTests(): void {
  createdThisSession.clear();
}

// Exported for tests that check the guard directly.
export const addToNewPlaylistForTests = addToNewPlaylist;
