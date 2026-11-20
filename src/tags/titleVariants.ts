// Title cleanup for Last.fm lookups.
//
// Spotify titles often carry extras Last.fm doesn't use, so the lookup finds
// nothing. Real example: "Snooze (Acoustic) (feat. Justin Bieber)" -> 0 tags.
//
// titleVariants() returns titles to try IN ORDER, from exact to most cleaned:
//   1. the title as-is              (best when Last.fm has this exact version)
//   2. without "feat./with" credits
//   3. also without version markers (remaster, live, acoustic, remix, ...)
// Duplicates are removed, so a plain title returns just [title].
//
// Pure function: no network, easy to unit-test (tests/titleVariants.test.ts).

// Words that mark a "version" of a song rather than a different song.
// \b = word boundary, so "mix" doesn't match inside "mixed" or "remixes".
const VERSION_WORDS =
  "remaster|remastered|live|radio edit|edit|mono|stereo|version|acoustic|demo|remix|mix|" +
  "sped up|slowed|instrumental|single|deluxe|bonus|edition|re recorded|re-recorded|taylor's version";

// "(feat. X)", "[ft. X]", "(with X)", "(featuring X)"
const BRACKET_FEAT = /\s*[([](?:feat\.?|ft\.?|featuring|with)\s[^)\]]*[)\]]/gi;
// " feat. X" at the end, without brackets
const TRAILING_FEAT = /\s+(?:feat\.?|ft\.?|featuring)\s.*$/i;
// "(Acoustic)", "[2019 Remaster]", "(Live at Wembley)"
const BRACKET_VERSION = new RegExp(`\\s*[(\\[][^)\\]]*\\b(?:${VERSION_WORDS})\\b[^)\\]]*[)\\]]`, "gi");
// " - Remastered 2011", " - Radio Edit", " - Live"
const DASH_VERSION = new RegExp(`\\s+[-–—]\\s+[^-–—]*\\b(?:${VERSION_WORDS})\\b.*$`, "i");

function tidy(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

export function removeFeatures(title: string): string {
  return tidy(title.replace(BRACKET_FEAT, "").replace(TRAILING_FEAT, ""));
}

export function removeVersionMarkers(title: string): string {
  return tidy(title.replace(BRACKET_VERSION, "").replace(DASH_VERSION, ""));
}

export function titleVariants(title: string): string[] {
  const original = tidy(title);
  const noFeat = removeFeatures(original);
  const noVersion = removeVersionMarkers(noFeat);

  const result: string[] = [];
  for (const candidate of [original, noFeat, noVersion]) {
    // Skip empty results (e.g. a title that was ONLY "(Live)") and repeats.
    if (candidate && !result.includes(candidate)) result.push(candidate);
  }
  return result;
}
