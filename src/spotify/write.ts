// THE ONLY FILE THAT CHANGES ANYTHING IN THE USER'S SPOTIFY.
//
// Hard rule (CLAUDE.md): never modify existing playlists or Liked Songs.
// The only writes allowed are:
//   1. create a NEW playlist
//   2. add songs to THAT new playlist
// Every add checks that its target is a playlist created by this module in
// this session (assertCreatedThisSession). Anything else is refused with an
// error, even if a bug elsewhere passes the wrong playlist.
//
// tests/writeGuard.test.ts also scans the whole src/ folder and fails if any
// OTHER file calls a Spotify write function.
//
// The Spotify calls are passed in (WriteApi), so tests use a fake and never
// touch a real account.

export interface WriteApi {
  createPlaylist: (name: string) => Promise<string | null>;
  addToPlaylist: (playlistUri: string, trackUris: string[]) => Promise<void>;
}

// The real thing. Arguments copied from how Spotify's own app calls them
// (checked in the running app's code): new playlists go to the top of the
// library, songs are added at the end.
export function spotifyWriteApi(): WriteApi {
  return {
    createPlaylist: (name) => Spicetify.Platform.RootlistAPI.createPlaylist(name, { before: "start" }),
    addToPlaylist: (playlistUri, trackUris) => Spicetify.Platform.PlaylistAPI.add(playlistUri, trackUris, { after: "end" }),
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

// Unit tests only: forget the session so each test starts clean.
export function resetSessionForTests(): void {
  createdThisSession.clear();
}

// Exported for tests that check the guard directly.
export const addToNewPlaylistForTests = addToNewPlaylist;
