// Unit tests for playlist themes (pure parts). Run with: npm test

import { describe, expect, test } from "vitest";
import { genreColours, genreMix, mainGenre, mixCaption, parsePlaylistTheme, themedPageKind } from "../src/theme/playlistTheme";

const tag = (name: string, weight: number) => ({ name, weight, source: "track" as const });

describe("parsePlaylistTheme", () => {
  test("no theme by default", () => {
    expect(parsePlaylistTheme(null)).toBe("none");
  });
  test("saved themes", () => {
    expect(parsePlaylistTheme("aurora")).toBe("aurora");
    expect(parsePlaylistTheme("stars")).toBe("stars");
    expect(parsePlaylistTheme("nebula")).toBe("nebula");
  });
  test("anything unknown is no theme", () => {
    expect(parsePlaylistTheme("ocean")).toBe("none");
    expect(parsePlaylistTheme("")).toBe("none");
  });
});

describe("mainGenre", () => {
  test("strongest tag wins, lower case", () => {
    expect(mainGenre([tag("Pop", 0.4), tag("R&B", 1)])).toBe("r&b");
  });
  test("personal labels are skipped", () => {
    expect(mainGenre([tag("my top songs", 1), tag("soul", 0.5)])).toBe("soul");
  });
  test("no tags = null", () => {
    expect(mainGenre([])).toBeNull();
    expect(mainGenre(null)).toBeNull();
  });
});

describe("genreMix", () => {
  const mains = ["r&b", "r&b", "pop", null, "soul", "r&b", "pop"];
  test("counts, shares of the scanned songs, top first", () => {
    const mix = genreMix(mains);
    expect(mix.rows.map((r) => [r.name, r.count])).toEqual([["r&b", 3], ["pop", 2], ["soul", 1]]);
    expect(mix.rows[0].share).toBe(50);
    expect(mix.scanned).toBe(6);
    expect(mix.total).toBe(7);
  });
  test("the rest counts as other", () => {
    const mix = genreMix(mains, 2);
    expect(mix.rows).toHaveLength(2);
    expect(mix.otherCount).toBe(1);
  });
  test("ties are alphabetical", () => {
    expect(genreMix(["soul", "jazz"]).rows.map((r) => r.name)).toEqual(["jazz", "soul"]);
  });
});

describe("genreColours", () => {
  test("every genre gets a colour, and no two share one (up to the palette size)", () => {
    const colours = genreColours(["a", "b", "c", "d", "a"]);
    expect(colours.size).toBe(4);
    expect(new Set(colours.values()).size).toBe(4);
  });
});

describe("mixCaption", () => {
  test("nothing scanned", () => {
    expect(mixCaption(genreMix([null, null]))).toMatch(/once Prism has scanned/);
  });
  test("shares, other, and how many songs it's from", () => {
    expect(mixCaption(genreMix(["r&b", "r&b", "pop", "soul", null], 2))).toBe("r&b 50% · pop 25% · other 25% (from 4 of 5 songs)");
  });
  test("all scanned: no 'from' part", () => {
    expect(mixCaption(genreMix(["pop", "pop"]))).toBe("pop 100%");
  });
});

describe("themedPageKind", () => {
  test("playlist pages get the full theme", () => {
    expect(themedPageKind("/playlist/37i9dQZF1DXcBWIGoYBM5M")).toBe("playlist");
    expect(themedPageKind("/playlist/37i9dQZF1DXcBWIGoYBM5M/")).toBe("playlist");
  });
  test("album, artist and Liked Songs pages get the sky", () => {
    expect(themedPageKind("/album/363sBb7ASwFL2Af2hNLu2l")).toBe("sky");
    expect(themedPageKind("/artist/09BQyf74gmKlaDkWdbdbqY")).toBe("sky");
    expect(themedPageKind("/collection/tracks")).toBe("sky");
  });
  test("Home gets the sky band", () => {
    expect(themedPageKind("/")).toBe("band");
  });
  test("Search (Browse all and results) and genre pages get their own kinds", () => {
    expect(themedPageKind("/search")).toBe("search");
    expect(themedPageKind("/search/")).toBe("search");
    expect(themedPageKind("/search/einaudi")).toBe("search");
    expect(themedPageKind("/search/ludovico%20einaudi/tracks")).toBe("search");
    expect(themedPageKind("/genre/0JQ5DAqbMKFEC4WFtoNRpw")).toBe("genre");
  });
  test("other pages are left alone", () => {
    for (const path of [undefined, "", "/searching", "/index.html", "/collection", "/artist/09BQyf74gmKlaDkWdbdbqY/discography", "/playlist-prism", "/genre", "/genre/x/y", "/preferences"]) {
      expect(themedPageKind(path)).toBeNull();
    }
  });
});
