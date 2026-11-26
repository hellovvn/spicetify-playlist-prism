import { describe, expect, it } from "vitest";
import { bubbleSpots } from "../src/ui/bubbleSpots";

function bounds(spots: { x: number; y: number; r: number }[]) {
  return {
    left: Math.min(...spots.map((s) => s.x - s.r)),
    right: Math.max(...spots.map((s) => s.x + s.r)),
    top: Math.min(...spots.map((s) => s.y - s.r)),
    bottom: Math.max(...spots.map((s) => s.y + s.r)),
  };
}

describe("bubbleSpots", () => {
  it("centres the cluster's outer edges in the 100x100 picture", () => {
    for (const shares of [[0.3, 0.2, 0.15, 0.1, 0.1, 0.08, 0.04, 0.03], [0.6, 0.4], [1], [0.5, 0.2, 0.2, 0.1]]) {
      const b = bounds(bubbleSpots(shares));
      expect((b.left + b.right) / 2).toBeCloseTo(50);
      expect((b.top + b.bottom) / 2).toBeCloseTo(50);
    }
  });

  it("keeps the hand-placed shape (only moves it) and caps at 8 bubbles", () => {
    const spots = bubbleSpots([0.3, 0.2, 0.15, 0.1, 0.1, 0.05, 0.05, 0.03, 0.02]);
    expect(spots).toHaveLength(8);
    expect(spots[1].x - spots[0].x).toBeCloseTo(22);
    expect(spots[1].y - spots[0].y).toBeCloseTo(-8);
  });

  it("handles no genres", () => {
    expect(bubbleSpots([])).toEqual([]);
  });
});
