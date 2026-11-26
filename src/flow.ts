// The Prism flow's "work" (no UI): load the seed, scan the sources, create
// the playlist. The page (src/ui/PrismPage.tsx) calls these.
//
// Moved here from the old entry file in step 12a, when Prism became
// its own page. READ-ONLY except createFromPreview, which writes ONLY through
// src/spotify/write.ts.

import { getPlaylistName, getSources, getSourceTracks, getTrackInfo } from "./spotify/read";
import { searchTracks } from "./spotify/search";
import { getArtistTopTracks, getSimilarArtists, getSimilarTracks, LastfmError } from "./lastfm/client";
import { bestSearchHit, pickCandidates, type FoundTrack, type SimilarSong } from "./discover/discover";
import { scoreSong, tagMatch } from "./scoring/score";
import { addSongToPlaylist, createMergedPlaylist, createPrismPlaylist, PrismWriteError, type MergeResult } from "./spotify/write";
import { hasSong, rankPlaylists, type CandidatePlaylist, type FitSong, type PlaylistFit } from "./addto/fitPlaylists";
import type { TrackInfo } from "./spotify/read";
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
  loadTonesText,
  saveTonesText,
} from "./storage";
import {
  parseTones,
  scoreAgainstTone,
  toneFromGrow,
  toneSummary,
  withTone,
  TONES_CHANGED_EVENT,
  type PlaylistTone,
  type PlaylistTones,
  type ToneSummary,
} from "./tone/tone";
import {
  addRecord,
  buildOrganizeRecord,
  buildRecord,
  estimateRecord,
  parseRecords,
  type PrismPlaylistRecord,
  RECORDS_CHANGED_EVENT,
} from "./stats/playlistStats";
import { mergeTracks, type ScanTrack } from "./scan/tracks";
import { scanSongs, shareArtistLookups, tagStatusOf, type ScanProgress, type ScannedSong } from "./scan/scan";
import { createRateLimiter, realClock, runPool } from "./scan/limits";
import { TagCache } from "./scan/tagCache";
import { MoodCache } from "./scan/moodCache";
import { getLyricsMood, pausingLyricsMood } from "./spotify/lyrics";
import { formatMood, type MoodProfile } from "./mood/lyricsMood";
import { getSongTags } from "./tags/getSongTags";
import { formatAudio, getAudioAttributes } from "./spotify/audio";
import { playlistExtras, type PlaylistExtras } from "./stats/playlistExtras";
import type { SourceOption } from "./sources/sources";
import type { SourcedTag } from "./tags/combineTags";
import { songKey, type RankedSong } from "./scoring/rank";
import { playlistOrder } from "./scoring/playlistOrder";
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
  const result = await scanTracks(tracks, apiKey, onProgress, shouldStop);
  return { ...result, duplicates };
}

// Tags, BPM/key and lyrics mood for these songs (cached songs need no
// Last.fm request). Shared by every scan: Grow, Remix and playlist tones.
async function scanTracks(
  tracks: ScanTrack[],
  apiKey: string,
  onProgress: (progress: ScanProgress) => void,
  shouldStop: () => boolean
) {
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
  return result;
}

// ----- Playlist tones (src/tone/tone.ts) -----
// The playlist's songs with their tags, BPM and lyrics mood, for the tone
// editor and the Tone view. READ-ONLY. Songs scanned before come from the
// caches at once; the rest are looked up (Last.fm + Spotify) and cached.
// Without a Last.fm key it only uses what's cached.
export async function loadToneSongs(
  uri: string,
  onProgress: (progress: ScanProgress) => void = () => {},
  shouldStop: () => boolean = () => false
): Promise<ScannedSong[]> {
  const tracks = await getSourceTracks(uri);
  const apiKey = getLastfmKey();
  if (apiKey) return (await scanTracks(tracks, apiKey, onProgress, shouldStop)).songs;
  const now = Date.now();
  const tagCache = new TagCache(loadTagCacheText());
  const moodCache = new MoodCache(loadMoodCacheText());
  const audio = await getAudioAttributes(tracks.map((t) => t.uri)).catch(() => new Map());
  return tracks.map((track) => {
    const tags = tagCache.get(track.uri, now)?.tags ?? [];
    return { ...track, tags, audio: audio.get(track.uri) ?? null, mood: moodCache.get(track.uri, now) ?? null, tagStatus: tagStatusOf(tags) };
  });
}

export function loadTones(): PlaylistTones {
  return parseTones(loadTonesText());
}

// Saves (or, with null, removes) a playlist's tone. Only in LocalStorage on
// this computer; the playlist itself is never touched.
export function saveTone(uri: string, tone: PlaylistTone | null): void {
  saveTonesText(JSON.stringify(withTone(loadTones(), uri, tone)));
  window.dispatchEvent(new Event(TONES_CHANGED_EVENT));
}

export { TONES_CHANGED_EVENT };

// "Tone fit" for the stats page and side panel: the playlist's songs scored
// against its tone (null = no tone set). Uses loadToneSongs, so songs are
// usually cached by the Tone view already. Remembered per tone version.
const toneFitCache = new Map<string, Promise<ToneSummary | null>>();

export function loadToneFit(uri: string): Promise<ToneSummary | null> {
  const tone = loadTones()[uri];
  if (!tone) return Promise.resolve(null);
  const key = `${uri}|${tone.updatedAt}`;
  const cached = toneFitCache.get(key);
  if (cached) return cached;
  const fit = loadToneSongs(uri).then((songs) =>
    toneSummary(songs.map((s) => scoreAgainstTone(tone, { tags: s.tags, bpm: s.audio?.bpm ?? null, mood: s.mood })))
  );
  toneFitCache.set(key, fit);
  fit.catch(() => toneFitCache.delete(key)); // a failure isn't remembered
  return fit;
}

// ----- DISCOVER: new finds (build plan 14e) -----
// Songs similar to the seed that are NOT in the user's library: Last.fm's
// similar songs -> keep those that share a kept tag -> find them on Spotify.
// READ-ONLY. They only ever go into the NEW playlist (createFromPreview).
// The pure choices (which to look up, matching search results) are in
// src/discover/discover.ts.

export interface NewFindsProgress {
  done: number; // similar songs looked up so far
  total: number;
}

// Answers kept for this session, so Back -> preview again doesn't redo it.
const newFindsCache = new Map<string, RankedSong[]>();

export async function findNewSongs(
  seed: SeedData,
  kept: SourcedTag[],
  onProgress: (progress: NewFindsProgress) => void,
  shouldStop: () => boolean
): Promise<RankedSong[]> {
  const cacheKey = `${seed.track.uri}|${kept.map((tag) => tag.name).join(",")}`;
  const cached = newFindsCache.get(cacheKey);
  if (cached) return cached;
  const apiKey = getLastfmKey();
  if (!apiKey) throw new LastfmError(10, "No Last.fm key saved");
  const wait = createRateLimiter(LASTFM_REQUESTS_PER_SECOND);
  const started = Date.now();

  // 1. Similar songs (or, if Last.fm has none, similar artists' top songs).
  const artist = seed.track.artists[0] ?? "";
  await wait();
  let similar = await notFoundIsEmpty(getSimilarTracks(artist, seed.track.name, apiKey));
  if (similar.length === 0) similar = await similarFromArtists(artist, apiKey, wait);

  // 2. Skip the seed and anything already in the library.
  const library = await libraryIndex();
  const candidates = pickCandidates(similar, { seed: seed.track, libraryKeys: library.keys });
  onProgress({ done: 0, total: candidates.length });

  // 3. Tags (must share a kept tag, like every Prism song), then Spotify.
  const fetchers = shareArtistLookups(lastfmFetchers(apiKey, wait));
  const found = new Map<string, { similar: SimilarSong; track: FoundTrack; tags: SourcedTag[] }>();
  let done = 0;
  await runPool(
    candidates,
    3,
    async (candidate) => {
      try {
        const { tags } = await getSongTags({ name: candidate.name, artists: [candidate.artist] }, fetchers);
        if (tagMatch(kept, tags).score > 0) {
          const hit = bestSearchHit(candidate, await searchTracks(`${candidate.name} ${candidate.artist}`));
          if (hit && !library.uris.has(hit.uri) && !found.has(hit.uri)) found.set(hit.uri, { similar: candidate, track: hit, tags });
        }
      } catch (error) {
        if (isKeyProblem(error)) throw error; // the whole search is pointless
        console.warn(`${LOG_PREFIX} new finds: skipped one song`, error);
      }
      onProgress({ done: ++done, total: candidates.length });
    },
    shouldStop
  );

  // 4. BPM/key, then the same score as library songs (lyrics mood unknown).
  const entries = [...found.values()];
  const audio = await getAudioAttributes(entries.map((e) => e.track.uri)).catch(() => new Map());
  const seedScorable = { tags: kept, audio: seed.audio, mood: seed.mood };
  const songs: RankedSong[] = entries
    .map(({ similar: s, track, tags }) => {
      const songAudio = audio.get(track.uri) ?? null;
      return {
        ...track,
        tags,
        audio: songAudio,
        mood: null,
        tagStatus: tagStatusOf(tags),
        match: scoreSong(seedScorable, { tags, audio: songAudio, mood: null }),
        newFind: { similarity: s.match },
      };
    })
    .sort((a, b) => b.match.score - a.match.score);
  console.log(
    `${LOG_PREFIX} new finds: ${similar.length} similar, ${candidates.length} looked up, ${songs.length} found ` +
      `in ${Math.round((Date.now() - started) / 1000)} s`
  );
  if (!shouldStop()) newFindsCache.set(cacheKey, songs);
  return songs;
}

// Last.fm error 6 ("not found") just means "no similar songs".
async function notFoundIsEmpty<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof LastfmError && error.code === 6) return [];
    throw error;
  }
}

async function similarFromArtists(artist: string, apiKey: string, wait: () => Promise<void>): Promise<SimilarSong[]> {
  await wait();
  const artists = await notFoundIsEmpty(getSimilarArtists(artist, apiKey, 10));
  const songs: SimilarSong[] = [];
  for (const other of artists) {
    await wait();
    const titles = await notFoundIsEmpty(getArtistTopTracks(other.name, apiKey, 3));
    titles.forEach((name) => songs.push({ name, artist: other.name, match: other.match }));
  }
  return songs;
}

// Every song in the user's library (Liked Songs + every playlist), as URIs
// and "same song" keys. READ-ONLY. Remembered for 5 minutes.
let libraryCache: { at: number; index: Promise<{ uris: Set<string>; keys: Set<string> }> } | null = null;

function libraryIndex(): Promise<{ uris: Set<string>; keys: Set<string> }> {
  if (libraryCache && Date.now() - libraryCache.at < EXTRAS_FRESH_MS) return libraryCache.index;
  const index = (async () => {
    const sources = await getSources();
    const lists = await Promise.all(sources.map((source) => getSourceTracks(source.uri).catch(() => [])));
    const uris = new Set<string>();
    const keys = new Set<string>();
    for (const track of ([] as ScanTrack[]).concat(...lists)) {
      uris.add(track.uri);
      keys.add(songKey(track));
    }
    return { uris, keys };
  })();
  libraryCache = { at: Date.now(), index };
  index.catch(() => (libraryCache = null));
  return index;
}

// Creates the NEW playlist: seed first, then the picks SHUFFLED, with any
// new finds spread through it (playlistOrder).
// All writing happens in src/spotify/write.ts. Returns the new playlist's URI.
export async function createFromPreview(choice: {
  name: string;
  seed: SeedData;
  kept: SourcedTag[];
  sources: SourceOption[];
  songs: RankedSong[];
}): Promise<string> {
  const { name, seed, kept, sources, songs } = choice;
  const trackUris = [seed.track.uri, ...playlistOrder(songs).map((song) => song.uri)];
  console.log(
    `${LOG_PREFIX} creating "${name}" with ${trackUris.length} songs ` +
      `(tags: ${kept.map((tag) => tag.name).join(", ")}; from: ${sources.map((s) => s.name).join(", ")})`
  );
  const playlistUri = await createPrismPlaylist(name, trackUris);
  console.log(`${LOG_PREFIX} created ${playlistUri}`);
  rememberPlaylist(playlistUri, choice);
  giveGrowTone(playlistUri, choice);
  return playlistUri;
}

// A grown playlist starts with a tone made from the choices behind it (kept
// chips, the seed's moods, a shared tempo band): see toneFromGrow. Local only
// (prism:tones); if it fails, the playlist is still fine.
function giveGrowTone(uri: string, choice: { seed: SeedData; kept: SourcedTag[]; songs: RankedSong[] }) {
  try {
    const bpms = [choice.seed.audio?.bpm ?? null, ...choice.songs.map((s) => s.audio?.bpm ?? null)];
    saveTone(uri, toneFromGrow({ kept: choice.kept, seedMood: choice.seed.mood, bpms, now: Date.now() }));
  } catch (error) {
    console.warn(`${LOG_PREFIX} couldn't save the playlist's tone`, error);
  }
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
    saveRecord(record);
  } catch (error) {
    console.warn(`${LOG_PREFIX} couldn't save the playlist record`, error);
  }
}

function saveRecord(record: PrismPlaylistRecord) {
  savePlaylistRecordsText(JSON.stringify(addRecord(parseRecords(loadPlaylistRecordsText()), record)));
  // Tell the always-on script (same window), so the side panel picks it up.
  window.dispatchEvent(new Event(RECORDS_CHANGED_EVENT));
}

// Organize (step 13d): creates ONE new playlist for one group, then saves
// its stats record. All writing happens in src/spotify/write.ts (which only
// adds songs to a playlist it just created). Returns the new playlist's URI.
export async function createOrganizedPlaylist(choice: {
  name: string;
  songs: ScannedSong[]; // in the group's order
  labels: string[]; // "built from" on the stats page
  from: string[]; // names of the playlists that were organized
}): Promise<string> {
  const { name, songs, labels, from } = choice;
  console.log(`${LOG_PREFIX} organize: creating "${name}" with ${songs.length} songs (from: ${from.join(", ")})`);
  const uri = await createPrismPlaylist(name, songs.map((s) => s.uri));
  console.log(`${LOG_PREFIX} created ${uri}`);
  try {
    saveRecord(buildOrganizeRecord({ uri, name, createdAt: Date.now(), labels, from, songs }));
  } catch (error) {
    // The playlist is fine; the stats page just won't know how it was made.
    console.warn(`${LOG_PREFIX} couldn't save the playlist record`, error);
  }
  return uri;
}

// Merge playlists: create the merged playlist and (if the switch is on) tag
// the originals' names. Both writes happen in write.ts, guarded.
export async function mergePlaylists(choice: {
  name: string;
  tracks: ScanTrack[];
  sources: SourceOption[];
  renameSources: boolean;
}): Promise<MergeResult> {
  const { name, tracks, sources, renameSources } = choice;
  console.log(`${LOG_PREFIX} merge: creating "${name}" with ${tracks.length} songs from ${sources.length} playlists (rename: ${renameSources})`);
  const result = await createMergedPlaylist(
    name,
    tracks.map((t) => t.uri),
    sources.map((s) => ({ uri: s.uri, name: s.name, canRename: s.canRename === true })),
    renameSources
  );
  console.log(`${LOG_PREFIX} merged into ${result.uri}; renamed ${result.renamed.length}, not renamed ${result.notRenamed.length}`);
  if (result.renamed.length) window.dispatchEvent(new Event(RECORDS_CHANGED_EVENT)); // the side panel re-checks
  return result;
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

// The side panel's stats for ANY playlist (src/ui/panelHost.tsx). A playlist
// Prism made has a saved record (the panel uses that directly). For any
// other one: an ESTIMATE from the scan caches straight away, then the songs
// that aren't cached yet are scanned (Last.fm tags, BPM/key, lyrics mood,
// all cached for every Prism feature), and the estimate is worked out again
// as the caches fill. Stops when shouldStop() says so (another page, the
// "Now playing" tab...); songs done so far stay cached. Without a Last.fm
// key it only uses what's cached. READ-ONLY: the playlist is never changed.
export interface PanelStatsState {
  record: PrismPlaylistRecord;
  scanning: ScanProgress | null; // null = not scanning (done, or nothing to scan)
}

const PANEL_REBUILD_MS = 3000; // how often the estimate is redone while scanning

export async function loadPanelEstimate(
  uri: string,
  onUpdate: (state: PanelStatsState) => void,
  shouldStop: () => boolean
): Promise<void> {
  const [name, tracks] = await Promise.all([getPlaylistName(uri).catch(() => null), getSourceTracks(uri)]);
  if (shouldStop()) return;
  const audio = await getAudioAttributes(tracks.map((track) => track.uri)).catch(() => new Map<string, never>());
  const build = () => {
    const now = Date.now();
    const tagCache = new TagCache(loadTagCacheText());
    const moodCache = new MoodCache(loadMoodCacheText());
    return {
      record: estimateRecord({
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
      }),
      // Songs with no cached tags, or whose lyrics mood was never looked up
      // (undefined; null = looked up, no mood).
      missing: tracks.filter((track) => !tagCache.get(track.uri, now) || moodCache.get(track.uri, now) === undefined),
    };
  };
  let { record, missing } = build();
  onUpdate({ record, scanning: null });
  const apiKey = getLastfmKey();
  if (!apiKey || missing.length === 0 || shouldStop()) return;

  let rebuiltAt = Date.now();
  await scanTracks(
    missing,
    apiKey,
    (progress) => {
      if (shouldStop()) return;
      if (Date.now() - rebuiltAt > PANEL_REBUILD_MS) {
        record = build().record; // the scan saves the caches every few songs
        rebuiltAt = Date.now();
      }
      onUpdate({ record, scanning: progress });
    },
    shouldStop
  );
  if (shouldStop()) return;
  onUpdate({ record: build().record, scanning: null });
}

// Artists, eras and key for a playlist (stats page and side panel), worked out
// live from the playlist's songs: names, artists and release years from
// Spotify's playlist list, keys from the same lookup as BPM. READ-ONLY.
// Remembered for 5 minutes, so switching between the side panel and the full
// page doesn't load it twice.
const extrasCache = new Map<string, { at: number; extras: Promise<PlaylistExtras> }>();
const EXTRAS_FRESH_MS = 5 * 60 * 1000;

export function loadPlaylistExtras(uri: string): Promise<PlaylistExtras> {
  const cached = extrasCache.get(uri);
  if (cached && Date.now() - cached.at < EXTRAS_FRESH_MS) return cached.extras;
  const extras = (async () => {
    const tracks = await getSourceTracks(uri);
    const audio = await getAudioAttributes(tracks.map((track) => track.uri)).catch(() => new Map());
    return playlistExtras(
      tracks.map((track) => {
        const attrs = audio.get(track.uri) ?? null;
        return { name: track.name, artists: track.artists, year: track.year, key: attrs?.key, mode: attrs?.mode };
      })
    );
  })();
  extrasCache.set(uri, { at: Date.now(), extras });
  extras.catch(() => extrasCache.delete(uri)); // a failure isn't remembered
  return extras;
}

// ----- Add with Prism (src/addto/fitPlaylists.ts) -----
// The top 5 of the user's playlists for one song. READ-ONLY until the user
// clicks a playlist (addSongTo). The library side uses the scan CACHES only
// (nothing sent to Last.fm for it): playlists the user has scanned before are
// judged, others need a scan first. The song itself is looked up if needed.

export interface SongFits {
  song: TrackInfo;
  tagged: boolean; // false = Last.fm has no tags for the song, so nothing can be judged
  fits: PlaylistFit[];
  unjudged: number; // playlists the user can add to but with too few scanned songs
}

// The playlists the user may add to, with their songs and cached signals.
// Remembered for 2 minutes so the right-click menu opens fast; cleared after an add.
const LIBRARY_FRESH_MS = 2 * 60 * 1000;
let library: { at: number; playlists: Promise<CandidatePlaylist[]> } | null = null;

function loadAddableLibrary(): Promise<CandidatePlaylist[]> {
  if (library && Date.now() - library.at < LIBRARY_FRESH_MS) return library.playlists;
  const playlists = (async () => {
    const sources = (await getSources()).filter((s) => s.canAdd && s.uri.startsWith("spotify:playlist:"));
    const lists = await Promise.all(sources.map((s) => getSourceTracks(s.uri)));
    const allUris = [...new Set(([] as ScanTrack[]).concat(...lists).map((t) => t.uri))];
    const audio = await getAudioAttributes(allUris).catch(() => new Map());
    const now = Date.now();
    const tagCache = new TagCache(loadTagCacheText());
    const moodCache = new MoodCache(loadMoodCacheText());
    return sources.map((source, i) => ({
      uri: source.uri,
      name: source.name,
      songs: lists[i].map((t) => ({
        uri: t.uri,
        name: t.name,
        artists: t.artists,
        tags: tagCache.get(t.uri, now)?.tags ?? [],
        audio: audio.get(t.uri) ?? null,
        mood: moodCache.get(t.uri, now) ?? null,
      })),
    }));
  })();
  library = { at: Date.now(), playlists };
  playlists.catch(() => (library = null)); // a failure isn't remembered
  return playlists;
}

// The song's own signals: cached tags if a scan saw it, otherwise Last.fm
// (when a key is saved; the result is cached like a scan's).
async function songSignals(uri: string): Promise<{ track: TrackInfo; song: FitSong }> {
  const track = await getTrackInfo(uri);
  const now = Date.now();
  const tagCache = new TagCache(loadTagCacheText());
  let tags = tagCache.get(uri, now)?.tags ?? null;
  const apiKey = getLastfmKey();
  if (!tags && apiKey) {
    const result = await getSongTags(track, lastfmFetchers(apiKey));
    tags = result.tags;
    tagCache.set(uri, { tags: result.tags, matchedTitle: result.matchedTitle }, now);
    saveTagCacheText(tagCache.toJSON(now));
  }
  const [audioMap, mood] = await Promise.all([getAudioAttributes([uri]).catch(() => new Map()), seedMood(uri)]);
  return { track, song: { uri, name: track.name, artists: track.artists, tags: tags ?? [], audio: audioMap.get(uri) ?? null, mood } };
}

export async function findPlaylistsForSong(uri: string): Promise<SongFits> {
  const [{ track, song }, playlists] = await Promise.all([songSignals(uri), loadAddableLibrary()]);
  const fits = song.tags.length > 0 ? rankPlaylists(song, playlists) : [];
  const unjudged = playlists.filter((p) => p.songs.filter((s) => s.tags.length > 0).length < 3).length;
  console.log(`${LOG_PREFIX} add with Prism: ${track.name}: ${fits.map((f) => `${f.name} ${Math.round(f.score * 100)}%`).join(", ") || "(no fits)"}`);
  return { song: track, tagged: song.tags.length > 0, fits, unjudged };
}

// Adds the song to the END of one playlist the user clicked. The playlist is
// re-read first, so a song added in the meantime is never added twice.
export async function addSongTo(playlist: { uri: string; name: string }, song: { uri: string; name: string; artists: string[] }): Promise<void> {
  const sources = await getSources();
  const source = sources.find((s) => s.uri === playlist.uri);
  const tracks = await getSourceTracks(playlist.uri);
  const already = hasSong({ uri: playlist.uri, name: playlist.name, songs: tracks.map((t) => ({ ...t, tags: [], audio: null })) }, song);
  await addSongToPlaylist({ uri: playlist.uri, name: source?.name ?? playlist.name, canAdd: source?.canAdd === true, hasSong: already }, song.uri);
  library = null; // the next lookup sees the new song
  console.log(`${LOG_PREFIX} added ${song.name} to ${playlist.name}`);
}

// Turns known errors into messages a user can act on (shown on the page).
// (Last.fm error 6 "not found" never gets here: getSongTags treats it as "no tags".)
export function friendlyError(error: unknown): string {
  if (isKeyProblem(error)) {
    return "Last.fm API key problem: check Prism settings (the Settings button at the top of this page).";
  }
  if (isRateLimit(error)) {
    return "Last.fm rate limit hit: wait a minute and try again.";
  }
  if (error instanceof PrismWriteError) return error.message; // already written for the user
  return "Something went wrong. Details are in the console.";
}
