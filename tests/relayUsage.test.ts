import { describe, expect, it } from "vitest";
import { countUser, isUsageAuthorized, readUsage, usageDay, type UsageKV } from "../relay/src/usage";

function fakeKV() {
  const data = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  const kv: UsageKV = {
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value, options) {
      data.set(key, value);
      ttls.set(key, options?.expirationTtl);
    },
  };
  return { kv, data, ttls };
}

const day1 = new Date("2026-11-26T10:00:00Z");
const day1Later = new Date("2026-11-26T23:59:00Z");
const day2 = new Date("2026-11-27T00:01:00Z");

describe("relay usage count", () => {
  it("counts each caller once per UTC day", async () => {
    const { kv, data } = fakeKV();
    expect(await countUser(kv, "1.1.1.1", day1, "pepper")).toBe(true);
    expect(await countUser(kv, "1.1.1.1", day1Later, "pepper")).toBe(false);
    expect(await countUser(kv, "2.2.2.2", day1, "pepper")).toBe(true);
    expect(await countUser(kv, "1.1.1.1", day2, "pepper")).toBe(true);
    expect(data.get("users:2026-11-26")).toBe("2");
    expect(data.get("users:2026-11-27")).toBe("1");
  });

  it("never stores the IP, and the hashes expire after 2 days", async () => {
    const { kv, data, ttls } = fakeKV();
    await countUser(kv, "203.0.113.7", day1, "pepper");
    for (const [key, value] of data) {
      expect(key).not.toContain("203.0.113.7");
      expect(value).not.toContain("203.0.113.7");
      if (key.startsWith("seen:")) expect(ttls.get(key)).toBe(2 * 86400);
    }
  });

  it("gives a different hash with a different pepper", async () => {
    const a = fakeKV();
    const b = fakeKV();
    await countUser(a.kv, "1.1.1.1", day1, "one");
    await countUser(b.kv, "1.1.1.1", day1, "two");
    const seen = (m: Map<string, string>) => [...m.keys()].find((k) => k.startsWith("seen:"));
    expect(seen(a.data)).not.toBe(seen(b.data));
  });

  it("reads the last days newest first, with 0 for days without a count", async () => {
    const { kv } = fakeKV();
    await countUser(kv, "1.1.1.1", day1, "p");
    expect(await readUsage(kv, day2, 3)).toEqual([
      { day: "2026-11-27", users: 0 },
      { day: "2026-11-26", users: 1 },
      { day: "2026-11-25", users: 0 },
    ]);
    expect(usageDay(day2)).toBe("2026-11-27");
  });

  it("only lets the right token read the counts", () => {
    expect(isUsageAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isUsageAuthorized("bearer s3cret", "s3cret")).toBe(true);
    expect(isUsageAuthorized("Bearer wrong!", "s3cret")).toBe(false);
    expect(isUsageAuthorized(null, "s3cret")).toBe(false);
    expect(isUsageAuthorized("Bearer ", "")).toBe(false);
    expect(isUsageAuthorized("Bearer x", undefined)).toBe(false);
  });
});
