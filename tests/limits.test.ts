// Unit tests for the rate limiter and the worker pool. Run with: npm test

import { describe, expect, test } from "vitest";
import { createRateLimiter, runPool, type Clock } from "../src/scan/limits";

// A fake clock: sleeping just moves the time forward instantly, so a test
// about "seconds" runs in microseconds and gives exact numbers.
function fakeClock(): Clock & { time: number } {
  const clock = {
    time: 0,
    now: () => clock.time,
    sleep: async (ms: number) => {
      clock.time += ms;
    },
  };
  return clock;
}

describe("createRateLimiter", () => {
  test("spaces calls evenly: 4 per second = one every 250 ms", async () => {
    const clock = fakeClock();
    const wait = createRateLimiter(4, clock);
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      await wait();
      times.push(clock.time);
    }
    expect(times).toEqual([0, 250, 500, 750, 1000]);
  });

  test("callers waiting AT THE SAME TIME still get separate slots", async () => {
    const clock = { now: () => 0, sleep: async () => {} };
    const slept: number[] = [];
    const wait = createRateLimiter(5, { ...clock, sleep: async (ms) => void slept.push(ms) });
    await Promise.all([wait(), wait(), wait()]); // three "tills" asking at once
    expect(slept).toEqual([200, 400]); // first goes now, then +200, +400
  });

  test("no waiting when calls are already slow enough", async () => {
    const clock = fakeClock();
    const wait = createRateLimiter(4, clock);
    await wait();
    clock.time = 10_000; // a long gap, e.g. the user paused
    const before = clock.time;
    await wait();
    expect(clock.time).toBe(before);
  });
});

describe("runPool", () => {
  test("processes every item exactly once", async () => {
    const done: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async (n) => void done.push(n));
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test("never runs more than `concurrency` at once", async () => {
    let running = 0;
    let peak = 0;
    await runPool(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 1));
      running--;
    });
    expect(peak).toBe(3);
  });

  test("stops starting new items once shouldStop() is true (Cancel)", async () => {
    const done: number[] = [];
    let stop = false;
    await runPool([1, 2, 3, 4, 5], 1, async (n) => {
      done.push(n);
      if (n === 2) stop = true;
    }, () => stop);
    expect(done).toEqual([1, 2]);
  });

  test("empty list: finishes immediately", async () => {
    await expect(runPool([], 4, async () => {})).resolves.toBeUndefined();
  });
});
