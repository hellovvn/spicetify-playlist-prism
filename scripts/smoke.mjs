// Smoke test: checks the extension INSIDE the running Spotify app.
//
// How it works: when `spicetify watch -e` is running, Spotify has a debug
// port open on 127.0.0.1:9222 (only reachable from this computer). This
// script connects to it with the Chrome DevTools Protocol (CDP), the same
// connection DevTools uses, and runs checks against window.__playlistPrism
// (the read-only debug hook in src/app.tsx).
//
// READ-ONLY by design: it never creates, changes, or deletes anything in
// Spotify, and never prints the Last.fm API key.
//
// Usage:  npm run smoke
// Output: pass/fail list in the terminal, screenshots in smoke-output/.
// Exit code 0 = all checks passed, 1 = something failed.

import { readFile, mkdir, writeFile } from "node:fs/promises";

const DEBUG_PORT = 9222;
const fixtures = JSON.parse(await readFile(new URL("../tests/fixtures/lastfm-tags.json", import.meta.url), "utf8"));
const outputDir = new URL("../smoke-output/", import.meta.url);

// ---------- tiny CDP client ----------

async function connect() {
  let targets;
  try {
    targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  } catch {
    throw new Error(`Can't reach Spotify's debug port ${DEBUG_PORT}. Is "spicetify watch -e" running?`);
  }
  const page = targets.find((t) => t.type === "page" && t.url.startsWith("https://xpui.app.spotify.com"));
  if (!page) throw new Error("Spotify's main page wasn't found on the debug port.");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  // CDP is request/response over one websocket: each request has an id,
  // and we match the reply with the same id.
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  // Runs a JS expression in Spotify and returns its (JSON) value.
  async function evaluate(expression) {
    const msg = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    const details = msg.result?.exceptionDetails;
    if (details) throw new Error(details.exception?.description ?? details.text);
    return msg.result?.result?.value;
  }

  return { send, evaluate, close: () => ws.close() };
}

// ---------- test bookkeeping ----------

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`${passed ? "  PASS" : "  FAIL"}  ${name}${detail ? `  ->  ${detail}` : ""}`);
}
function info(text) {
  console.log(`        ${text}`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- the checks ----------

const cdp = await connect();
try {
  console.log("\n[1] Extension loaded");
  // After a reload the hook can take a moment to appear, so wait up to 10 s.
  let hookFound = false;
  for (let i = 0; i < 20 && !hookFound; i++) {
    hookFound = await cdp.evaluate("!!window.__playlistPrism");
    if (!hookFound) await sleep(500);
  }
  check("debug hook window.__playlistPrism exists", hookFound);
  if (!hookFound) throw new Error("Extension not loaded; stopping.");

  const hasKey = await cdp.evaluate("window.__playlistPrism.hasLastfmKey()");
  check("a Last.fm key is saved", hasKey);

  console.log("\n[2] Right-click menu: when should 'Start a Prism playlist' appear?");
  const menuCases = [
    ["one song", ["spotify:track:4PhsKqMdgMEUSstTDAmMpg"], true],
    ["two songs (multi-select)", ["spotify:track:4PhsKqMdgMEUSstTDAmMpg", "spotify:track:047fCsbO4NdmwCBn8pcUXl"], false],
    ["an album", ["spotify:album:4EByBr42E22IoEcQyGOsj9"], false],
    ["an artist", ["spotify:artist:3TVXtAsR1Inumwj472S9r4"], false],
    ["a playlist", ["spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"], false],
    ["nothing", [], false],
  ];
  for (const [label, uris, expected] of menuCases) {
    const actual = await cdp.evaluate(`window.__playlistPrism.isSingleTrack(${JSON.stringify(uris)})`);
    check(`${label}: ${expected ? "shown" : "hidden"}`, actual === expected, actual === expected ? "" : `got ${actual}`);
  }

  console.log("\n[3] Song lookup + live Last.fm tags + cleanup (fixture songs)");
  for (const song of fixtures.songs) {
    const track = await cdp.evaluate(`window.__playlistPrism.getTrackInfo(${JSON.stringify(song.uri)})`);
    check(`Spotify lookup: ${song.title}`, track?.name === song.title, track?.name === song.title ? "" : `got "${track?.name}"`);
    if (!track) continue;

    if (hasKey) {
      // Same as the extension: main artist + exact title.
      const live = await cdp.evaluate(
        `window.__playlistPrism.getTrackTopTags(${JSON.stringify(track.artists[0])}, ${JSON.stringify(track.name)})`
      );
      const cleaned = await cdp.evaluate(
        `window.__playlistPrism.cleanTags(${JSON.stringify(live.tags)}, { artistNames: ${JSON.stringify(track.artists)} })`
      );
      const variants = await cdp.evaluate(`window.__playlistPrism.titleVariants(${JSON.stringify(track.name)})`);
      // Live Last.fm data can change over time, so differences from the
      // recorded fixture are reported as info, not as failures.
      const drift = live.tags.length !== song.tags.length ? `  (fixture had ${song.tags.length})` : "";
      info(`raw: ${live.tags.length} tags${drift}`);
      info(`clean: ${cleaned.map((t) => `${t.name} ${t.weight.toFixed(2)}`).join(", ") || "(none)"}`);
      if (variants.length > 1) info(`title variants: ${variants.join("  |  ")}`);
      await sleep(300); // be polite to Last.fm's rate limit
    }
  }

  console.log("\n[4] Settings popup (screenshot)");
  await mkdir(outputDir, { recursive: true });
  await cdp.evaluate("window.__playlistPrism.openSettings()");
  await sleep(800); // let React draw it
  const visible = await cdp.evaluate(
    `[...document.querySelectorAll("h1, h2")].some((el) => el.textContent.includes("Playlist Prism settings"))`
  );
  check("settings popup opens with its title", visible);
  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  const shotPath = new URL("settings.png", outputDir);
  await writeFile(shotPath, Buffer.from(shot.result.data, "base64"));
  info(`screenshot: smoke-output/settings.png`);
  await cdp.evaluate("Spicetify.PopupModal.hide()");
} catch (error) {
  check("smoke test ran to the end", false, error.message);
} finally {
  cdp.close();
}

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
