// The Prism flow's "work" (no UI): load the seed, scan the sources, create
// the playlist. The page (src/ui/PrismPage.tsx) calls these.
//
// Moved here from the old entry file in step 12a, when Playlist Prism became
// its own page. READ-ONLY except createFromPreview, which writes ONLY through
// src/spotify/write.ts.

import { getPlaylistName, getSourceTracks, getTrackInfo } from "./spotify/read";
import { createPrismPlaylist, PrismWriteError } from "./spotify/write";
import { LastfmError } from "./lastfm/client";
import { lastfmFetchers } from "./lastfm/fetchers";
import { LOG_PREFIX } from "./log";
import {
  getLastfmKey,
  loadMoodCacheText,
  loadPlaylistRecordsText,
  loadTagCacheText,
  saveMoodCacheText,
  savePlaylistRecordsText,
  saveTagCacheText,
} from "./storage";
import { RECORDS_CHANGED_EVENT } from "./ui/prismRows";
import { addRecord, buildRecord, estimateRecord, parseRecords, type PrismPlaylistRecord } from "./stats/playlistStats";
import { mergeTracks } from "./scan/tracks";
import { scanSongs, shareArtistLookups, type ScanProgress } from "./scan/scan";
import { createRateLimiter, realClock } from "./scan/limits";
import { TagCache } from "./scan/tagCache";
import { MoodCache } from "./scan/moodCache";
import { getLyricsMood, pausingLyricsMood } from "./spotify/lyrics";
import { formatMood, type MoodProfile } from "./mood/lyricsMood";
import { getSongTags } from "./tags/getSongTags";
import { formatAudio, getAudioAttributes } from "./spotify/audio";
import type { SourceOption } from "./sources/sources";
import type { SourcedTag } from "./tags/combineTags";
import type { RankedSong } from "./scoring/rank";
import type { ScanOutcome } from "./ui/ScanScreen";
import type { SeedData } from "./ui/SeedPanel";


// Last.fm asks for about 5 requests per second at most; stay a bit under.
const LASTFM_REQUESTS_PER_SECOND = 4;
// Lyrics come from Spotify, not Last.fm: separate, gentle limit.
// Spotify still limits bursts, see pausingLyricsMood in src/spotify/lyrics.ts.
const LYRICS_REQUESTS_PER_SECOND = 5;

export const isKeyProblem = (error: unknown) => error instanceof LastfmError && (error.code === 10 || error.code === 26);
const isRateLimit = (error: unknown) => error instanceof LastfmError && error.code === 29;

// Everything the seed screen needs: song details, tags, BPM/key, lyrics mood.
// If anything fails, the error goes back to the page, which shows friendlyError().
export async function loadSeed(uri: string): Promise<SeedData> {
  const apiKey = getLastfmKey();
  if (!apiKey) throw new LastfmError(10, "No Last.fm key saved");

  const track = await getTrackInfo(uri);
  console.log(`${LOG_PREFIX} seed song: ${track.name} - ${track.artists.join(", ")}`);

  // Promise.all starts all three at once and waits for all of them.
  const [result, audioMap, mood] = await Promise.all([
    getSongTags(track, lastfmFetchers(apiKey)),
    getAudioAttributes([uri]),
    seedMood(uri),
  ]);
  const audio = audioMap.get(uri) ?? null;

  console.log(`${LOG_PREFIX} bpm/key: ${formatAudio(audio)}`);
  console.log(`${LOG_PREFIX} ${formatMood(mood)}`); // the mood only, never the lyrics
  console.log(`${LOG_PREFIX} matched title: ${result.matchedTitle ?? "(none: no song-level tags)"}`);
  const tagList = result.tags
    .map((tag) => `${tag.name} (${tag.weight.toFixed(2)}${tag.source === "artist" ? ", via artist" : ""})`)
    .join(", ");
  console.log(`${LOG_PREFIX} tags: ${tagList || "(none)"}`);

  return { track, tags: result.tags, audio, mood };
}

// The seed's lyrics mood: from the mood cache if a scan already looked it up,
// otherwise from Spotify (and then cached). A lyrics problem shouldn't stop
// the page: the mood is just "unknown".
async function seedMood(uri: string): Promise<MoodProfile | null> {
  const cache = new MoodCache(loadMoodCacheText());
  const cached = cache.get(uri, Date.now());
  if (cached !== undefined) return cached;
  try {
    const mood = await getLyricsMood(uri);
    cache.set(uri, mood, Date.now());
    saveMoodCacheText(cache.toJSON(Date.now()));
    return mood;
  } catch (error) {
    console.warn(`${LOG_PREFIX} lyrics mood failed`, error);
    return null;
  }
}

// Read every song in the chosen sources, then get tags, BPM/key and mood.
// READ-ONLY: the sources are only read.
export async function runScan(
  sources: SourceOption[],
  onProgress: (progress: ScanProgress) => void,
  shouldStop: () => boolean
): Promise<ScanOutcome> {
  const apiKey = getLastfmKey();
  if (!apiKey) throw new LastfmError(10, "No Last.fm key saved");

  // All playlists at once; each is one fast Spotify request.
  const lists = await Promise.all(sources.map((source) => getSourceTracks(source.uri)));
  const { tracks, duplicates } = mergeTracks(lists);
  console.log(`${LOG_PREFIX} scanning ${tracks.length} songs (${duplicates} duplicates removed)`);
  onProgress({ done: 0, total: tracks.length, fromCache: 0, failed: 0 });

  const fetchers = shareArtistLookups(lastfmFetchers(apiKey, createRateLimiter(LASTFM_REQUESTS_PER_SECOND)));
  const cache = new TagCache(loadTagCacheText());
  const moodCache = new MoodCache(loadMoodCacheText());
  const waitForLyrics = createRateLimiter(LYRICS_REQUESTS_PER_SECOND);
  const lyricsMood = pausingLyricsMood(Date.now);
  const started = Date.now();
  const result = await scanSongs(
    tracks,
    {
      getAudio: getAudioAttributes,
      getTags: (song) => getSongTags(song, fetchers),
      cache,
      saveCache: () => saveTagCacheText(cache.toJSON(Date.now())),
      clock: realClock,
      isFatal: isKeyProblem,
      isRateLimit,
      mood: {
        get: async (uri) => {
          await waitForLyrics();
          return lyricsMood(uri);
        },
        cache: moodCache,
        save: () => saveMoodCacheText(moodCache.toJSON(Date.now())),
      },
    },
    onProgress,
    shouldStop
  );
  console.log(
    `${LOG_PREFIX} scan ${result.cancelled ? "cancelled" : "finished"}: ${result.songs.length} songs in ${Math.round(
      (Date.now() - started) / 1000
    )} s`
  );
  return { ...result, duplicates };
}

// Creates the NEW playlist: seed first, then the picks best-first.
// All writing happens in src/spotify/write.ts. Returns the new playlist's URI.
export async function createFromPreview(choice: {
  name: string;
  seed: SeedData;
  kept: SourcedTag[];
  sources: SourceOption[];
  songs: RankedSong[];
}): Promise<string> {
  const { name, seed, kept, sources, songs } = choice;
  const trackUris = [seed.track.uri, ...songs.map((song) => song.uri)];
  console.log(
    `${LOG_PREFIX} creating "${name}" with ${trackUris.length} songs ` +
      `(tags: ${kept.map((tag) => tag.name).join(", ")}; from: ${sources.map((s) => s.name).join(", ")})`
  );
  const playlistUri = await createPrismPlaylist(name, trackUris);
  console.log(`${LOG_PREFIX} created ${playlistUri}`);
  rememberPlaylist(playlistUri, choice);
  return playlistUri;
}

// Saves how this playlist was made (tags, counts) for the stats page. Only
// in Spotify's LocalStorage on this computer. If it fails, the playlist is
// still fine: the stats page just won't know about it.
function rememberPlaylist(uri: string, choice: { name: string; seed: SeedData; kept: SourcedTag[]; songs: RankedSong[] }) {
  try {
    const { track, tags, audio, mood } = choice.seed;
    const record = buildRecord({
      uri,
      name: choice.name,
      createdAt: Date.now(),
      seed: { uri: track.uri, name: track.name, artists: track.artists, durationMs: track.durationMs, tags, audio, mood },
      keptTags: choice.kept,
      songs: choice.songs,
    });
    savePlaylistRecordsText(JSON.stringify(addRecord(parseRecords(loadPlaylistRecordsText()), record)));
    // Tell the always-on script (same window) so the new playlist's sidebar
    // row gets its purple hover straight away (src/ui/prismRows.ts).
    window.dispatchEvent(new Event(RECORDS_CHANGED_EVENT));
  } catch (error) {
    console.warn(`${LOG_PREFIX} couldn't save the playlist record`, error);
  }
}

// Stats for a playlist (the stats page). Prism playlists made since records
// were saved have one; for any other playlist, work out an ESTIMATE from songs
// Prism has scanned before: read the playlist's songs (read-only), look their
// tags and moods up in the scan caches, and get BPM/key from Spotify.
// Nothing is sent to Last.fm.
export async function loadPlaylistStats(uri: string): Promise<PrismPlaylistRecord> {
  const saved = parseRecords(loadPlaylistRecordsText())[uri];
  if (saved) return saved;
  const [name, tracks] = await Promise.all([getPlaylistName(uri), getSourceTracks(uri)]);
  const now = Date.now();
  const tagCache = new TagCache(loadTagCacheText());
  const moodCache = new MoodCache(loadMoodCacheText());
  const audio = await getAudioAttributes(tracks.map((track) => track.uri));
  return estimateRecord({
    uri,
    name: name ?? "This playlist",
    songs: tracks.map((track) => ({
      uri: track.uri,
      name: track.name,
      durationMs: track.durationMs,
      tags: tagCache.get(track.uri, now)?.tags ?? null,
      audio: audio.get(track.uri) ?? null,
      mood: moodCache.get(track.uri, now) ?? null,
    })),
  });
}

// Turns known errors into messages a user can act on (shown on the page).
// (Last.fm error 6 "not found" never gets here: getSongTags treats it as "no tags".)
export function friendlyError(error: unknown): string {
  if (isKeyProblem(error)) {
    return "Last.fm API key problem: check Playlist Prism settings (the Settings button at the top of this page).";
  }
  if (isRateLimit(error)) {
    return "Last.fm rate limit hit: wait a minute and try again.";
  }
  if (error instanceof PrismWriteError) return error.message; // already written for the user
  return "Something went wrong. Details are in the console.";
}
