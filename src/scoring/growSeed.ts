// What Grow starts from: ONE song, or a whole PLAYLIST (2026-11-26).
// PURE helpers shared by the seed panel, the preview and flow.ts, so every
// step treats the two kinds the same way. Tested in tests/growSeed.test.ts.

import type { TrackInfo } from "../spotify/read";
import type { AudioAttributes } from "../spotify/audio";
import type { MoodProfile } from "../mood/lyricsMood";
import type { SourcedTag } from "../tags/combineTags";
import type { ScannedSong } from "../scan/scan";
import { scoreSong, type MatchDetails, type Scorable } from "./score";
import { scoreAgainstPlaylist, type BlendTag } from "./playlistSeed";
import { songKey } from "./rank";

export interface SongSeedData {
  kind: "song";
  track: TrackInfo;
  tags: SourcedTag[];
  audio: AudioAttributes | null;
  mood: MoodProfile | null; // from the lyrics (step 10); null = unknown
}

export interface PlaylistSeedData {
  kind: "playlist";
  playlist: { uri: string; name: string; cover: string | null };
  // The seed songs (after the seed screen: only the ones left ticked).
  songs: ScannedSong[];
  tags: BlendTag[]; // the blend of `songs` (blendTags)
  mood: MoodProfile | null; // the blend of their moods (blendMood)
}

export type SeedData = SongSeedData | PlaylistSeedData;

// How every candidate is scored against this seed (kept = chips left on).
export function growScorer(seed: SeedData, kept: SourcedTag[]): (song: Scorable) => MatchDetails {
  if (seed.kind === "song") return (song) => scoreSong({ tags: kept, audio: seed.audio, mood: seed.mood }, song);
  return (song) => scoreAgainstPlaylist({ tags: kept, songs: seed.songs }, song);
}

// The seed's own songs: first in the new playlist, never offered as matches.
export function seedSongs(seed: SeedData): { uri: string; name: string; artists: string[] }[] {
  return seed.kind === "song" ? [seed.track] : seed.songs;
}

// Songs to leave out of the matches (by URI and "same song" key).
export function seedExclusions(seed: SeedData): { uris: Set<string>; keys: Set<string> } {
  const songs = seedSongs(seed);
  return { uris: new Set(songs.map((s) => s.uri)), keys: new Set(songs.map(songKey)) };
}

// The seed's songs as they go into the new playlist: Spotify songs only
// (a playlist can hold local files or episodes), in their own order.
export function seedTrackUris(seed: SeedData): string[] {
  return seedSongs(seed)
    .map((song) => song.uri)
    .filter((uri) => uri.startsWith("spotify:track:"));
}

// Short name: the song's title or the playlist's name.
export function seedName(seed: SeedData): string {
  return seed.kind === "song" ? seed.track.name : seed.playlist.name;
}

// The id that tells two seeds apart (new finds are cached per seed).
export function seedId(seed: SeedData): string {
  return seed.kind === "song" ? seed.track.uri : `${seed.playlist.uri}|${seed.songs.map((s) => s.uri).join(",")}`;
}
