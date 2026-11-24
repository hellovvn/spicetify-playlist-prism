// The ORDER of a new Grow playlist (after the seed, which always goes first).
// PURE, tested in tests/playlistOrder.test.ts.
//
// Developer's wish (2026-11-23): the playlist should feel shuffled, not
// best-first, and the new finds must not bunch up at the start. So:
//   1. shuffle the user's own songs, and shuffle the new finds;
//   2. spread the new finds EVENLY through the list: with 30 own songs and
//      10 new finds, about every 4th song is a new find (where exactly is random).
//
// `random` is Math.random by default; tests pass a fixed one so results repeat.

import type { RankedSong } from "./rank";

export function playlistOrder<T extends Pick<RankedSong, "newFind">>(songs: T[], random: () => number = Math.random): T[] {
  const own = shuffle(songs.filter((song) => !song.newFind), random);
  const fresh = shuffle(songs.filter((song) => song.newFind), random);
  if (fresh.length === 0) return own;

  // Slots for the new finds: one in each equal stretch of the playlist,
  // at a random spot (`offset`) that is the same in every stretch.
  const total = own.length + fresh.length;
  const step = total / fresh.length; // >= 1, so no two slots are the same
  const offset = random() * step;
  const slots = new Set(fresh.map((_, i) => Math.min(total - 1, Math.floor(i * step + offset))));

  const result: T[] = [];
  let nextOwn = 0;
  let nextFresh = 0;
  for (let index = 0; index < total; index++) {
    const takeFresh = (slots.has(index) && nextFresh < fresh.length) || nextOwn >= own.length;
    result.push(takeFresh ? fresh[nextFresh++] : own[nextOwn++]);
  }
  return result;
}

// Fisher-Yates shuffle: every order is equally likely. Returns a NEW array.
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
