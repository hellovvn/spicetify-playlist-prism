// Genre labels for the preview list (pure, unit-tested in tests/tagLabels.test.ts).
//
// Each tag gets a colour from a small pastel palette that fits the purple
// theme. The colour comes from the tag's NAME, so "r&b" is the same colour on
// every row and every time, without storing anything.

import type { SourcedTag } from "../tags/combineTags";

// Soft pastel colours that sit well on the purple background (made lighter
// 2026-11-22 to match the theme; the bubbles, bars and tag dots all use them).
export const TAG_PALETTE = [
  "#ffb8d9", // pink
  "#a9cdff", // sky blue
  "#ffe2a8", // honey
  "#a8ecc9", // mint
  "#d5c2ff", // lavender
  "#ffc6ad", // peach
  "#a6eaf2", // aqua
  "#f5baff", // orchid
  "#d6f5a6", // lime
  "#ffb3b3", // coral
  "#b9bfff", // periwinkle
] as const;

// Colours for several tags shown together (one stats page, one side panel):
// each tag starts from its usual colour, but if another tag on the same view
// already has it, it moves to the next free palette colour. So two genres
// never share a colour on one page (e.g. "alternative" and "indie" were
// both mint). The first tag listed keeps its usual colour, so pass the most
// important tags first.
export function tagColours(names: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const name of names) {
    if (result.has(name)) continue;
    const start = TAG_PALETTE.indexOf(tagColour(name) as (typeof TAG_PALETTE)[number]);
    let pick: string = TAG_PALETTE[start];
    for (let step = 0; step < TAG_PALETTE.length; step++) {
      const candidate = TAG_PALETTE[(start + step) % TAG_PALETTE.length];
      if (!used.has(candidate)) {
        pick = candidate;
        break;
      }
    }
    used.add(pick);
    result.set(name, pick);
  }
  return result;
}

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
