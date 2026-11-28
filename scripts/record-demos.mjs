// Records a README demo clip from Spotify over the debug port (CDP screenshots, see startRec),
// then turns the frames into a GIF with ffmpeg.
// Usage: node scripts/record-demos.mjs <scenario> [--gif] [--keep-frames]
//   scenarios: grow, remix, tone, themes, stats, side-panel, add-with-prism (see docs/media/SHOTLIST.md)
//   Output: docs/media/<scenario>.webp (or .gif with --gif). Needs ffmpeg (set FFMPEG=path if it isn't on PATH)
//   and Spotify running with the debug port (spicetify watch -a). Uses the demo playlist Today's Top Hits.
// It changes the playlist theme and tones while recording and puts your saved values back afterwards.
// It never clicks Create, Merge or Add: nothing is written to Spotify.
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { roundCornersFilter } from "./round-clips.mjs"; // webp clips get the banner's rounded corners

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const OUT_DIR = path.resolve("docs/media");
const TMP = path.resolve("build-tmp/frames"); // build-tmp is git-excluded
const TTH = "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M";
const SEED = "spotify:track:4EoJ151oQ5jY48z4RhSE96"; // "the cure", Olivia Rodrigo (in Today's Top Hits)
const VIEW = { width: 1600, height: 1080 };
const DPR = 2; // record at double density so small text stays sharp
const SHAPE = 0.8; // every feature clip is cropped to this height/width (5:4), so the README rows line up
const QUALITY = Number(process.env.QUALITY) || 70; // webp quality: 70 at 2x width looks sharper than 82 did at 1x
// Output widths: twice the size the README/site show them at (640 / 720 px), so sharp (HiDPI)
// screens get one clip pixel per screen pixel instead of a stretched, blurry picture.
const CLIP_WIDTH = 1280;
const HERO_WIDTH = 1440;

// ----- CDP -----
const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page" && t.url.includes("xpui"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 0;
const pending = new Map();
const listeners = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method && listeners.has(m.method)) listeners.get(m.method)(m.params);
});
const send = (method, params = {}) => new Promise((r) => { const id = ++nextId; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const m = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description || "eval failed");
  return m.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ev(expr)) return true; await sleep(200); }
  return false;
}
const go = (p) => ev(`Spicetify.Platform.History.push(${JSON.stringify(p)})`);
const rect = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
async function hover(sel) {
  const r = await rect(sel);
  if (!r) throw new Error("no element " + sel);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x + r.w / 2, y: r.y + r.h / 2 });
}
async function clickAt(sel) {
  const r = await rect(sel);
  if (!r) throw new Error("no element " + sel);
  const x = r.x + r.w / 2, y = r.y + r.h / 2;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await sleep(150);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
const goHome = () => go("/prism?go=home&r=" + Date.now());
const pageCrop = (b, ratio = SHAPE) => ({ x: b.x, y: Math.max(0, b.y - 4), w: b.w, h: Math.min(VIEW.height - Math.max(0, b.y - 4), b.w * ratio) });
const top = (r, ratio) => ({ x: r.x, y: r.y, w: r.w, h: Math.min(r.h, r.w * ratio) });
async function scrollTop0() {
  for (let i = 0; i < 4; i++) { await ev(`document.querySelectorAll(".Root__main-view [data-overlayscrollbars-viewport]").forEach((e) => { e.scrollTop = 0; })`); await sleep(250); }
}
// The main view without Spotify's top bar (64 px), cut to the 5:4 shape.
const belowTopBar = (m) => ({ x: m.x, y: m.y + 64, w: m.w, h: Math.min(m.h - 64, m.w * SHAPE) });
// Scroll the main view so the playlist's big cover header is mostly out of the 5:4 frame.
async function scrollMain(px) {
  for (let i = 0; i < 3; i++) { await ev(`document.querySelectorAll(".Root__main-view [data-overlayscrollbars-viewport]").forEach((e) => { e.scrollTop = ${px}; })`); await sleep(250); }
}
const clickButton = (text) => ev(`[...document.querySelectorAll(".Root__main-view button")].find((b) => b.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled)?.click()`);
const setLocal = (key, value) => ev(`Spicetify.LocalStorage.set(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
const fire = (name) => ev(`window.dispatchEvent(new Event(${JSON.stringify(name)}))`);
async function setTheme(id) {
  await setLocal("prism:playlistTheme", id);
  await fire("prism:playlist-theme-changed");
}
async function setTone(uri, tone) {
  const tones = JSON.parse((await ev(`Spicetify.LocalStorage.get("prism:tones")`)) || "{}");
  if (tone) tones[uri] = { ...tone, updatedAt: Date.now() }; else delete tones[uri];
  await setLocal("prism:tones", JSON.stringify(tones));
  await fire("prism:tones-changed");
}

// ----- recording -----
// Page.startScreencast ignores the emulated pixel density (its frames are always 1x, which made
// the clips blurry), so frames are Page.captureScreenshot calls instead: a few in flight at once
// gives ~20-30 fps at true double density. Only the main view is captured (or `area`), which
// keeps each shot small; every crop rect below is still in page (CSS px) coordinates.
let frames = [];
let segment = 0;
let recording = null;
let recArea = null;
const IN_FLIGHT = 3;
// keep = add to the frames already recorded (a clip made of several screens).
async function startRec(keep = false, area = ".Root__main-view") {
  if (!keep) frames = [];
  segment++;
  const a = await rect(area);
  if (!a) throw new Error("nothing to record: " + area);
  if (keep && recArea && (recArea.x !== a.x || recArea.y !== a.y || recArea.w !== a.w || recArea.h !== a.h)) throw new Error("recorded area moved between segments");
  recArea = a;
  const clip = { x: a.x, y: a.y, width: a.w, height: a.h, scale: 1 };
  let stop = false;
  let order = 0;
  const seg = segment;
  const worker = async () => {
    while (!stop) {
      const n = order++;
      const m = await send("Page.captureScreenshot", { format: "jpeg", quality: 95, clip, optimizeForSpeed: true });
      if (m.result?.data) frames.push({ data: m.result.data, ts: Date.now() / 1000, n, seg });
    }
  };
  const workers = Array.from({ length: IN_FLIGHT }, worker);
  recording = async () => { stop = true; await Promise.all(workers); };
}
async function stopRec() {
  if (recording) await recording();
  recording = null;
  frames.sort((a, b) => a.seg - b.seg || a.n - b.n);
  // Shots finish out of step: keep the time order honest by never letting a frame end before it starts.
  for (let i = 1; i < frames.length; i++) if (frames[i].seg === frames[i - 1].seg && frames[i].ts < frames[i - 1].ts) frames[i].ts = frames[i - 1].ts;
  return frames;
}

// crop = CSS px rect; width = output width in px
async function toGif(name, recorded, crop, width = CLIP_WIDTH, quality = QUALITY) {
  if (recorded.length < 2) throw new Error("no frames recorded");
  const dir = path.join(TMP, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  let concat = "";
  for (let i = 0; i < recorded.length; i++) {
    const file = path.join(dir, String(i).padStart(4, "0") + ".jpg");
    await writeFile(file, Buffer.from(recorded[i].data, "base64"));
    const next = recorded[i + 1];
    const dur = !next ? 0.5 : next.seg !== recorded[i].seg ? 0.15 : Math.max(0.01, next.ts - recorded[i].ts);
    concat += `file '${file.replace(/\\/g, "/")}'\nduration ${dur.toFixed(3)}\n`;
  }
  concat += `file '${path.join(dir, String(recorded.length - 1).padStart(4, "0") + ".jpg").replace(/\\/g, "/")}'\n`;
  await writeFile(path.join(dir, "list.txt"), concat);
  // Frames come in device pixels: scale the CSS-px crop to match (keep sizes even for the encoder).
  const probe = execFileSync(FFMPEG.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1"), ["-v", "error", "-show_entries", "stream=width", "-of", "csv=p=0", path.join(dir, "0000.jpg")]).toString();
  const k = parseInt(probe, 10) / recArea.w;
  // Keep the crop inside the recorded area.
  const x0 = Math.max(crop.x, recArea.x), y0 = Math.max(crop.y, recArea.y);
  crop = { x: x0, y: y0, w: Math.min(crop.x + crop.w, recArea.x + recArea.w) - x0, h: Math.min(crop.y + crop.h, recArea.y + recArea.h) - y0 };
  const c = [crop.w, crop.h, crop.x - recArea.x, crop.y - recArea.y].map((n) => Math.round((n * k) / 2) * 2);
  const webp = !process.argv.includes("--gif");
  const out = path.join(OUT_DIR, name + (webp ? ".webp" : ".gif"));
  const vf = `fps=15,crop=${c[0]}:${c[1]}:${c[2]}:${c[3]},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=112:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  const args = webp
    ? ["-vf", `fps=15,crop=${c[0]}:${c[1]}:${c[2]}:${c[3]},scale=${width}:-1:flags=lanczos,${roundCornersFilter(width)}`, "-c:v", "libwebp", "-quality", String(quality), "-compression_level", "6", "-preset", "picture", "-pix_fmt", "yuva420p"]
    : ["-vf", vf];
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), ...args, "-loop", "0", out]);
  if (!process.argv.includes("--keep-frames")) await rm(dir, { recursive: true, force: true });
  const size = (await readFile(out)).length;
  console.log(`${path.basename(out)}: ${recorded.length} frames, ${(size / 1024 / 1024).toFixed(2)} MB`);
}

// ----- scenarios -----
const scenarios = {
  // README hero: the start page, uncropped, with each tile and start bar coming alive on hover.
  async home() {
    await setTheme("aurora");
    await goHome();
    await waitFor(`!!document.querySelector('[data-prism="tile-organize"]')`, 10000);
    await scrollTop0();
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: VIEW.height - 5 });
    await sleep(1200);
    const box = await rect('[data-prism="page"]');
    await startRec();
    await sleep(800);
    await hover('[data-prism="tile-prism"]');
    await sleep(3400);
    await hover('[data-prism="tile-organize"]');
    await sleep(3600);
    for (const bar of await ev(`[...document.querySelectorAll(".prism-home-bar")].map((_, i) => i)`)) {
      await ev(`(() => { const b = document.querySelectorAll(".prism-home-bar")[${bar}].getBoundingClientRect(); window.__prismBar = [b.x + b.width / 2, b.y + b.height / 2]; })()`);
      const [x, y] = await ev("window.__prismBar");
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await sleep(2600);
    }
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: VIEW.height - 5 });
    await sleep(1200);
    const rec = await stopRec();
    // From the page's top edge to just under the last start bar, no Spotify edges in frame.
    const bottom = await ev(`Math.max(...[...document.querySelectorAll(".prism-home-bar")].map((b) => b.getBoundingClientRect().bottom))`);
    const y = Math.max(0, box.y - 4);
    await toGif("home", rec, { x: box.x, y, w: box.w, h: Math.min(VIEW.height - y, bottom + 36 - y) }, HERO_WIDTH);
  },

  async stats() {
    await setTheme("aurora");
    await goHome();
    await sleep(800);
    await ev(`window.__prism.openStats(${JSON.stringify(TTH)})`);
    await waitFor(`!!document.querySelector('[data-prism-view="stats"] .prism-bubble')`, 15000);
    await sleep(1200);
    const box = await rect('[data-prism="page"]');
    await startRec();
    await sleep(2500);
    await clickAt(".prism-bubble");
    await sleep(2200);
    const rec = await stopRec();
    const w = box.w + 32;
    await toGif("stats", rec, { x: box.x - 16, y: Math.max(0, box.y - 8), w, h: Math.min(VIEW.height - Math.max(0, box.y - 8), w * SHAPE) });
  },

  async "side-panel"() {
    // A taller window, so the 5:4 frame can hold the whole song list (titles too) plus the panel.
    await send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: 1400, deviceScaleFactor: DPR, mobile: false });
    await setTheme("aurora");
    await go("/playlist/37i9dQZF1DXcBWIGoYBM5M");
    if (await waitFor(`!!document.querySelector('[data-prism="panel-tab-stats"]')`, 15000)) await clickAt('[data-prism="panel-tab-stats"]');
    await scrollTop0(); // start at the playlist's header, whatever page was open before
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 1395 });
    await sleep(3000);
    await startRec(false, ".Root__top-container"); // the songs and the panel beside them
    await sleep(4000);
    const rec = await stopRec();
    const side = await rect(".Root__right-sidebar");
    const main = await rect(".Root__main-view");
    const w = side.x + side.w - main.x;
    await toGif("side-panel", rec, { x: main.x, y: side.y, w, h: Math.min(side.h, w * SHAPE) });
  },

  async themes() {
    await setTheme("none");
    await go("/playlist/37i9dQZF1DXcBWIGoYBM5M");
    await waitFor(`!!document.querySelector(".main-trackList-indexable")`, 15000);
    await scrollTop0();
    const bar = await rect('[data-testid="action-bar-row"]');
    const view = await rect(".Root__main-view");
    await scrollMain(Math.max(0, bar.y - view.y - 128)); // keep the genre mix bar in frame
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: VIEW.height - 5 }); // no tooltips in frame
    await sleep(1500);
    const main = await rect(".Root__main-view");
    await startRec();
    await sleep(1300);
    for (const t of ["aurora", "blossom", "rain", "milkyway"]) { await setTheme(t); await sleep(2000); }
    const rec = await stopRec();
    await toGif("themes", rec, belowTopBar(main), CLIP_WIDTH, QUALITY - 6); // busy skies: a bit lower quality keeps it near 5 MB
  },

  // Grow: seed chips -> New finds step -> the ranked preview (the source picker isn't recorded:
  // it lists your playlists).
  async grow() {
    await setTheme("aurora");
    await setLocal("prism:growNewCount", "10");
    await setLocal("prism:growCount", "30");
    await ev(`window.__prism.startPrism(${JSON.stringify(SEED)})`);
    if (!(await waitFor(`!!document.querySelector('[data-prism-state="ready"]')`, 60000))) throw new Error("seed panel didn't load");
    await scrollTop0();
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: VIEW.height - 5 });
    await sleep(1000);
    const box = await rect('[data-prism="page"]');
    // 1. The seed song's tags as chips: switch one off and on again.
    await startRec();
    await sleep(1200);
    const chip = '[data-prism-state="ready"] .prism-tag-pick:nth-child(2)';
    await clickAt(chip);
    await sleep(900);
    await clickAt(chip);
    await sleep(1100);
    await clickAt('[data-prism-state="ready"] .prism-actions button:last-child');
    await waitFor(`!!document.querySelector('[data-prism-state="new-finds"]')`, 5000);
    // 2. How many new finds.
    await sleep(1000);
    await clickAt('[data-prism="step-new-20"]');
    await sleep(900);
    await clickAt('[data-prism="step-new-10"]');
    await sleep(1200);
    await stopRec();
    await clickButton("your playlists");
    await waitFor(`!!document.querySelector('[data-uri=${JSON.stringify(TTH)}]')`, 15000);
    await ev(`document.querySelector('[data-uri=${JSON.stringify(TTH)}]').click()`);
    await sleep(300);
    await clickButton("scan");
    if (!(await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 240000))) throw new Error("scan didn't finish");
    await clickButton("see matches");
    await waitFor(`!!document.querySelector('[data-prism-state="preview"]')`, 15000);
    await waitFor(`!/Looking/.test(document.querySelector('[data-prism="new-status"]')?.textContent || "")`, 120000);
    await scrollTop0();
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: VIEW.height - 5 });
    await sleep(1000);
    // 3. The ranked matches with score rings and New finds.
    await startRec(true);
    await sleep(1000);
    await hover('[data-prism="preview-list"] label');
    await sleep(1600);
    for (let i = 0; i < 12; i++) { await ev(`document.querySelector('[data-prism="preview-list"]').scrollBy(0, 14)`); await sleep(110); }
    await sleep(1200);
    const rec = await stopRec();
    await toGif("grow", rec, pageCrop(box));
  },

  async remix() {
    await setTheme("aurora");
    await goHome();
    await waitFor(`!!document.querySelector('[data-prism="tile-organize"]')`, 10000);
    await ev(`document.querySelector('[data-prism="tile-organize"]').click()`);
    await waitFor(`!!document.querySelector('[data-prism="organize"] [data-uri=${JSON.stringify(TTH)}]')`, 15000);
    await ev(`document.querySelector('[data-prism="organize"] [data-uri=${JSON.stringify(TTH)}]').click()`);
    await sleep(300);
    await ev(`document.querySelector('[data-prism="organize"] [data-prism="sources-next"]').click()`);
    if (!(await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 240000))) throw new Error("scan didn't finish");
    await ev(`[...document.querySelectorAll('[data-prism="organize"] button')].find((b) => b.textContent.trim() === "Next").click()`);
    await waitFor(`!!document.querySelector('[data-prism="mode-auto"]')`, 5000);
    await scrollTop0();
    await sleep(800);
    await startRec();
    await sleep(900);
    await clickAt('[data-prism="mode-auto"]');
    await sleep(900);
    await clickAt('[data-prism="choose-next"]');
    await sleep(4000);
    const rec = await stopRec();
    await toGif("remix", rec, pageCrop(await rect('[data-prism="page"]')));
  },

  async "add-with-prism"() {
    await setTheme("aurora");
    await goHome();
    await sleep(800);
    await startRec();
    await sleep(500);
    await ev(`window.__prism.openAddTo(${JSON.stringify(SEED)})`);
    await waitFor(`!!document.querySelector('[data-prism="addto-row"]')`, 60000);
    await sleep(2500);
    await hover('[data-prism="addto-row"] button');
    await sleep(1500);
    const rec = await stopRec();
    await toGif("add-with-prism", rec, pageCrop(await rect('[data-prism="page"]')));
  },

  async tone() {
    await setTheme("aurora");
    await setTone(TTH, { genres: ["pop", "dance pop", "indie pop"], moods: ["love", "heartbreak"], tempo: "any", show: true });
    await go("/playlist/37i9dQZF1DXcBWIGoYBM5M");
    if (!(await waitFor(`!!document.querySelector("[data-prism-tone-strip]")`, 15000))) throw new Error("no tone strip");
    // Warm-up: let every visible song get its score first, so the clip shows the rings appear at once.
    await waitFor(`(document.querySelector(".prism-tone-strip-status")?.textContent || "") === ""`, 180000);
    await sleep(1500);
    await setTone(TTH, { genres: ["pop", "dance pop", "indie pop"], moods: ["love", "heartbreak"], tempo: "any", show: false });
    for (let i = 0; i < 5; i++) { await ev(`document.querySelectorAll(".Root__main-view [data-overlayscrollbars-viewport]").forEach((e) => { e.scrollTop = 0; })`); await sleep(300); }
    console.log("scrollTop after reset:", await ev(`[...document.querySelectorAll(".Root__main-view [data-overlayscrollbars-viewport]")].map((e) => e.scrollTop).join(",")`));
    const before = await rect("[data-prism-tone-strip]");
    const main0 = await rect(".Root__main-view");
    await scrollMain(Math.max(0, before.y - main0.y - 150));
    await sleep(1200);
    const main = await rect(".Root__main-view");
    await startRec();
    await sleep(900);
    await clickAt("[data-prism-tone-strip] .prism-toggle");
    await sleep(3800);
    const rec = await stopRec();
    await toGif("tone", rec, belowTopBar(main));
  },
};

const name = process.argv[2];
if (!scenarios[name]) { console.log("Scenarios: " + Object.keys(scenarios).join(", ")); process.exit(1); }
const SAVED_KEYS = ["prism:tones", "prism:playlistTheme", "prism:playlistThemes", "prism:growCount", "prism:growNewCount"];
const saved = await ev(`(${JSON.stringify(SAVED_KEYS)}).map((k) => [k, Spicetify.LocalStorage.get(k)])`);
try {
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Page.setWebLifecycleState", { state: "active" });
  await send("Emulation.setDeviceMetricsOverride", { ...VIEW, deviceScaleFactor: DPR, mobile: false });
  await sleep(800);
  await scenarios[name]();
} finally {
  // Put the user's own settings back.
  await ev(`${JSON.stringify(saved)}.forEach(([k, v]) => v == null ? Spicetify.LocalStorage.remove(k) : Spicetify.LocalStorage.set(k, v))`);
  await fire("prism:tones-changed");
  await fire("prism:playlist-theme-changed");
  await send("Emulation.clearDeviceMetricsOverride");
  ws.close();
}
