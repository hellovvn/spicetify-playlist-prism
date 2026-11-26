// The scan: for every song in the chosen playlists, get its tags (Last.fm),
// BPM/key (Spotify) and lyrics mood (Spotify lyrics, step 10).
// Scoring them against the seed is src/scoring/.
//
// Everything it talks to is passed in ("dependency injection"), so the unit
// tests (tests/scan.test.ts) use fakes: no network, no real waiting.
//
// READ-ONLY: it never changes anything in Spotify.

import type { AudioAttributes } from "../spotify/audio";
import type { MoodProfile } from "../mood/lyricsMood";
import type { MoodCache } from "./moodCache";
import type { SourcedTag } from "../tags/combineTags";
import type { SongTagsResult, TagFetchers } from "../tags/getSongTags";
import type { LastfmTag } from "../lastfm/client";
import { runPool, type Clock } from "./limits";
import type { TagCache } from "./tagCache";
import type { ScanTrack } from "./tracks";

// What we know about a song after scanning:
//   "song"   it has its own Last.fm tags (best)
//   "artist" only its artist's tags (broader)
//   "none"   no tags at all (step 8 can still use BPM/key, but weakly)
//   "error"  the lookup failed (e.g. Last.fm kept timing out)
export type TagStatus = "song" | "artist" | "none" | "error";

export interface ScannedSong extends ScanTrack {
  tags: SourcedTag[];
  audio: AudioAttributes | null;
  mood: MoodProfile | null; // null = no lyrics mood (none, not English, or lookup failed)
  tagStatus: TagStatus;
}

export interface ScanProgress {
  done: number;
  total: number;
  fromCache: number; // answered from the cache, no Last.fm request needed
  failed: number;
}

export interface ScanDeps {
  getAudio: (uris: string[]) => Promise<Map<string, AudioAttributes | null>>;
  getTags: (song: { name: string; artists: string[] }) => Promise<SongTagsResult>;
  cache: TagCache;
  saveCache: () => void;
  clock: Clock;
  // Errors that make the whole scan pointless (bad/suspended API key).
  isFatal: (error: unknown) => boolean;
  // "Slow down" errors: wait and try the same song again.
  isRateLimit: (error: unknown) => boolean;
  // Lyrics mood (optional: without it every song's mood is null).
  mood?: {
    get: (uri: string) => Promise<MoodProfile | null>;
    cache: MoodCache;
    save: () => void;
  };
}

export interface ScanOptions {
  concurrency?: number; // songs looked up at once (default 4)
  maxRetries?: number; // retries after a rate-limit error (default 3)
  retryDelayMs?: number; // first retry wait; doubles each time (default 10 s)
  saveEvery?: number; // save the cache after this many new songs (default 25)
}

export function tagStatusOf(tags: SourcedTag[]): TagStatus {
  if (tags.some((tag) => tag.source === "track")) return "song";
  return tags.length > 0 ? "artist" : "none";
}

export async function scanSongs(
  tracks: ScanTrack[],
  deps: ScanDeps,
  onProgress: (progress: ScanProgress) => void = () => {},
  shouldStop: () => boolean = () => false,
  options: ScanOptions = {}
): Promise<{ songs: ScannedSong[]; cancelled: boolean; moodFailed: number }> {
  const concurrency = options.concurrency ?? 4;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 10_000;
  const saveEvery = options.saveEvery ?? 25;

  // 1. BPM/key for ALL songs first: one fast Spotify request per 100 songs.
  //    If it fails, carry on without it (tags matter more).
  let audioMap = new Map<string, AudioAttributes | null>();
  try {
    audioMap = await deps.getAudio(tracks.map((t) => t.uri));
  } catch (error) {
    console.warn("[Prism] BPM/key lookup failed; scanning without it", error);
  }

  // 2. Tags, song by song (slow: Last.fm, rate-limited).
  // `results[i]` stays undefined for songs not reached (Cancel).
  const results: (ScannedSong | undefined)[] = new Array(tracks.length);
  const progress: ScanProgress = { done: 0, total: tracks.length, fromCache: 0, failed: 0 };
  let fatal: unknown = null;
  let unsaved = 0;
  const stop = () => fatal !== null || shouldStop();

  // Lyrics mood for one song: from the cache, or ask Spotify. Never throws:
  // a failed lookup just means "mood unknown" (and isn't cached, so the next
  // scan tries again).
  let moodFailed = 0;
  const lookUpMood = async (uri: string): Promise<MoodProfile | null> => {
    const mood = deps.mood;
    if (!mood) return null;
    const cached = mood.cache.get(uri, deps.clock.now());
    if (cached !== undefined) return cached;
    try {
      const profile = await mood.get(uri);
      mood.cache.set(uri, profile, deps.clock.now());
      return profile;
    } catch {
      // Usually Spotify's lyrics rate limit. Counted, not logged per song.
      moodFailed++;
      return null;
    }
  };

  const index = new Map(tracks.map((t, i) => [t, i]));
  await runPool(
    tracks,
    concurrency,
    async (track) => {
      // Start the mood lookup now; it runs WHILE the tags are fetched below.
      const moodPromise = lookUpMood(track.uri);
      let tags: SourcedTag[] | null = null;

      const cached = deps.cache.get(track.uri, deps.clock.now());
      if (cached) {
        tags = cached.tags;
        progress.fromCache++;
      } else {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await deps.getTags(track);
            tags = result.tags;
            deps.cache.set(track.uri, { tags, matchedTitle: result.matchedTitle }, deps.clock.now());
            if (++unsaved >= saveEvery) {
              deps.saveCache();
              unsaved = 0;
            }
            break;
          } catch (error) {
            if (deps.isFatal(error)) {
              fatal = error; // stops the pool; reported after it ends
              return;
            }
            if (deps.isRateLimit(error) && attempt < maxRetries) {
              await deps.clock.sleep(retryDelayMs * 2 ** attempt); // 10 s, 20 s, 40 s ("exponential backoff")
              continue;
            }
            console.warn(`[Prism] tags failed for ${track.name}`, error);
            break; // give up on this song only; tags stays null
          }
        }
        if (tags === null) progress.failed++;
      }

      results[index.get(track)!] = {
        ...track,
        tags: tags ?? [],
        audio: audioMap.get(track.uri) ?? null,
        mood: await moodPromise,
        tagStatus: tags === null ? "error" : tagStatusOf(tags),
      };
      progress.done++;
      onProgress({ ...progress });
    },
    stop
  );

  // 3. Always save what we learned, even after Cancel or an error,
  //    so the next scan doesn't repeat that work.
  if (unsaved > 0) deps.saveCache();
  deps.mood?.save();
  if (fatal !== null) throw fatal;

  const songs = results.filter((song): song is ScannedSong => song !== undefined);
  if (moodFailed > 0) console.log(`[Prism] lyrics mood skipped for ${moodFailed} songs (Spotify limit); next scan retries them`);
  return { songs, cancelled: songs.length < tracks.length, moodFailed };
}

// Many songs share an artist. This makes each artist's Last.fm lookup happen
// once per scan; later songs by the same artist reuse the answer.
// It stores the PROMISE (the pending answer), so even two songs asking at the
// same moment share one request. A failed lookup is forgotten so it can be retried.
export function shareArtistLookups(fetchers: TagFetchers): TagFetchers {
  const byArtist = new Map<string, Promise<LastfmTag[]>>();
  return {
    fetchTrackTags: fetchers.fetchTrackTags,
    fetchArtistTags: (artist) => {
      const key = artist.toLowerCase();
      let pending = byArtist.get(key);
      if (!pending) {
        pending = fetchers.fetchArtistTags(artist);
        byArtist.set(key, pending);
        pending.catch(() => byArtist.delete(key));
      }
      return pending;
    },
  };
}

// "About 3 min left": based on how long the songs looked up SO FAR took.
// Cached songs are instant, so they're left out of the average. Returns null
// until a few real lookups have happened (an early guess would jump around).
export function timeLeftText(progress: ScanProgress, elapsedMs: number): string | null {
  const lookedUp = progress.done - progress.fromCache;
  if (lookedUp < 5) return null;
  const secondsLeft = ((progress.total - progress.done) * (elapsedMs / lookedUp)) / 1000;
  if (secondsLeft < 60) return "less than a minute left";
  const minutes = Math.round(secondsLeft / 60);
  return `about ${minutes} min left`;
}

// Counts for the summary shown when the scan finishes.
export function summarize(songs: ScannedSong[]) {
  const count = (status: TagStatus) => songs.filter((s) => s.tagStatus === status).length;
  return {
    total: songs.length,
    songTags: count("song"),
    artistOnly: count("artist"),
    noTags: count("none"),
    failed: count("error"),
    withBpm: songs.filter((s) => s.audio !== null).length,
    withMood: songs.filter((s) => s.mood !== null).length,
  };
}
