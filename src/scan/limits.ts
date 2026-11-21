// Speed limits for scanning. Unit-tested in tests/limits.test.ts.
//
// Last.fm doesn't publish a hard limit, but asks apps to stay around 5
// requests per second; going over gets error 29 ("rate limit exceeded").

// Time, passed in so tests can use a fake clock instead of really waiting.
export interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Returns a `wait()` function. Await it before each request: it lets at most
// `perSecond` callers through per second, spacing them evenly, however many
// callers there are at once.
//
// How: each caller books the next free time slot, then sleeps until it.
export function createRateLimiter(perSecond: number, clock: Clock = realClock): () => Promise<void> {
  const gap = 1000 / perSecond;
  let nextFree = 0;
  return async () => {
    const now = clock.now();
    const slot = Math.max(now, nextFree);
    nextFree = slot + gap; // book it before sleeping, so the next caller gets a later slot
    if (slot > now) await clock.sleep(slot - now);
  };
}

// Runs `worker` on every item, with at most `concurrency` running at once.
// Like a shop with N tills: each till takes the next customer when it's free.
// Stops starting new items as soon as shouldStop() is true (Cancel).
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  shouldStop: () => boolean = () => false
): Promise<void> {
  let next = 0;
  const till = async () => {
    while (!shouldStop() && next < items.length) {
      const item = items[next++]; // JavaScript runs one thing at a time, so two tills never take the same item
      await worker(item);
    }
  };
  const tills = Array.from({ length: Math.min(concurrency, items.length) }, till);
  await Promise.all(tills);
}
