// Reads a song's lyrics from Spotify and turns them into a mood profile.
// READ-ONLY. The lyrics text stays inside this function: it is never
// returned, stored, or logged (only the mood profile leaves).
//
// The endpoint is the one Spotify's own lyrics view uses (found in the step-4c
// spike). It's internal and undocumented, so it's kept in this one file.
// Unit-tested with a fake Spotify in tests/lyrics.test.ts.

import { lyricsMood, type MoodProfile } from "../mood/lyricsMood";

const LYRICS_URL = (trackId: string) =>
  `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&market=from_token`;

// A lyrics request that failed for a reason OTHER than "this song has no lyrics"
// (e.g. 429 "too many requests"). Never cached: the next scan tries again.
export class LyricsError extends Error {
  constructor(public code: number | undefined, message: string) {
    super(message);
  }
}

// null = no profile: no lyrics on Spotify (instrumental, or not licensed),
// not English, or too few mood words. Throws LyricsError for anything else.
export async function getLyricsMood(trackUri: string): Promise<MoodProfile | null> {
  const trackId = trackUri.split(":")[2];
  let response: any;
  try {
    response = await Spicetify.CosmosAsync.get(LYRICS_URL(trackId));
  } catch (error: any) {
    response = error; // some versions throw the error object...
  }
  // ...and some RETURN it as a normal answer: { code, error, message }.
  // (Found in step 10: treating that as "no lyrics" wrongly cached hundreds
  // of songs as having no mood during a big scan.)
  const lyrics = response?.lyrics;
  if (!lyrics) {
    if (response?.code === 404) return null; // this song has no lyrics on Spotify
    throw new LyricsError(response?.code, `lyrics request failed (code ${response?.code ?? "unknown"})`);
  }
  if (!Array.isArray(lyrics.lines)) return null;
  const lines: string[] = lyrics.lines.map((line: any) => (typeof line?.words === "string" ? line.words : ""));
  return lyricsMood(lines, lyrics.language);
}

// Spotify allows only a burst of lyrics requests, then answers 429 ("too many
// requests") for a while; retrying made a 227-song scan take 5+ minutes.
// So lyrics are BEST EFFORT: after a 429, every lyrics lookup fails at once
// (without asking Spotify) for `pauseMs`. The scan carries on at full speed,
// those songs get "mood unknown" (not cached), and the next scan fills them in.
export function pausingLyricsMood(
  now: () => number,
  pauseMs = 60_000,
  read: (uri: string) => Promise<MoodProfile | null> = getLyricsMood
): (uri: string) => Promise<MoodProfile | null> {
  let pausedUntil = 0;
  return async (uri) => {
    if (now() < pausedUntil) throw new LyricsError(429, "lyrics paused after a rate limit");
    try {
      return await read(uri);
    } catch (error) {
      if (error instanceof LyricsError && error.code === 429) pausedUntil = now() + pauseMs;
      throw error;
    }
  };
}
