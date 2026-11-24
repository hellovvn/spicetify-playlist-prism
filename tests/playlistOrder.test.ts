// Unit tests for the new playlist's order. Run with: npm test

import { describe, expect, test } from "vitest";
import { playlistOrder, shuffle } from "../src/scoring/playlistOrder";

// A repeatable "random" (a small linear congruential generator).
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const own = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `own${i}` }));
const fresh = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `new${i}`, newFind: { similarity: 0.5 } }));
const ids = (list: { id: string }[]) => list.map((s) => s.id);

describe("playlistOrder", () => {
  test("keeps every song exactly once", () => {
    const songs = [...own(30), ...fresh(10)];
    const ordered = playlistOrder(songs, seeded(1));
    expect(ordered).toHaveLength(40);
    expect(new Set(ids(ordered))).toEqual(new Set(ids(songs)));
  });

  test("new finds are spread out: one in every stretch of 4", () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const ordered = playlistOrder([...fresh(10), ...own(30)], seeded(seed));
      for (let stretch = 0; stretch < 10; stretch++) {
        const part = ordered.slice(stretch * 4, stretch * 4 + 4);
        expect(part.filter((s) => "newFind" in s)).toHaveLength(1);
      }
    }
  });

  test("the order is shuffled, not best-first", () => {
    const songs = own(20);
    expect(ids(playlistOrder(songs, seeded(7)))).not.toEqual(ids(songs));
  });

  test("works with only new finds, or none", () => {
    expect(playlistOrder(fresh(3), seeded(1))).toHaveLength(3);
    expect(playlistOrder([], seeded(1))).toEqual([]);
  });

  test("more new finds than own songs still keeps everyone", () => {
    const ordered = playlistOrder([...own(2), ...fresh(5)], seeded(5));
    expect(new Set(ids(ordered)).size).toBe(7);
  });
});

describe("shuffle", () => {
  test("same items, new array, input untouched", () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items, seeded(3));
    expect([...result].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});
