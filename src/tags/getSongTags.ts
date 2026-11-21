// The full "get usable tags for one song" chain:
//   1. Ask Last.fm for the song's tags, trying each title variant in order
//      ("Snooze (Acoustic) (feat. Justin Bieber)" -> "Snooze (Acoustic)" -> "Snooze")
//      until one gives usable (cleaned) tags.
//   2. If the song still has fewer than 3 usable tags, also fetch the main
//      artist's tags and blend them in at half weight (marked "artist").
//
// DEPENDENCY INJECTION: this function doesn't call Last.fm directly. The
// caller passes in the two fetch functions ("deps"). In the real extension
// those call Last.fm; in unit tests we pass FAKES that return whatever the
// test needs, instantly, with no network and no API key. That's what lets
// us test the retry and fallback logic reliably.

import type { LastfmTag } from "../lastfm/client";
import { LastfmError } from "../lastfm/client";
import { cleanTags, type CleanTag } from "./cleanTags";
import { removeFeatures, removeVersionMarkers, titleVariants } from "./titleVariants";
import { combineTags, needsArtistTags, type SourcedTag } from "./combineTags";

export interface TagFetchers {
  fetchTrackTags: (artist: string, title: string) => Promise<LastfmTag[]>;
  fetchArtistTags: (artist: string) => Promise<LastfmTag[]>;
}

export interface SongTagsResult {
  tags: SourcedTag[];
  // Every title we tried, in order (useful for debugging matches).
  titlesTried: string[];
  // The title that gave usable tags, or null if none did.
  matchedTitle: string | null;
  usedArtistTags: boolean;
}

// Last.fm error 6 = "track/artist not found". For us that just means
// "no tags", so try the next option instead of failing the whole lookup.
// Any OTHER error (bad key, rate limit, network) is a real problem: rethrow.
async function tagsOrEmpty(request: Promise<LastfmTag[]>): Promise<LastfmTag[]> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof LastfmError && error.code === 6) return [];
    throw error;
  }
}

export async function getSongTags(
  song: { name: string; artists: string[] },
  deps: TagFetchers
): Promise<SongTagsResult> {
  const mainArtist = song.artists[0] ?? "";
  const titlesTried: string[] = [];
  let trackTags: CleanTag[] = [];
  let matchedTitle: string | null = null;
  // "Snooze (Acoustic) (feat. Justin Bieber)" -> "Snooze"
  const coreTitle = removeVersionMarkers(removeFeatures(song.name));

  // 1. Title variants, stopping at the first that gives usable tags.
  for (const title of titleVariants(song.name)) {
    titlesTried.push(title);
    const raw = await tagsOrEmpty(deps.fetchTrackTags(mainArtist, title));
    // title: drops tags that just repeat the song's title ("color" on "The Color Violet").
    // We pass the title WITHOUT version markers/feat.: "(Acoustic)" describes
    // the sound, so an "acoustic" tag on "Snooze (Acoustic)" must stay.
    trackTags = cleanTags(raw, { artistNames: song.artists, title: coreTitle });
    if (trackTags.length > 0) {
      matchedTitle = title;
      break;
    }
  }

  // 2. Artist fallback, only when needed (saves a request for well-tagged songs).
  let artistTags: CleanTag[] = [];
  const usedArtistTags = needsArtistTags(trackTags) && mainArtist !== "";
  if (usedArtistTags) {
    const raw = await tagsOrEmpty(deps.fetchArtistTags(mainArtist));
    artistTags = cleanTags(raw, { artistNames: song.artists });
  }

  return {
    tags: combineTags(trackTags, artistTags),
    titlesTried,
    matchedTitle,
    usedArtistTags,
  };
}
