import { describe, expect, test } from "vitest";
import { MAX_RADIUS, TRAIL_LIFE, mergedRadius, trailAlpha } from "../src/ui/rainGlass";

describe("rain on glass", () => {
  test("merging keeps the water (areas add up), capped", () => {
    expect(mergedRadius(3, 4)).toBeCloseTo(5);
    expect(mergedRadius(9, 9)).toBe(MAX_RADIUS);
  });

  test("trails fade out over TRAIL_LIFE", () => {
    expect(trailAlpha(0)).toBe(1);
    expect(trailAlpha(TRAIL_LIFE / 2)).toBeGreaterThan(0.5);
    expect(trailAlpha(TRAIL_LIFE)).toBe(0);
  });
});
