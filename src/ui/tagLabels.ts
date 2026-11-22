// Genre labels for the preview list (pure, unit-tested in tests/tagLabels.test.ts).
//
// Each tag gets a colour from a small pastel palette that fits the purple
// theme. The colour comes from the tag's NAME, so "r&b" is the same colour on
// every row and every time, without storing anything.

import type { SourcedTag } from "../tags/combineTags";

// Pastel colours that sit well on the purple background.
export const TAG_PALETTE = [
  "#ff8cc3", // pink
  "#78b4ff", // sky blue
  "#ffcd6e", // honey
  "#6ee1aa", // mint
  "#be9bff", // lavender
  "#ffa07a", // peach
  "#5fd7e6", // aqua
  "#f08cff", // orchid
] as const;

// Turns a tag name into a palette colour. A "hash": the same text always
// gives the same number, and different texts usually give different ones.
// Capitals and spaces at the ends don't matter ("R&B " = "r&b").
export function tagColour(name: string): string {
  const text = name.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    // Multiply by 31 and add the character code; `| 0` keeps it a whole
    // 32-bit number so it never grows huge.
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

export interface TagLabel {
  name: string;
  colour: string;
  shared: boolean; // the seed has this tag too (it's why the song matched)
}

// The labels one row shows: the tags it SHARES with the seed first (bright),
// then its other tags (faint), at most `max` in total so rows stay one line.
export function labelsFor(matchedTags: string[], songTags: SourcedTag[], max = 4): TagLabel[] {
  const shared = matchedTags.map((name) => ({ name, colour: tagColour(name), shared: true }));
  const matched = new Set(matchedTags.map((name) => name.toLowerCase()));
  const extra = songTags
    .filter((tag) => !matched.has(tag.name.toLowerCase()))
    .map((tag) => ({ name: tag.name, colour: tagColour(tag.name), shared: false }));
  return [...shared, ...extra].slice(0, max);
}
