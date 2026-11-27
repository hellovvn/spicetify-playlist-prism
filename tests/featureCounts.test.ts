import { describe, expect, it } from "vitest";
import { addCount, afterSend, isUsageSharingOn, parsePending, shouldSend } from "../src/usage/featureCounts";

describe("usage counts (Prism side)", () => {
  it("is on unless switched off", () => {
    expect(isUsageSharingOn(null)).toBe(true);
    expect(isUsageSharingOn("on")).toBe(true);
    expect(isUsageSharingOn("off")).toBe(false);
  });

  it("reads saved counts, dropping junk", () => {
    expect(parsePending(null)).toEqual({ counts: {}, lastSent: null });
    expect(parsePending("not json")).toEqual({ counts: {}, lastSent: null });
    expect(parsePending('{"counts":{"grow":2,"x":3,"merge":-1},"lastSent":"2026-11-26"}')).toEqual({
      counts: { grow: 2 },
      lastSent: "2026-11-26",
    });
  });

  it("counts, sends once a day, keeps uses counted while sending", () => {
    let p = addCount(addCount(parsePending(null), "grow"), "add");
    expect(p.counts).toEqual({ grow: 1, add: 1 });
    expect(shouldSend(p, "2026-11-27")).toBe(true);
    const sent = { ...p.counts };
    p = addCount(p, "grow"); // used while the send was on its way
    p = afterSend(p, sent, "2026-11-27");
    expect(p).toEqual({ counts: { grow: 1 }, lastSent: "2026-11-27" });
    expect(shouldSend(p, "2026-11-27")).toBe(false);
    expect(shouldSend(p, "2026-11-28")).toBe(true);
  });
});
