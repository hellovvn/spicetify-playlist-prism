// Where the Prism fingerprint's bubbles sit (pure, tested; Fingerprint.tsx draws them).

// Where the bubbles sit in the 100x100 picture, biggest genre first
// (hand-placed so they cluster and overlap nicely).
export const SPOTS: [number, number][] = [
  [42, 46], [64, 38], [57, 64], [30, 67], [75, 64], [27, 34], [72, 82], [45, 84],
];

// Each bubble's centre and radius, given the genre shares (biggest first).
// The hand-placed spots lean low and the sizes change per playlist, so the
// whole cluster is then moved so its outer edges are centred in the picture.
export function bubbleSpots(shares: number[]): { x: number; y: number; r: number }[] {
  const spots = shares.slice(0, SPOTS.length).map((share, i) => ({
    x: SPOTS[i][0],
    y: SPOTS[i][1],
    r: 6 + Math.sqrt(share) * 17, // area grows with the share
  }));
  if (spots.length === 0) return spots;
  const left = Math.min(...spots.map((s) => s.x - s.r));
  const right = Math.max(...spots.map((s) => s.x + s.r));
  const top = Math.min(...spots.map((s) => s.y - s.r));
  const bottom = Math.max(...spots.map((s) => s.y + s.r));
  const dx = 50 - (left + right) / 2;
  const dy = 50 - (top + bottom) / 2;
  return spots.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
}
