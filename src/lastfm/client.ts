// Last.fm API client (read-only; no Last.fm login needed).
// Docs: https://www.last.fm/api/show/track.getTopTags

const API_ROOT = "https://ws.audioscrobbler.com/2.0/";

// One tag as Last.fm returns it.
// count is a RELATIVE weight: the song's top tag is 100, the rest are
// scaled against it (so 50 means "half as strongly tagged as the top tag").
export interface LastfmTag {
  name: string;
  count: number;
}

// The result of a tag lookup. Last.fm may "autocorrect" the names we send
// (e.g. fix spelling), so we keep the names it actually matched. Comparing
// them with what we asked for helps us debug wrong matches later.
export interface TrackTagsResult {
  tags: LastfmTag[];
  matchedArtist: string;
  matchedTrack: string;
}

// An error that carries Last.fm's numeric error code, so callers can react
// to specific problems. Codes we care about (from the Last.fm docs):
//   6  = track/artist not found      10 = invalid API key
//   26 = API key suspended           29 = rate limit exceeded
export class LastfmError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(`Last.fm error ${code}: ${message}`);
    this.code = code;
  }
}

// Sends one request to Last.fm and returns the parsed JSON.
// Last.fm reports problems as JSON like {"error": 10, "message": "..."},
// sometimes with HTTP 200 and sometimes with 4xx, so we check the body.
async function callLastfm(params: Record<string, string>, apiKey: string): Promise<any> {
  // URLSearchParams builds "a=1&b=2" and safely encodes spaces, &, accents, etc.
  const query = new URLSearchParams({ ...params, api_key: apiKey, format: "json" });
  const response = await fetch(`${API_ROOT}?${query}`);

  // .catch(() => null): if the body isn't valid JSON, use null instead of throwing.
  const data = await response.json().catch(() => null);
  if (!data) {
    throw new LastfmError(-1, `HTTP ${response.status} with no JSON body`);
  }
  if (data.error) {
    throw new LastfmError(data.error, data.message ?? "unknown error");
  }
  return data;
}

// Gets the top tags for one song.
export async function getTrackTopTags(artist: string, track: string, apiKey: string): Promise<TrackTagsResult> {
  const data = await callLastfm(
    { method: "track.getTopTags", artist, track, autocorrect: "1" },
    apiKey
  );

  return {
    tags: parseTagList(data),
    // "@attr" holds the artist/track names Last.fm actually matched.
    matchedArtist: data?.toptags?.["@attr"]?.artist ?? artist,
    matchedTrack: data?.toptags?.["@attr"]?.track ?? track,
  };
}

// Gets the top tags for an ARTIST. Used as a fallback when a song has few or
// no tags of its own. Less precise (one artist, many styles) but much better
// coverage, because artists get tagged far more often than single songs.
export async function getArtistTopTags(artist: string, apiKey: string): Promise<LastfmTag[]> {
  const data = await callLastfm({ method: "artist.getTopTags", artist, autocorrect: "1" }, apiKey);
  return parseTagList(data);
}

// Both tag methods answer in the same shape: data.toptags.tag.
// Quirk: when there is exactly ONE tag, Last.fm's JSON may give a single
// object instead of an array, so we normalize to an array either way.
function parseTagList(data: any): LastfmTag[] {
  const raw = data?.toptags?.tag ?? [];
  const list: any[] = Array.isArray(raw) ? raw : [raw];
  return list.map((tag) => ({ name: String(tag.name), count: Number(tag.count) }));
}

// Checks an API key with one cheap, well-known request.
// Returns null if the key works, or a human-readable problem if not.
export async function testApiKey(apiKey: string): Promise<string | null> {
  try {
    await getTrackTopTags("Cher", "Believe", apiKey);
    return null;
  } catch (error) {
    if (error instanceof LastfmError && error.code === 10) return "Last.fm says this API key is invalid.";
    if (error instanceof LastfmError && error.code === 26) return "This API key has been suspended by Last.fm.";
    return `Couldn't reach Last.fm: ${String(error)}`;
  }
}

// ----- Similar songs (DISCOVER, src/discover/discover.ts) -----
// One similar song: name, artist and Last.fm's match (0..1, 1 = most similar).
export interface LastfmSimilar {
  name: string;
  artist: string;
  match: number;
}

// Songs Last.fm thinks are similar to this one (from listening habits).
export async function getSimilarTracks(artist: string, track: string, apiKey: string, limit = 50): Promise<LastfmSimilar[]> {
  const data = await callLastfm({ method: "track.getSimilar", artist, track, autocorrect: "1", limit: String(limit) }, apiKey);
  return parseSimilarTracks(data);
}

// Fallback when Last.fm knows no similar SONGS: similar ARTISTS (with match)...
export async function getSimilarArtists(artist: string, apiKey: string, limit = 10): Promise<{ name: string; match: number }[]> {
  const data = await callLastfm({ method: "artist.getSimilar", artist, autocorrect: "1", limit: String(limit) }, apiKey);
  return asList(data?.similarartists?.artist)
    .map((a) => ({ name: String(a?.name ?? ""), match: Number(a?.match) || 0 }))
    .filter((a) => a.name);
}

// ...and each one's most played songs.
export async function getArtistTopTracks(artist: string, apiKey: string, limit = 3): Promise<string[]> {
  const data = await callLastfm({ method: "artist.getTopTracks", artist, autocorrect: "1", limit: String(limit) }, apiKey);
  return asList(data?.toptracks?.track).map((t) => String(t?.name ?? "")).filter(Boolean);
}

// data.similartracks.track: [{ name, match, artist: { name } }, ...]
export function parseSimilarTracks(data: any): LastfmSimilar[] {
  return asList(data?.similartracks?.track)
    .map((t) => ({ name: String(t?.name ?? ""), artist: String(t?.artist?.name ?? ""), match: Number(t?.match) || 0 }))
    .filter((t) => t.name && t.artist);
}

// Same quirk as the tag lists: one item may come as an object, not an array.
function asList(raw: any): any[] {
  if (raw === undefined || raw === null) return [];
  return Array.isArray(raw) ? raw : [raw];
}
