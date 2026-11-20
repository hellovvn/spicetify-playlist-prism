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

  // The tags are in data.toptags.tag. Quirk: when there is exactly ONE tag,
  // Last.fm's JSON may give a single object instead of an array, so we
  // normalize to an array either way.
  const raw = data?.toptags?.tag ?? [];
  const list: any[] = Array.isArray(raw) ? raw : [raw];

  return {
    tags: list.map((tag) => ({ name: String(tag.name), count: Number(tag.count) })),
    // "@attr" holds the artist/track names Last.fm actually matched.
    matchedArtist: data?.toptags?.["@attr"]?.artist ?? artist,
    matchedTrack: data?.toptags?.["@attr"]?.track ?? track,
  };
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
