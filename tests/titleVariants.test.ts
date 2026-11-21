// Unit tests for title cleanup. Run with: npm test
// Each row: [Spotify title, titles we expect to try on Last.fm, in order].

import { describe, expect, test } from "vitest";
import { titleVariants } from "../src/tags/titleVariants";

describe("titleVariants", () => {
  test.each([
    // Plain titles: nothing to clean, so only one variant.
    ["Often", ["Often"]],
    ["Marvins Room", ["Marvins Room"]],
    ["Couldn’t Make It Any Harder", ["Couldn’t Make It Any Harder"]],

    // The real failure from step 3: feat. AND a version marker.
    ["Snooze (Acoustic) (feat. Justin Bieber)", ["Snooze (Acoustic) (feat. Justin Bieber)", "Snooze (Acoustic)", "Snooze"]],

    // Featured-artist credits, several spellings.
    ["Levitating (feat. DaBaby)", ["Levitating (feat. DaBaby)", "Levitating"]],
    ["Peaches [feat. Daniel Caesar & Giveon]", ["Peaches [feat. Daniel Caesar & Giveon]", "Peaches"]],
    ["Stay ft. Justin Bieber", ["Stay ft. Justin Bieber", "Stay"]],
    ["Run (with Someone)", ["Run (with Someone)", "Run"]],
    // Real title from testing: the bracketed "(with ...)" goes, the "With" in the name stays.
    ["Dancing With A Stranger (with Normani)", ["Dancing With A Stranger (with Normani)", "Dancing With A Stranger"]],

    // Version markers after a dash or in brackets.
    ["Let It Be - Remastered 2009", ["Let It Be - Remastered 2009", "Let It Be"]],
    ["Wonderwall (2014 Remaster)", ["Wonderwall (2014 Remaster)", "Wonderwall"]],
    ["Blinding Lights - Radio Edit", ["Blinding Lights - Radio Edit", "Blinding Lights"]],
    ["Hey Jude - Live at Wembley", ["Hey Jude - Live at Wembley", "Hey Jude"]],
    ["Don't Start Now - Purple Disco Machine Remix", ["Don't Start Now - Purple Disco Machine Remix", "Don't Start Now"]],
    ["Love Story (Taylor's Version)", ["Love Story (Taylor's Version)", "Love Story"]],
  ])("%s", (title, expected) => {
    expect(titleVariants(title)).toEqual(expected);
  });

  // Things that LOOK like markers but are part of the real title.
  test.each([
    ["Live Without A System"], // "Live" is a normal word here, not "(Live)"
    ["Mixed Feelings"], // "mix" only matches as a whole word
    ["Edit the World"],
    ["Part 1 - The Beginning"], // dash, but no version word after it
  ])("leaves '%s' alone", (title) => {
    expect(titleVariants(title)).toEqual([title]);
  });

  test("never returns an empty title", () => {
    expect(titleVariants("(Live)")).toEqual(["(Live)"]);
  });

  test("tidies extra spaces", () => {
    expect(titleVariants("  Often  ")).toEqual(["Often"]);
  });
});
