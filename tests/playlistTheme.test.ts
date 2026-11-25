// Unit tests for playlist themes (pure parts). Run with: npm test

import { describe, expect, test } from "vitest";
import { LYRICS_LINE_COLOURS, PLAYLIST_THEMES, effectiveTheme, parseThemeOverrides, withThemeOverride, genreColours, genreMix, mainGenre, mixCaption, parsePlaylistTheme, themedPageKind } from "../src/theme/playlistTheme";

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
    expect(parsePlaylistTheme("volcano")).toBe("none");
    expect(parsePlaylistTheme("ocean")).toBe("none"); // Ocean was removed 2026-11-25: old saves fall back
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
  test("an artist's Show all pages get the artist page's sky", () => {
    const artist = "/artist/09BQyf74gmKlaDkWdbdbqY";
    for (const sub of ["discography", "discography/all", "discography/album", "discography/single", "related", "appears-on", "featuring", "discovered-on", "playlists"]) {
      expect(themedPageKind(`${artist}/${sub}`)).toBe("sky");
    }
    expect(themedPageKind(`${artist}/something-else`)).toBe(null);
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
  test("What's New, Live Events and Podcast Charts get the browse sky", () => {
    expect(themedPageKind("/content-feed")).toBe("browse");
    expect(themedPageKind("/concerts")).toBe("browse");
    expect(themedPageKind("/podcastcharts")).toBe("browse");
    expect(themedPageKind("/podcastcharts/top/ca")).toBe("browse");
    expect(themedPageKind("/concerts/somewhere")).toBe(null);
    expect(themedPageKind("/marketplace")).toBe("browse");
    expect(themedPageKind("/marketplace/settings")).toBe("browse");
  });
  test("Settings gets its own still kind", () => {
    expect(themedPageKind("/preferences")).toBe("settings");
    expect(themedPageKind("/preferences/")).toBe("settings");
  });
  test("profiles and their Show all pages get the profile kind", () => {
    expect(themedPageKind("/user/someone")).toBe("profile");
    expect(themedPageKind("/user/12159898392/")).toBe("profile");
    expect(themedPageKind("/user/some.one_x-1/followers")).toBe("profile");
    expect(themedPageKind("/user/someone/following")).toBe("profile");
    expect(themedPageKind("/user/someone/top/artists")).toBe("profile");
    expect(themedPageKind("/user/someone/top/tracks")).toBe("profile");
    expect(themedPageKind("/user/someone/playlists")).toBe("profile");
  });
  test("podcast shows and episodes get the podcast kind", () => {
    expect(themedPageKind("/show/3IM0lmZxpFAY7CwMuv9H4g")).toBe("podcast");
    expect(themedPageKind("/episode/4v5XrpL3Iw2soqXZSDNscC/")).toBe("podcast");
  });
  test("other pages are left alone", () => {
    for (const path of [undefined, "", "/searching", "/index.html", "/collection", "/playlist-prism", "/genre", "/genre/x/y", "/preferences/advanced", "/preferencesx", "/user", "/user/", "/user/someone/other", "/user/someone/top", "/show/x", "/show/3IM0lmZxpFAY7CwMuv9H4g/episodes"]) {
      expect(themedPageKind(path)).toBeNull();
    }
  });
});

describe("LYRICS_LINE_COLOURS", () => {
  test("every theme (except No theme) has lyric line colours", () => {
    for (const { id } of PLAYLIST_THEMES) {
      if (id === "none") continue;
      expect(LYRICS_LINE_COLOURS[id].passed).toMatch(/^#/);
      expect(LYRICS_LINE_COLOURS[id].inactive).toMatch(/^rgba\(/);
    }
  });
});

describe("themes for single playlists (14b)", () => {
  const A = "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M";
  const B = "spotify:playlist:5nR6DVire9op0SxTxFNlQZ";
  test("parseThemeOverrides keeps only playlists with known themes", () => {
    expect(parseThemeOverrides(null)).toEqual({});
    expect(parseThemeOverrides("not json")).toEqual({});
    expect(parseThemeOverrides("[1,2]")).toEqual({});
    expect(parseThemeOverrides(JSON.stringify({ [A]: "rain", [B]: "volcano", "spotify:album:x": "rain", [`${A}x`]: 3 }))).toEqual({ [A]: "rain" });
    expect(parseThemeOverrides(JSON.stringify({ [A]: "none" }))).toEqual({ [A]: "none" });
  });
  test("withThemeOverride sets and removes without changing the original", () => {
    const start = { [A]: "rain" as const };
    const set = withThemeOverride(start, B, "blossom");
    expect(set).toEqual({ [A]: "rain", [B]: "blossom" });
    expect(withThemeOverride(set, A, null)).toEqual({ [B]: "blossom" });
    expect(start).toEqual({ [A]: "rain" });
  });
  test("effectiveTheme: the playlist's own theme wins, else the main one", () => {
    const o = { [A]: "blossom" as const, [B]: "none" as const };
    expect(effectiveTheme("nebula", o, A)).toBe("blossom");
    expect(effectiveTheme("nebula", o, B)).toBe("none");
    expect(effectiveTheme("nebula", o, "spotify:playlist:other")).toBe("nebula");
    expect(effectiveTheme("none", o, A)).toBe("blossom");
    expect(effectiveTheme("twilight", o, null)).toBe("twilight");
  });
});
