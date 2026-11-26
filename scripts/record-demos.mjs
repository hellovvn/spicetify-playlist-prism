// Records a README demo clip from Spotify over the debug port (CDP screencast),
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

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const OUT_DIR = path.resolve("docs/media");
const TMP = path.resolve("build-tmp/frames"); // build-tmp is git-excluded
const TTH = "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M";
const SEED = "spotify:track:4EoJ151oQ5jY48z4RhSE96"; // "the cure", Olivia Rodrigo (in Today's Top Hits)
const VIEW = { width: 1800, height: 1240 };

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
const goHome = () => go("/playlist-prism?go=home&r=" + Date.now());
const pageCrop = (b, ratio) => ({ x: b.x - 20, y: Math.max(0, b.y - 12), w: b.w + 40, h: Math.min(VIEW.height - Math.max(0, b.y - 12), (b.w + 40) * ratio) });
const top = (r, ratio) => ({ x: r.x, y: r.y, w: r.w, h: Math.min(r.h, r.w * ratio) });
async function scrollTop0() {
  for (let i = 0; i < 4; i++) { await ev(`document.querySelectorAll(".Root__main-view [data-overlayscrollbars-viewport]").forEach((e) => { e.scrollTop = 0; })`); await sleep(250); }
}
const clickButton = (text) => ev(`[...document.querySelectorAll(".Root__main-view button")].find((b) => b.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled)?.click()`);
const setLocal = (key, value) => ev(`Spicetify.LocalStorage.set(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
const fire = (name) => ev(`window.dispatchEvent(new Event(${JSON.stringify(name)}))`);
async function setTheme(id) {
  await setLocal("prism:playlistTheme", id);
  await fire("playlist-prism:playlist-theme-changed");
}
async function setTone(uri, tone) {
  const tones = JSON.parse((await ev(`Spicetify.LocalStorage.get("prism:tones")`)) || "{}");
  if (tone) tones[uri] = { ...tone, updatedAt: Date.now() }; else delete tones[uri];
  await setLocal("prism:tones", JSON.stringify(tones));
  await fire("playlist-prism:tones-changed");
}

// ----- recording -----
let frames = [];
let segment = 0;
listeners.set("Page.screencastFrame", (p) => {
  frames.push({ data: p.data, ts: p.metadata.timestamp, seg: segment });
  send("Page.screencastFrameAck", { sessionId: p.sessionId });
});
async function startRec() {
  frames = [];
  segment++;
  await send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
}
async function stopRec() {
  await send("Page.stopScreencast");
  await sleep(200);
  return frames;
}

// crop = CSS px rect; width = output width in px
async function toGif(name, recorded, crop, width = 720) {
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
  const c = [crop.w, crop.h, crop.x, crop.y].map((n) => Math.round(n));
  const webp = !process.argv.includes("--gif");
  const out = path.join(OUT_DIR, name + (webp ? ".webp" : ".gif"));
  const vf = `fps=15,crop=${c[0]}:${c[1]}:${c[2]}:${c[3]},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=112:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  const args = webp
    ? ["-vf", `fps=15,crop=${c[0]}:${c[1]}:${c[2]}:${c[3]},scale=${width}:-1:flags=lanczos`, "-c:v", "libwebp", "-quality", "72", "-compression_level", "6", "-preset", "picture"]
    : ["-vf", vf];
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), ...args, "-loop", "0", out]);
  if (!process.argv.includes("--keep-frames")) await rm(dir, { recursive: true, force: true });
  const size = (await readFile(out)).length;
  console.log(`${path.basename(out)}: ${recorded.length} frames, ${(size / 1024 / 1024).toFixed(2)} MB`);
}

// ----- scenarios -----
const scenarios = {
  async stats() {
    await setTheme("aurora");
    await goHome();
    await sleep(800);
    await ev(`window.__playlistPrism.openStats(${JSON.stringify(TTH)})`);
    await waitFor(`!!document.querySelector('[data-prism-view="stats"] .prism-bubble')`, 15000);
    await sleep(1200);
    const box = await rect('[data-prism="page"]');
    await startRec();
    await sleep(2500);
    await clickAt(".prism-bubble");
    await sleep(2200);
    const rec = await stopRec();
    await toGif("stats", rec, { x: box.x - 16, y: Math.max(0, box.y - 8), w: box.w + 32, h: Math.min(box.h, (box.w + 32) * 0.6) });
  },

  async "side-panel"() {
    await setTheme("aurora");
    await go("/playlist/37i9dQZF1DXcBWIGoYBM5M");
    if (await waitFor(`!!document.querySelector('[data-prism="panel-tab-stats"]')`, 15000)) await clickAt('[data-prism="panel-tab-stats"]');
    await sleep(3000);
    await startRec();
    await sleep(4000);
    const rec = await stopRec();
    const side = await rect(".Root__right-sidebar");
    await toGif("side-panel", rec, { x: side.x, y: side.y, w: side.w, h: Math.min(side.h, side.w * 1.5) }, Math.min(420, Math.round(side.w)));
  },

  async themes() {
    await setTheme("none");
    await go("/playlist/37i9dQZF1DXcBWIGoYBM5M");
    await waitFor(`!!document.querySelector(".main-trackList-indexable")`, 15000);
    await scrollTop0();
    await sleep(1500);
    const main = await rect(".Root__main-view");
    await startRec();
    await sleep(1300);
    for (const t of ["aurora", "blossom", "rain", "milkyway"]) { await setTheme(t); await sleep(2000); }
    const rec = await stopRec();
    await toGif("themes", rec, main, 640);
  },

  // Grow: seed chips, then the ranked preview (the source picker isn't recorded: it lists your playlists).
  async grow() {
    await setTheme("aurora");
    await ev(`window.__playlistPrism.startPrism(${JSON.stringify(SEED)})`);
    if (!(await waitFor(`!!document.querySelector('[data-prism-state="ready"]')`, 60000))) throw new Error("seed panel didn't load");
    await clickButton("Next");
    await waitFor(`!!document.querySelector('[data-uri=${JSON.stringify(TTH)}]')`, 15000);
    await ev(`document.querySelector('[data-uri=${JSON.stringify(TTH)}]').click()`);
    await sleep(300);
    await clickButton("scan");
    if (!(await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 240000))) throw new Error("scan didn't finish");
    await clickButton("see matches");
    await waitFor(`!!document.querySelector('[data-prism-state="preview"]')`, 15000);
    await waitFor(`!/Looking/.test(document.querySelector('[data-prism="new-status"]')?.textContent || "")`, 120000);
    await scrollTop0();
    await sleep(1000);
    const box = await rect('[data-prism="page"]');
    await startRec();
    await sleep(1000);
    await hover('[data-prism="preview-list"] label');
    await sleep(1600);
    for (let i = 0; i < 12; i++) { await ev(`document.querySelector('[data-prism="preview-list"]').scrollBy(0, 14)`); await sleep(110); }
    await sleep(1200);
    const rec = await stopRec();
    await toGif("grow", rec, pageCrop(box, 0.85));
  },

  async remix() {
    await setTheme("aurora");
    await goHome();
    await waitFor(`!!document.querySelector('[data-prism="flip-organize"]')`, 10000);
    await ev(`document.querySelector('[data-prism="flip-organize"]').click()`);
    await sleep(600);
    await ev(`document.querySelector('[data-prism="start-organize"]').click()`);
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
    await toGif("remix", rec, pageCrop(await rect('[data-prism="page"]'), 0.85));
  },

  async "add-with-prism"() {
    await setTheme("aurora");
    await goHome();
    await sleep(800);
    await startRec();
    await sleep(500);
    await ev(`window.__playlistPrism.openAddTo(${JSON.stringify(SEED)})`);
    await waitFor(`!!document.querySelector('[data-prism="addto-row"]')`, 60000);
    await sleep(2500);
    await hover('[data-prism="addto-row"] button');
    await sleep(1500);
    const rec = await stopRec();
    await toGif("add-with-prism", rec, pageCrop(await rect('[data-prism="page"]'), 0.85));
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
    await sleep(1200);
    const strip = await rect("[data-prism-tone-strip]");
    const main = await rect(".Root__main-view");
    await startRec();
    await sleep(900);
    await clickAt("[data-prism-tone-strip] .prism-toggle");
    await sleep(3800);
    const rec = await stopRec();
    await toGif("tone", rec, { x: main.x, y: main.y, w: main.w, h: main.h }, 640);
  },
};

const name = process.argv[2];
if (!scenarios[name]) { console.log("Scenarios: " + Object.keys(scenarios).join(", ")); process.exit(1); }
const SAVED_KEYS = ["prism:tones", "prism:playlistTheme", "prism:playlistThemes", "prism:growCount", "prism:growNewCount"];
const saved = await ev(`(${JSON.stringify(SAVED_KEYS)}).map((k) => [k, Spicetify.LocalStorage.get(k)])`);
try {
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Page.setWebLifecycleState", { state: "active" });
  await send("Emulation.setDeviceMetricsOverride", { ...VIEW, deviceScaleFactor: 1, mobile: false });
  await sleep(800);
  await scenarios[name]();
} finally {
  // Put the user's own settings back.
  await ev(`${JSON.stringify(saved)}.forEach(([k, v]) => v == null ? Spicetify.LocalStorage.remove(k) : Spicetify.LocalStorage.set(k, v))`);
  await fire("playlist-prism:tones-changed");
  await fire("playlist-prism:playlist-theme-changed");
  await send("Emulation.clearDeviceMetricsOverride");
  ws.close();
}
