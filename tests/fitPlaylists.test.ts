import { describe, expect, test } from "vitest";
import { fitPercent, hasSong, MIN_KNOWN, playlistFit, rankPlaylists, type CandidatePlaylist, type FitSong } from "../src/addto/fitPlaylists";

const tag = (name: string, weight = 1) => ({ name, weight, source: "song" as const });
let n = 0;
const song = (tags: string[], extra: Partial<FitSong> = {}): FitSong => ({
  uri: `spotify:track:s${++n}`,
  name: `Song ${n}`,
  artists: [`Artist ${n}`],
  tags: tags.map((t) => tag(t)),
  audio: null,
  ...extra,
});
const playlist = (name: string, songs: FitSong[]): CandidatePlaylist => ({ uri: `spotify:playlist:${name}`, name, songs });

const target = song(["dark r&b", "sexy"]);

describe("playlistFit", () => {
  test("a playlist of the same vibe fits well", () => {
    const fit = playlistFit(target, playlist("Dark", [song(["dark r&b", "sexy"]), song(["dark r&b"]), song(["sexy", "dark r&b"])]));
    expect(fit!.score).toBeGreaterThan(0.6);
    expect(fit!.reasons[0]).toBe("dark r&b");
  });

  test("needs at least MIN_KNOWN songs with tags", () => {
    const songs = Array.from({ length: MIN_KNOWN - 1 }, () => song(["dark r&b"]));
    expect(playlistFit(target, playlist("Few", [...songs, song([]), song([])]))).toBeNull();
  });

  test("no shared tags = no fit", () => {
    expect(playlistFit(target, playlist("Rock", [song(["rock"]), song(["metal"]), song(["punk"])]))).toBeNull();
  });

  test("a mixed playlist is judged by its best part, not dragged down by the rest", () => {
    const mixed = [song(["dark r&b", "sexy"]), song(["dark r&b", "sexy"]), song(["dark r&b", "sexy"]), ...Array.from({ length: 9 }, () => song(["rock"]))];
    const fit = playlistFit(target, playlist("Mixed", mixed))!;
    expect(fit.score).toBeGreaterThan(0.75);
    expect(fit.known).toBe(12);
  });

  test("a playlist that mostly shares the genre beats one with a few strays", () => {
    const pop = song(["pop"]);
    const popList = playlist("Pop", Array.from({ length: 12 }, () => song(["pop"])));
    const jazzList = playlist("Jazz", [...Array.from({ length: 3 }, () => song(["pop"])), ...Array.from({ length: 9 }, () => song(["jazz"]))]);
    expect(rankPlaylists(pop, [jazzList, popList]).map((f) => f.name)).toEqual(["Pop", "Jazz"]);
  });
});

describe("rankPlaylists", () => {
  test("best first, top 5, playlists that already have the song left out", () => {
    const strong = [song(["dark r&b", "sexy"]), song(["dark r&b", "sexy"]), song(["dark r&b", "sexy"])];
    const weak = [song(["r&b"]), song(["r&b"]), song(["r&b"])];
    const lists = [
      playlist("Weak", weak),
      playlist("Strong", strong),
      playlist("Has it", [...strong, target]),
      ...["A", "B", "C", "D", "E"].map((name) => playlist(name, weak)),
    ];
    const ranked = rankPlaylists(target, lists);
    expect(ranked).toHaveLength(5);
    expect(ranked[0].name).toBe("Strong");
    expect(ranked.map((r) => r.name)).not.toContain("Has it");
    expect(ranked.slice(1).map((r) => r.name)).toEqual(["A", "B", "C", "D"]); // ties by name, cut at 5
  });
});

describe("hasSong", () => {
  test("same title + main artist on another album counts", () => {
    const copy = { ...song([]), name: target.name + " - Remastered", artists: target.artists };
    expect(hasSong(playlist("P", [copy]), target)).toBe(true);
  });
});

test("fitPercent rounds", () => {
  expect(fitPercent(0.916)).toBe("92%");
});
