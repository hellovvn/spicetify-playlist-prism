import { describe, expect, it } from "vitest";
import {
  addReport,
  emptyFeatureDay,
  parseFeatureReport,
  readFeatures,
  recordFeatures,
  THEMES,
} from "../relay/src/features";
import type { UsageKV } from "../relay/src/usage";
import { PLAYLIST_THEMES } from "../src/theme/playlistTheme";

function fakeKV() {
  const data = new Map<string, string>();
  const kv: UsageKV = {
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, value);
    },
  };
  return { kv, data };
}

const day1 = new Date("2026-11-27T10:00:00Z");

describe("relay feature counts", () => {
  it("keeps only known names and refuses odd numbers", () => {
    const ok = parseFeatureReport({
      counts: { grow: 2, merge: 0, "my playlist": 5 },
      settings: ["side_panel", "secret"],
      theme: "aurora",
      version: "0.1.2",
    });
    expect(ok).toEqual({ ok: true, report: { counts: { grow: 2 }, settings: ["side_panel"], theme: "aurora", version: "0.1.2" } });
    expect(parseFeatureReport({ counts: { grow: -1 } }).ok).toBe(false);
    expect(parseFeatureReport({ counts: { grow: 1.5 } }).ok).toBe(false);
    expect(parseFeatureReport({ counts: { grow: 10_000 } }).ok).toBe(false);
    expect(parseFeatureReport("hi").ok).toBe(false);
    const odd = parseFeatureReport({ theme: "<script>", version: "Spotify 1.2" });
    expect(odd.ok && odd.report).toMatchObject({ theme: "none", version: "unknown", counts: {}, settings: [] });
  });

  it("theme list matches Settings' themes", () => {
    expect([...THEMES]).toEqual(PLAYLIST_THEMES.map((t) => t.id));
  });

  it("adds counts every time, but a person's settings once a day", () => {
    const report = { counts: { grow: 1 }, settings: ["side_panel" as const], theme: "stars", version: "0.1.2" };
    let day = addReport(emptyFeatureDay(), report, true);
    day = addReport(day, report, false);
    expect(day).toEqual({
      sharing: 1,
      counts: { grow: 2 },
      settings: { side_panel: 1 },
      themes: { stars: 1 },
      versions: { "0.1.2": 1 },
    });
  });

  it("stores one record per day, counts each sender once, never stores the IP", async () => {
    const { kv, data } = fakeKV();
    const report = { counts: { merge: 1 }, settings: [], theme: "none", version: "0.1.2" };
    await recordFeatures(kv, report, "203.0.113.7", day1, "pepper");
    await recordFeatures(kv, report, "203.0.113.7", day1, "pepper");
    await recordFeatures(kv, report, "198.51.100.1", day1, "pepper");
    for (const [key, value] of data) {
      expect(key).not.toContain("203.0.113.7");
      expect(value).not.toContain("203.0.113.7");
    }
    const [today] = await readFeatures(kv, day1, 2);
    expect(today).toMatchObject({ day: "2026-11-27", sharing: 2, counts: { merge: 3 } });
  });
});
