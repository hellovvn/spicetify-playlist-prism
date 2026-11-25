// WINDOW RAIN's glass (2026-11-25, developer's reference "Raindrops on Window
// Loop", calmer): a small rain-on-glass simulation on ONE canvas.
// - Drops have lumpy, uneven outlines (no perfect circles), heavier at the
//   bottom. The shapes are drawn once into a few sprites and reused.
// - New drops keep landing. When a drop gets big enough it starts sliding
//   nearly straight down (stop-start), swallowing drops it runs into and
//   wiping the small ones out of its path.
// - It leaves a "wiped path" trail (look T3): a clean, slightly darker channel
//   with faint glossy edges, which dries up after TRAIL_LIFE. The drop stops
//   when it has lost too much water.
// It runs at ~30 frames a second, pauses while the page is hidden, stops for
// good once the canvas leaves the page, and with reduced motion draws one
// still frame.
//
// The pure parts (mergedRadius, trailAlpha) are unit-tested.

export const SLIDE_RADIUS = 5.2; // a drop this big (px) may start to slide
export const STOP_RADIUS = 3; // a sliding drop this small stops
export const MAX_RADIUS = 10;
export const TRAIL_LIFE = 12000; // ms until a trail has faded away
const MAX_SLIDING = 3; // calm: only a few drops run at the same time
const TRAIL_TAPER = 70; // px: a trail's top fades in over this length

export type Drop = { x: number; y: number; r: number; sprite: number; rot: number; moving: boolean; vy: number; born: number; life: number };

// Two drops joining keep their water: the areas add up.
export function mergedRadius(a: number, b: number): number {
  return Math.min(MAX_RADIUS, Math.sqrt(a * a + b * b));
}

// How visible a trail point still is (1 = fresh, 0 = gone).
export function trailAlpha(age: number): number {
  if (age <= 0) return 1;
  if (age >= TRAIL_LIFE) return 0;
  const t = age / TRAIL_LIFE;
  return 1 - t * t; // stays wet for a while, then dries quicker
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// ----- Sprites: lumpy drops drawn once at SPRITE px -----
const SPRITE = 64;
const SPRITES = 28;
let sprites: HTMLCanvasElement[] | null = null;

function lumpyPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, bumps: number[]): void {
  const n = bumps.length;
  const point = (i: number) => {
    const a = (i / n) * Math.PI * 2;
    const k = bumps[i % n];
    // Water sags: the lower half is a bit fuller.
    const sag = Math.sin(a) > 0 ? 1 + 0.12 * Math.sin(a) : 1;
    return [cx + Math.cos(a) * radius * k, cy + Math.sin(a) * radius * k * sag];
  };
  ctx.beginPath();
  const [x0, y0] = point(0);
  const [x1, y1] = point(1);
  ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
  for (let i = 1; i <= n; i++) {
    const [px, py] = point(i);
    const [qx, qy] = point(i + 1);
    ctx.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
  }
  ctx.closePath();
}

function makeSprites(): HTMLCanvasElement[] {
  const list: HTMLCanvasElement[] = [];
  for (let s = 0; s < SPRITES; s++) {
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const ctx = c.getContext("2d")!;
    const r = SPRITE * 0.36;
    const cx = SPRITE / 2;
    const cy = SPRITE / 2 - 2;
    const bumps = Array.from({ length: 9 }, () => rand(0.82, 1.14));
    // Dark edge, lower (the drop's shadowed side).
    ctx.save();
    ctx.translate(0, r * 0.14);
    lumpyPath(ctx, cx, cy, r * 1.02, bumps);
    ctx.fillStyle = "rgba(6, 8, 26, 0.42)";
    ctx.fill();
    ctx.restore();
    // Clear body, lighter at the bottom where light bends through.
    lumpyPath(ctx, cx, cy, r, bumps);
    const body = ctx.createRadialGradient(cx, cy + r * 0.45, 0, cx, cy, r * 1.05);
    body.addColorStop(0, "rgba(225, 230, 255, 0.3)");
    body.addColorStop(0.55, "rgba(190, 200, 245, 0.08)");
    body.addColorStop(1, "rgba(14, 16, 38, 0.32)");
    ctx.fillStyle = body;
    ctx.fill();
    // A small, uneven glint near the top left.
    ctx.save();
    ctx.translate(cx - r * 0.32, cy - r * 0.42);
    ctx.rotate(rand(-0.9, -0.2));
    ctx.beginPath();
    ctx.ellipse(0, 0, r * rand(0.2, 0.32), r * rand(0.1, 0.17), 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.fill();
    ctx.restore();
    // A thin light rim along the bottom.
    ctx.save();
    lumpyPath(ctx, cx, cy, r * 0.9, bumps);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.95, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(230, 235, 255, 0.18)";
    ctx.fill();
    ctx.restore();
    list.push(c);
  }
  return list;
}

type TrailPoint = { x: number; y: number; w: number; t: number };

export function startRainGlass(canvas: HTMLCanvasElement): void {
  sprites ??= makeSprites();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let w = 0;
  let h = 0;
  let drops: Drop[] = [];
  let trails: TrailPoint[][] = [];
  const trailOf = new Map<Drop, TrailPoint[]>(); // sliders' trails (still growing)
  let last = 0;
  let tries = 0;

  const newDrop = (x: number, y: number, r: number, now: number, life = Infinity): Drop => ({
    x, y, r, sprite: Math.floor(Math.random() * SPRITES), rot: rand(-0.5, 0.5), moving: false, vy: 0, born: now, life,
  });
  // Mostly tiny, some medium, a few big.
  const randomRadius = () => (Math.random() < 0.06 ? rand(4.5, 7.5) : 1 + Math.pow(Math.random(), 1.8) * 5);

  const resize = (now: number) => {
    const ratio = window.devicePixelRatio || 1;
    const nw = canvas.clientWidth;
    const nh = canvas.clientHeight;
    if (nw === w && nh === h) return;
    if (w && h) drops.forEach((d) => { d.x *= nw / w; d.y *= nh / h; });
    w = nw;
    h = nh;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const want = Math.round((w * h) / 1100);
    while (drops.length < want) drops.push(newDrop(rand(0, w), rand(0, h), randomRadius(), now));
    trails = [];
    trailOf.clear();
  };

  const maxDrops = () => Math.round((w * h) / 800);

  const step = (now: number, dt: number) => {
    // New drops landing: about 6 a second on a big window.
    const expected = w * h * 4.2e-9 * dt;
    const landings = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
    const landed: Drop[] = [];
    for (let k = 0; k < Math.min(6, landings); k++) {
      const d = newDrop(rand(0, w), rand(0, h), randomRadius(), now);
      drops.push(d);
      landed.push(d);
    }
    // Small drops left by sliders dry up after a while.
    drops = drops.filter((d) => now - d.born < d.life);
    if (drops.length > maxDrops()) drops.splice(0, drops.length - maxDrops());

    // A drop that just landed on another one merges with it.
    for (const a of landed) {
      for (const b of drops) {
        if (a === b || b.moving || b.r === 0) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.7) {
          b.r = mergedRadius(a.r, b.r);
          a.r = 0;
          break;
        }
      }
    }

    let sliding = drops.filter((d) => d.moving).length;
    for (const d of drops) {
      if (d.r === 0) continue;
      if (!d.moving) {
        // Big drops start sliding now and then (glass is a bit sticky).
        if (d.r >= SLIDE_RADIUS && sliding < MAX_SLIDING && Math.random() < 0.00012 * dt * (d.r / SLIDE_RADIUS)) {
          sliding++;
          d.moving = true;
          d.vy = 0;
          const trail: TrailPoint[] = [];
          trails.push(trail);
          trailOf.set(d, trail);
        }
        continue;
      }
      // Sliding: speed builds with size, with stop-start sticking.
      const sticky = Math.random() < 0.02 * (dt / 33);
      d.vy = sticky ? d.vy * 0.2 : Math.min(d.r * 0.035, d.vy + d.r * 0.00045 * dt);
      // Nearly straight down, with only a slight wobble (developer's choice:
      // steering from drop to drop looked odd).
      d.x += rand(-0.12, 0.12);
      const dy = d.vy * dt * 0.2; // ~40 px/s for a mid-size drop: calmer than real rain
      d.y += dy;
      // Swallow drops it runs into, and wipe the small ones in its path
      // (the "wiped path" trail, look T3).
      for (const o of drops) {
        if (o === d || o.r === 0 || o.moving) continue;
        if (Math.abs(o.y - d.y) < d.r + o.r && Math.hypot(o.x - d.x, o.y - d.y) < (d.r + o.r) * 0.75) {
          d.r = mergedRadius(d.r, o.r);
          o.r = 0;
        } else if (Math.abs(o.x - d.x) < d.r * 1.1 && o.y < d.y && o.y > d.y - d.r * 3) {
          d.r = mergedRadius(d.r, o.r * 0.4);
          o.r = 0;
        }
      }
      // Lose a little water along the way: the trail.
      const trail = trailOf.get(d);
      const lastPoint = trail?.[trail.length - 1];
      if (trail && (!lastPoint || Math.hypot(lastPoint.x - d.x, lastPoint.y - d.y) > 3)) trail.push({ x: d.x, y: d.y - d.r * 0.6, w: d.r * 0.55, t: now });
      d.r -= dy * 0.006;
      if (d.r < STOP_RADIUS || d.y > h + 20) {
        d.moving = false;
        trailOf.delete(d);
        if (d.y > h + 20) d.r = 0;
      }
    }
    drops = drops.filter((d) => d.r > 0);
    const growing = new Set(trailOf.values());
    trails = trails.filter((t) => growing.has(t) || (t.length > 0 && now - t[t.length - 1].t < TRAIL_LIFE));
    for (const t of trails) while (t.length > 1 && now - t[0].t > TRAIL_LIFE) t.shift();
  };

  const draw = (now: number) => {
    canvas.dataset.drops = String(drops.length); // for checks (smoke test / debugging)
    canvas.dataset.sliding = String(drops.filter((d) => d.moving).length);
    canvas.dataset.trails = String(trails.length);
    ctx.clearRect(0, 0, w, h);
    // Trails, look "T3, wiped path" (developer's pick 2026-11-25): a clean,
    // slightly darker channel with a faint glossy line along each edge. Drawn
    // in chunks of a few points (one path each, flat ends) so the strokes
    // don't overlap into a line down the middle; each chunk fades by its age.
    ctx.lineJoin = "round";
    ctx.lineCap = "butt";
    // The top of a trail fades in (TRAIL_TAPER), so it doesn't start with a
    // hard edge; chunks are shorter there so the fade is smooth.
    for (const t of trails) {
      let along = 0;
      for (let i = 0; i < t.length - 1; ) {
        const chunk = along < TRAIL_TAPER ? 2 : 6;
        const part = t.slice(i, i + chunk + 1);
        i += chunk;
        if (part.length < 2) continue;
        const mid = part[Math.floor(part.length / 2)];
        along += Math.hypot(part[part.length - 1].x - part[0].x, part[part.length - 1].y - part[0].y);
        const a = trailAlpha(now - mid.t) * Math.min(1, along / TRAIL_TAPER) ** 1.5;
        if (a <= 0) continue;
        const path = (shift: number) => {
          ctx.beginPath();
          ctx.moveTo(part[0].x + shift, part[0].y);
          for (let k = 1; k < part.length; k++) ctx.lineTo(part[k].x + shift, part[k].y);
        };
        path(0);
        ctx.strokeStyle = `rgba(10, 12, 30, ${(0.2 * a).toFixed(3)})`;
        ctx.lineWidth = mid.w * 1.9;
        ctx.stroke();
        ctx.strokeStyle = `rgba(225, 232, 255, ${(0.1 * a).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        path(-mid.w * 0.95);
        ctx.stroke();
        path(mid.w * 0.95);
        ctx.stroke();
      }
    }
    // Drops.
    for (const d of drops) {
      const fade = d.life === Infinity ? 1 : Math.max(0, 1 - (now - d.born) / d.life);
      const size = (d.r * 2 * SPRITE) / (SPRITE * 0.72);
      const stretch = d.moving ? 1.15 + Math.min(0.35, d.vy * 0.25) : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, fade * 1.6);
      ctx.translate(d.x, d.y);
      ctx.rotate(d.moving ? 0 : d.rot);
      ctx.scale(1 / Math.sqrt(stretch), stretch);
      ctx.drawImage(sprites![d.sprite], -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  };

  const frame = (now: number) => {
    if (!canvas.isConnected) {
      if (w || tries++ > 60) return; // gone for good (or never shown)
      requestAnimationFrame(frame);
      return;
    }
    resize(now);
    if (!w || !h) {
      requestAnimationFrame(frame);
      return;
    }
    if (still) {
      draw(now);
      return;
    }
    const dt = last ? Math.min(100, now - last) : 33;
    if (!document.hidden && dt >= 30) {
      step(now, dt);
      draw(now);
      last = now;
    } else if (document.hidden) {
      last = now;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
