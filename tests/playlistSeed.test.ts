// Unit tests for growing from a playlist seed. Run with: npm test

import { describe, expect, test } from "vitest";
import {
  blendMood,
  blendTags,
  closestSeedSongs,
  playlistSeedMessage,
  scoreAgainstPlaylist,
  tempoRange,
  typicalSongs,
} from "../src/scoring/playlistSeed";
import { mergeSimilar } from "../src/discover/discover";
import { rankWith, songKey } from "../src/scoring/rank";
import type { SourcedTag } from "../src/tags/combineTags";
import type { ScannedSong } from "../src/scan/scan";

const t = (name: string, weight = 1, source: "track" | "artist" = "track"): SourcedTag => ({ name, weight, source });
const audio = (bpm: number, camelot = "8A") => ({ bpm, key: "C", mode: "minor" as const, camelot });
const song = (id: string, tags: SourcedTag[], bpm: number | null = 100, artist = `artist ${id}`): ScannedSong => ({
  uri: `spotify:track:${id}`,
  name: `Song ${id}`,
  artists: [artist],
  tags,
  audio: bpm === null ? null : audio(bpm),
  mood: null,
  tagStatus: tags.length ? "song" : "none",
});

describe("blendTags", () => {
  test("weight = average strength over tagged songs; counts songs; sorted", () => {
    const blend = blendTags([
      song("a", [t("r&b"), t("pop", 0.5)]),
      song("b", [t("r&b", 0.5)]),
      song("c", [t("r&b"), t("pop", 0.5)]),
      song("d", [t("soul")]), // only one song: left out (4 tagged songs)
      song("e", []), // no tags: doesn't count
    ]);
    expect(blend.map((tag) => [tag.name, tag.count])).toEqual([
      ["r&b", 3],
      ["pop", 2],
    ]);
    expect(blend[0].weight).toBeCloseTo(2.5 / 4);
    expect(blend[1].weight).toBeCloseTo(1 / 4);
  });

  test("small playlists keep one-song tags; junk tags are skipped; artist source by majority", () => {
    const blend = blendTags([song("a", [t("soul", 1, "artist"), t("my top songs")]), song("b", [t("soul", 1, "artist")])]);
    expect(blend.map((tag) => tag.name)).toEqual(["soul"]);
    expect(blend[0].source).toBe("artist");
  });

  test("no tagged songs = no chips", () => {
    expect(blendTags([song("a", [])])).toEqual([]);
  });
});

describe("blendMood and tempoRange", () => {
  test("average of known moods; null when none", () => {
    expect(blendMood([{ love: 1 }, { love: 0.5, dark: 0.5 }, null])).toEqual({ love: 0.75, dark: 0.25 });
    expect(blendMood([null, undefined])).toBeNull();
  });

  test("slowest and fastest", () => {
    expect(tempoRange([audio(82.4), null, audio(128)])).toEqual({ min: 82, max: 128 });
    expect(tempoRange([null])).toBeNull();
  });
});

describe("scoreAgainstPlaylist", () => {
  // A mixed playlist: slow r&b and fast rock.
  const seedSongs = [song("r1", [t("r&b")], 70), song("r2", [t("r&b")], 72), song("k1", [t("rock")], 160), song("k2", [t("rock")], 162)];
  const seed = { tags: blendTags(seedSongs), songs: seedSongs };

  test("tempo is compared to the closest seed songs, not the playlist's average", () => {
    const slowRnb = scoreAgainstPlaylist(seed, song("x", [t("r&b")], 71));
    expect(slowRnb.bpmScore).toBeGreaterThan(0.9); // average BPM (116) would give 0
    const fastRnb = scoreAgainstPlaylist(seed, song("y", [t("r&b")], 116));
    expect(fastRnb.score).toBeLessThan(slowRnb.score);
  });

  test("no shared genre with the kept chips = no match", () => {
    const onlyRnb = { tags: [t("r&b")], songs: seedSongs };
    expect(scoreAgainstPlaylist(onlyRnb, song("z", [t("rock")], 160)).score).toBe(0);
  });

  test("closest songs: most shared tags first, then tempo", () => {
    const closest = closestSeedSongs(seedSongs, song("x", [t("rock")], 161), 2);
    expect(closest.map((s) => s.uri)).toEqual(["spotify:track:k2", "spotify:track:k1"]);
  });
});

describe("typicalSongs", () => {
  test("most of the kept genres first, one per artist, skips songs sharing none", () => {
    const songs = [
      song("a", [t("r&b"), t("soul")], 100, "A"),
      song("b", [t("r&b"), t("soul")], 100, "A"), // same artist: skipped
      song("c", [t("r&b")], 100, "C"),
      song("d", [t("rock")], 100, "D"),
    ];
    const picked = typicalSongs(songs, [t("r&b"), t("soul")]);
    expect(picked.map((s) => s.uri)).toEqual(["spotify:track:a", "spotify:track:c"]);
  });
});

describe("rankWith", () => {
  test("songs from the seed playlist are left out by URI and by same-song key", () => {
    const seedSong = song("s", [t("r&b")]);
    const sameSongOtherAlbum = { ...song("s2", [t("r&b")]), name: seedSong.name, artists: seedSong.artists };
    const other = song("o", [t("r&b")]);
    const ranking = rankWith(() => ({ score: 0.5, tagScore: 0.5, bpmScore: null, keyScore: null, moodScore: null, matchedTags: [] }), [seedSong, sameSongOtherAlbum, other], {
      uris: new Set([seedSong.uri]),
      keys: new Set([songKey(seedSong)]),
    });
    expect(ranking.matches.map((s) => s.uri)).toEqual([other.uri]);
  });
});

describe("mergeSimilar", () => {
  test("one entry per song with its best match, most similar first", () => {
    const merged = mergeSimilar([
      [{ name: "Up", artist: "X", match: 0.4 }],
      [
        { name: "Up", artist: "x", match: 0.9 },
        { name: "Down", artist: "Y", match: 0.5 },
      ],
    ]);
    expect(merged).toEqual([
      { name: "Up", artist: "x", match: 0.9 },
      { name: "Down", artist: "Y", match: 0.5 },
    ]);
  });
});

describe("playlistSeedMessage", () => {
  test("blocks with no songs, no genres or all chips off", () => {
    expect(playlistSeedMessage([t("r&b")], [t("r&b")], 0)).toMatch(/seed song/);
    expect(playlistSeedMessage([], [], 3)).toMatch(/Last.fm/);
    expect(playlistSeedMessage([t("r&b")], [], 3)).toMatch(/genre/);
    expect(playlistSeedMessage([t("r&b")], [t("r&b")], 3)).toBeNull();
  });
});
