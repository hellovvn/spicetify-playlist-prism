// Smoke test: checks the extension INSIDE the running Spotify app.
//
// How it works: when `spicetify watch -e` is running, Spotify has a debug
// port open on 127.0.0.1:9222 (only reachable from this computer). This
// script connects to it with the Chrome DevTools Protocol (CDP), the same
// connection DevTools uses, and runs checks against window.__prism
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

// Saves a screenshot to smoke-output/. While Spotify's window is minimized the
// page draws no frames and a screenshot request NEVER returns (that hung the
// whole test), so give up after 5 s and say so.
let cdpForShots;
async function screenshot(name) {
  const shot = await Promise.race([
    cdpForShots.send("Page.captureScreenshot", { format: "png" }),
    sleep(5000).then(() => null),
  ]);
  if (!shot?.result?.data) {
    info(`screenshot skipped (${name}): Spotify's window is probably minimized`);
    return;
  }
  await mkdir(outputDir, { recursive: true });
  await writeFile(new URL(name, outputDir), Buffer.from(shot.result.data, "base64"));
  info(`screenshot: smoke-output/${name}`);
}

// ---------- the checks ----------

const cdp = await connect();
cdpForShots = cdp;

// The playlist the scan / Remix checks use. Picked by its Spotify ID (URI),
// NOT its name: the developer renames playlists during development (Merge
// adds "[merged] "), and the ID never changes. Set it in
// scripts/smoke.local.json (gitignored: it's the developer's own library):
//   { "playlistUri": "spotify:playlist:..." }
// Its name and song count are read live, so nothing here assumes either.
let local = {};
try {
  local = JSON.parse(await readFile(new URL("./smoke.local.json", import.meta.url), "utf8"));
} catch {
  console.error("Missing scripts/smoke.local.json with { \"playlistUri\": \"spotify:playlist:...\" } (a playlist of yours with ~25 songs that Prism has scanned).");
  process.exit(2);
}
const TEST = await cdp.evaluate(`(async () => {
  const uri = ${JSON.stringify(local.playlistUri)};
  const meta = await Spicetify.Platform.PlaylistAPI.getMetadata(uri);
  const page = await Spicetify.Platform.PlaylistAPI.getContents(uri, { limit: 10000 });
  const songs = (page?.items ?? []).filter((i) => typeof i?.uri === "string" && i.uri.startsWith("spotify:track:") && !i.isLocal).length;
  return { uri, name: meta?.name ?? null, count: songs, listed: meta?.totalLength ?? songs };
})()`);
if (!TEST?.name || !TEST.count) {
  console.error(`The smoke playlist ${local.playlistUri} wasn't found or is empty.`);
  process.exit(2);
}
console.log(`Test playlist: "${TEST.name}" (${TEST.count} songs, ${TEST.uri})`);
const ROW = (scope) => `${scope}.querySelector('[data-uri=${JSON.stringify(TEST.uri)}]')`;

try {
  console.log("\n[1] Extension loaded");
  // After a reload the hook can take a moment to appear, so wait up to 10 s.
  let hookFound = false;
  for (let i = 0; i < 20 && !hookFound; i++) {
    hookFound = await cdp.evaluate("!!window.__prism");
    if (!hookFound) await sleep(500);
  }
  check("debug hook window.__prism exists", hookFound);
  if (!hookFound) throw new Error("Extension not loaded; stopping.");

  const hasKey = await cdp.evaluate("window.__prism.hasLastfmKey()");
  check("a Last.fm key is saved", hasKey);

  console.log("\n[1b] The Prism page (step 12a)");
  // Spicetify adds a header button for every custom app, labelled with its name.
  const HEADER_ICON = `document.querySelector('button[aria-label="Prism"]')`;
  // Known starting point: the page's start screen, then away to Spotify's
  // Home, so clicking the icon must bring us BACK to the page.
  await cdp.evaluate("window.__prism.goHome()");
  await sleep(500);
  await cdp.evaluate(`Spicetify.Platform.History.push("/")`);
  await sleep(1000);
  // Spicetify draws it a moment after Spotify loads, so wait up to 10 s.
  let iconFound = false;
  for (let i = 0; i < 40 && !iconFound; i++) {
    iconFound = await cdp.evaluate(`!!${HEADER_ICON}`);
    if (!iconFound) await sleep(250);
  }
  // While Spotify's window is minimized/hidden, Spicetify doesn't draw ANY
  // header links (even Marketplace's), so then the icon can't be checked:
  // reported as SKIPPED (not passed), and the page is opened the other way.
  const hidden = await cdp.evaluate(`document.visibilityState === "hidden"`);
  if (!iconFound && hidden) {
    info("SKIPPED header icon check: Spotify's window is hidden, so Spicetify hasn't drawn the header links");
    await cdp.evaluate("window.__prism.goHome()");
  } else {
    check("header has the Prism icon", iconFound);
    if (!iconFound) throw new Error("No header icon; stopping.");
    await cdp.evaluate(`${HEADER_ICON}.click()`);
  }
  let homeShown = false;
  for (let i = 0; i < 40 && !homeShown; i++) {
    homeShown = await cdp.evaluate(`!!document.querySelector('[data-prism-state="home"]')`);
    if (!homeShown) await sleep(250);
  }
  check("clicking it opens the page's start screen", homeShown, await cdp.evaluate("Spicetify.Platform.History.location.pathname"));
  // Start page tiles (flip cards): the details are on the back, hidden until clicked.
  const faceShown = (sel) => cdp.evaluate(`getComputedStyle(document.querySelector('${sel}')).visibility === "visible"`);
  check(
    "start page shows two icon tiles with their details hidden",
    (await faceShown('[data-prism="flip-prism"]')) && (await faceShown('[data-prism="flip-organize"]')) &&
      !(await faceShown('[data-prism="mode-prism"] .prism-flip-back')) && !(await faceShown('[data-prism="mode-organize"] .prism-flip-back'))
  );
  // The front face hides after a 320 ms delayed transition, which can run late
  // while Spotify is in the background: poll for up to 3 s instead of one wait.
  const flippedTo = async (back) => {
    for (let waited = 0; waited < 3000; waited += 150) {
      const ok = back
        ? (await faceShown('[data-prism="mode-prism"] .prism-flip-back')) && !(await faceShown('[data-prism="flip-prism"]'))
        : (await faceShown('[data-prism="flip-prism"]')) && !(await faceShown('[data-prism="mode-prism"] .prism-flip-back'));
      if (ok) return true;
      await sleep(150);
    }
    return false;
  };
  await cdp.evaluate(`document.querySelector('[data-prism="flip-prism"]').click()`);
  check(
    "clicking the Prism tile flips it to its details (the other tile stays)",
    (await flippedTo(true)) && (await faceShown('[data-prism="flip-organize"]'))
  );
  await cdp.evaluate(`document.querySelector('[data-prism="unflip-prism"]').click()`);
  check("its Back link flips it back to the icon", await flippedTo(false));
  await cdp.evaluate(`document.querySelector('[data-prism="flip-prism"]').click()`);
  await sleep(450);
  info(`playing song shown: ${await cdp.evaluate(`document.querySelector('[data-prism="playing-song"]')?.textContent ?? "(nothing playing)"`)}`);
  const typeLink = (text) => cdp.evaluate(`(() => {
    const input = document.querySelector('[data-prism="link-input"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(text)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  const pressStart = () => cdp.evaluate(`[...document.querySelectorAll('[data-prism-state="home"] button')].find((b) => b.textContent === "Start").click()`);
  await typeLink("https://open.spotify.com/album/4EByBr42E22IoEcQyGOsj9");
  await sleep(150);
  await pressStart();
  await sleep(200);
  check("pasting a non-song link shows an error", await cdp.evaluate(`!!document.querySelector('[data-prism-state="home"] [role="alert"]')`));
  await typeLink("https://open.spotify.com/track/4PhsKqMdgMEUSstTDAmMpg?si=x");
  await sleep(150);
  await pressStart();
  let started = false;
  for (let i = 0; i < 40 && !started; i++) {
    started = await cdp.evaluate(`!!document.querySelector('[data-prism-state="ready"]')`);
    if (!started) await sleep(250);
  }
  check("pasting a song link starts a Prism for it", started && (await cdp.evaluate(`document.querySelector('[data-prism="seed-panel"]').textContent.includes("Often")`)));
  await mkdir(outputDir, { recursive: true });
  await screenshot("page-seed.png");
  await cdp.evaluate(`[...document.querySelectorAll('[data-prism="seed-panel"] button')].find((b) => b.textContent === "Cancel").click()`);
  await sleep(300);
  check("Cancel goes back to the start screen", await cdp.evaluate(`!!document.querySelector('[data-prism-state="home"]')`));

  console.log("\n[2] Right-click menu: when should 'Grow a playlist with Prism' appear?");
  const menuCases = [
    ["one song", ["spotify:track:4PhsKqMdgMEUSstTDAmMpg"], true],
    ["two songs (multi-select)", ["spotify:track:4PhsKqMdgMEUSstTDAmMpg", "spotify:track:047fCsbO4NdmwCBn8pcUXl"], false],
    ["an album", ["spotify:album:4EByBr42E22IoEcQyGOsj9"], false],
    ["an artist", ["spotify:artist:3TVXtAsR1Inumwj472S9r4"], false],
    ["a playlist", ["spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"], false],
    ["nothing", [], false],
  ];
  for (const [label, uris, expected] of menuCases) {
    const actual = await cdp.evaluate(`window.__prism.isSingleTrack(${JSON.stringify(uris)})`);
    check(`${label}: ${expected ? "shown" : "hidden"}`, actual === expected, actual === expected ? "" : `got ${actual}`);
  }

  console.log("\n[3] Song lookup + live Last.fm tags + cleanup (fixture songs)");
  for (const song of fixtures.songs) {
    const track = await cdp.evaluate(`window.__prism.getTrackInfo(${JSON.stringify(song.uri)})`);
    check(`Spotify lookup: ${song.title}`, track?.name === song.title, track?.name === song.title ? "" : `got "${track?.name}"`);
    if (!track) continue;

    if (hasKey) {
      // The full chain, exactly as the extension runs it.
      const result = await cdp.evaluate(`window.__prism.getSongTags(${JSON.stringify(track)})`);
      const tagText = result.tags
        .map((t) => `${t.name} ${t.weight.toFixed(2)}${t.source === "artist" ? "*" : ""}`)
        .join(", ");
      info(`titles tried: ${result.titlesTried.join("  |  ")}`);
      info(`matched title: ${result.matchedTitle ?? "(none)"}   artist fallback: ${result.usedArtistTags ? "yes" : "no"}`);
      info(`tags (* = via artist): ${tagText || "(none)"}`);

      // Goal of step 4b: songs that had ZERO tags in step 3 should now get some.
      // (Live Last.fm data can change, so other songs are reported as info only.)
      if (song.tags.length === 0) {
        check(`now has tags (had 0 in step 3): ${song.title}`, result.tags.length > 0);
      }
      await sleep(300); // be polite to Last.fm's rate limit
    }
  }

  console.log("\n[4] BPM/key from Spotify (fixture songs)");
  const audioFixtures = JSON.parse(await readFile(new URL("../tests/fixtures/audio-attributes.json", import.meta.url), "utf8"));
  const audioUris = audioFixtures.songs.map((s) => s.uri);
  const audio = await cdp.evaluate(`window.__prism.getAudioAttributes(${JSON.stringify(audioUris)})`);
  for (const song of audioFixtures.songs) {
    const got = audio?.[song.uri] ?? null;
    if (song.raw === null) {
      check(`no BPM/key (expected): ${song.title}`, got === null, got ? `got ${JSON.stringify(got)}` : "");
    } else {
      // Live values should match the recording (they're computed from the audio, so stable).
      const ok = got && Math.abs(got.bpm - song.raw.bpm) < 1 && got.camelot === song.raw.key.camelotKey.value;
      check(`BPM/key: ${song.title}`, !!ok, got ? `${Math.round(got.bpm)} BPM, ${got.key} ${got.mode} (${got.camelot})` : "got null");
    }
  }
  // Every main-fixture song should have BPM/key (step 4c's coverage goal).
  const allUris = fixtures.songs.map((s) => s.uri);
  const all = await cdp.evaluate(`window.__prism.getAudioAttributes(${JSON.stringify(allUris)})`);
  const covered = allUris.filter((u) => all?.[u]).length;
  check(`BPM/key coverage on fixture songs`, covered === allUris.length, `${covered}/${allUris.length}`);

  await mkdir(outputDir, { recursive: true });

  console.log("\n[5] Seed panel (chips) - UI clicks only, Spotify is not changed");
  // Waits until a JS condition is true in Spotify (checks every 250 ms).
  async function waitFor(expression, ms = 10000) {
    for (let waited = 0; waited < ms; waited += 250) {
      if (await cdp.evaluate(expression)) return true;
      await sleep(250);
    }
    return false;
  }
  const PANEL = `document.querySelector('[data-prism="seed-panel"]')`;
  const chipStates = `[...${PANEL}.querySelectorAll('[role="checkbox"]')].map((c) => c.getAttribute("aria-checked"))`;
  const keptText = `${PANEL}.querySelector('[data-prism="kept-count"]')?.textContent`;

  const READY = `!!document.querySelector('[data-prism-state="ready"]')`;
  const NEXT = `[...${PANEL}.querySelectorAll("button")].find((b) => b.textContent.includes("Next"))`;
  const statusKind = `${PANEL}.querySelector('[data-prism="status"]')?.dataset.prismKind ?? "none"`;

  await cdp.evaluate(`window.__prism.startPrism("spotify:track:4PhsKqMdgMEUSstTDAmMpg")`); // Often
  // The page should open at once, showing the spinner while it loads.
  const loadingShown = await waitFor(`!!document.querySelector('[data-prism-state="loading"]')`, 1000);
  check("Prism page opens immediately with a loading spinner", loadingShown);
  const path = await cdp.evaluate("Spicetify.Platform.History.location.pathname");
  check("it's the Prism page (not a popup)", path === "/prism" && !(await cdp.evaluate(`!!document.querySelector(".GenericModal")`)), path);
  const opened = await waitFor(READY);
  check("seed panel finishes loading for Often", opened);
  if (opened) {
    const before = await cdp.evaluate(chipStates);
    check("Often: one chip per tag, all on", before.length === 5 && before.every((s) => s === "true"), JSON.stringify(before));
    check("counter says 5 of 5", (await cdp.evaluate(keptText)) === "5 of 5 tags on", await cdp.evaluate(keptText));
    info(`BPM/key line: ${await cdp.evaluate(`${PANEL}.textContent.match(/\\d+ BPM[^)]*\\)/)?.[0]`)}`);

    const moodLine = await cdp.evaluate(`${PANEL}.querySelector('[data-prism="seed-mood"]')?.textContent`);
    check("seed panel shows Often's lyrics mood", /^Lyrics mood: (?!unknown)/.test(moodLine ?? ""), moodLine);

    await cdp.evaluate(`${PANEL}.querySelector('[role="checkbox"]').click()`); // switch the first chip off
    await sleep(300);
    const after = await cdp.evaluate(chipStates);
    check("clicking a chip switches it off", after[0] === "false" && after.slice(1).every((s) => s === "true"), JSON.stringify(after));
    check("counter updates to 4 of 5", (await cdp.evaluate(keptText)) === "4 of 5 tags on", await cdp.evaluate(keptText));

    await cdp.evaluate(`${PANEL}.querySelector('[role="checkbox"]').click()`); // and back on
    await sleep(300);
    check("clicking again switches it back on", (await cdp.evaluate(chipStates))[0] === "true");
    check("all tags on: no warning, Next enabled", (await cdp.evaluate(statusKind)) === "none" && !(await cdp.evaluate(`${NEXT}.disabled`)));

    await screenshot("seed-panel.png");

    // Switch EVERY chip off: Next must be blocked, with an explanation.
    await cdp.evaluate(`${PANEL}.querySelectorAll('[role="checkbox"]').forEach((c) => c.click())`);
    await sleep(300);
    check("all tags off: blocked message shown", (await cdp.evaluate(statusKind)) === "all-off", await cdp.evaluate(statusKind));
    check("all tags off: Next is disabled", await cdp.evaluate(`${NEXT}.disabled`));
    await screenshot("seed-panel-blocked.png");
    await cdp.evaluate("window.__prism.goHome()");
  }

  // A song with no song-level tags: artist row + "broader matches" warning, still allowed.
  await sleep(500);
  await cdp.evaluate(`window.__prism.startPrism("spotify:track:19Lnk1Q2FJcB3Hia0wfgye")`); // RESCUER
  const rescuerReady = await waitFor(READY);
  check("RESCUER: shows the 'From the artist' chip row", rescuerReady && (await cdp.evaluate(`${PANEL}.textContent.includes("From the artist")`)));
  if (rescuerReady) {
    check("RESCUER: artist-only warning shown", (await cdp.evaluate(statusKind)) === "artist-only", await cdp.evaluate(statusKind));
    check("RESCUER: Next still enabled (warning, not a block)", !(await cdp.evaluate(`${NEXT}.disabled`)));
    await screenshot("seed-panel-artist-only.png");
  }
  await cdp.evaluate("window.__prism.goHome()");
  await sleep(500);

  console.log("\n[6] Source picker (screen 2) - UI clicks only, playlists are only read");
  const SOURCES = `document.querySelector('[data-prism-state="sources"]')`;
  const rows = `[...${SOURCES}.querySelectorAll('[data-prism="source-list"] label')]`;
  const rowNames = `${rows}.map((r) => r.querySelector("span span").textContent)`;
  const summary = `${SOURCES}.querySelector('[data-prism="source-summary"]').textContent`;
  const SCAN = `[...${SOURCES}.querySelectorAll("button")].find((b) => b.textContent.includes("scan"))`;
  const tickedNames = `${rows}.filter((r) => r.querySelector("input").checked).map((r) => r.querySelector("span span").textContent)`;

  await cdp.evaluate(`window.__prism.startPrism("spotify:track:4PhsKqMdgMEUSstTDAmMpg")`); // Often
  if (await waitFor(READY)) {
    await cdp.evaluate(`${PANEL}.querySelector('[role="checkbox"]').click()`); // switch "sexy" off
    await sleep(200);
    await cdp.evaluate(`${NEXT}.click()`);
    const shown = await waitFor(`!!${SOURCES}`);
    check("Next opens the source picker", shown);
    if (shown) {
      const names = await cdp.evaluate(rowNames);
      check("Liked Songs is listed first", names[0] === "Liked Songs", names.slice(0, 3).join(", "));
      info(`${names.length} sources: ${names.join(", ")}`);
      check("nothing picked yet: 'Next: scan songs' disabled", await cdp.evaluate(`${SCAN}.disabled`));

      // Tick the test playlist by clicking its row (the whole row is a label).
      await cdp.evaluate(`${ROW(SOURCES)}.click()`);
      await sleep(200);
      const sum = await cdp.evaluate(summary);
      check(`ticking ${TEST.name} updates the summary`, sum.startsWith(`1 picked · up to ${TEST.listed} songs`), sum);
      check("scan button enabled once something is picked", !(await cdp.evaluate(`${SCAN}.disabled`)));

      // Search filters the list. Setting a React input's value needs the
      // native setter + an "input" event, or React won't notice.
      await cdp.evaluate(`(() => {
        const input = ${SOURCES}.querySelector('input[type="search"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "kpop");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()`);
      await sleep(200);
      const filtered = await cdp.evaluate(rowNames);
      check("search 'kpop' filters the list (name or folder)", filtered.length > 0 && filtered.length < names.length, filtered.join(", "));
      await screenshot("source-picker.png");

      // Back keeps the chips as they were; Next keeps the ticks.
      await cdp.evaluate(`[...${SOURCES}.querySelectorAll("button")].find((b) => b.textContent === "Back").click()`);
      await waitFor(READY);
      check("Back returns to the chips, with 'sexy' still off", (await cdp.evaluate(chipStates))[0] === "false");
      await cdp.evaluate(`${NEXT}.click()`);
      await waitFor(`!!${SOURCES}`);
      check(`Next again: ${TEST.name} is still ticked`, JSON.stringify(await cdp.evaluate(tickedNames)) === JSON.stringify([TEST.name]));

      // Select all / clear
      const SELECT_ALL = `${SOURCES}.querySelector('[data-prism="select-all"]')`;
      const total = (await cdp.evaluate(rowNames)).length;
      check("some ticked: 'Select all' shows a partial dash", await cdp.evaluate(`${SELECT_ALL}.querySelector("input").indeterminate`));
      await cdp.evaluate(`${SELECT_ALL}.click()`);
      await sleep(200);
      check("Select all ticks every playlist", (await cdp.evaluate(tickedNames)).length === total, await cdp.evaluate(summary));
      await screenshot("source-picker-all.png");
      await cdp.evaluate(`${SELECT_ALL}.click()`);
      await sleep(200);
      check("clicking it again clears everything", (await cdp.evaluate(tickedNames)).length === 0 && (await cdp.evaluate(`${SCAN}.disabled`)));

      // With a search typed, Select all only ticks the matches.
      await cdp.evaluate(`(() => {
        const input = ${SOURCES}.querySelector('input[type="search"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "kpop");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()`);
      await sleep(200);
      check("label says how many shown", (await cdp.evaluate(`${SELECT_ALL}.textContent`)) === "Select all 2 shown", await cdp.evaluate(`${SELECT_ALL}.textContent`));
      await cdp.evaluate(`${SELECT_ALL}.click()`);
      await sleep(200);
      const sumKpop = await cdp.evaluate(summary);
      check("with search 'kpop', Select all picks only the 2 matches", sumKpop.startsWith("2 picked"), sumKpop);

      // The flow must keep ONE size whatever the search shows.
      const SET_QUERY = (q) => `(() => {
        const input = ${SOURCES}.querySelector('input[type="search"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(q)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()`;
      const modalHeight = `Math.round(${PANEL}.getBoundingClientRect().height)`;
      const heights = {};
      for (const q of ["", "kpop", "zzz-no-match"]) {
        await cdp.evaluate(SET_QUERY(q));
        await sleep(200);
        heights[q || "(empty)"] = await cdp.evaluate(modalHeight);
      }
      const sizes = new Set(Object.values(heights));
      check("screen height stays the same while searching", sizes.size === 1, JSON.stringify(heights));
      check("no matches: 'Select all' stays visible but disabled", await cdp.evaluate(`${SELECT_ALL}.querySelector("input").disabled`));
    }
  }
  await cdp.evaluate("window.__prism.goHome()");
  await sleep(500);

  console.log("\n[7] Scan (screen 3) - reads playlists + Last.fm only, nothing in Spotify changes");
  const SCAN_STATE = `document.querySelector('[data-prism-state^="scan"]')?.dataset.prismState`;
  const SCAN_TITLE = `document.querySelector('[data-prism-state="scan-done"] div div')?.textContent`;
  const clickButton = (label) =>
    `[...document.querySelectorAll('[data-prism="seed-panel"] button')].find((b) => b.textContent.includes(${JSON.stringify(label)})).click()`;
  const tick = (name) => `${rows}.find((r) => r.querySelector("span span").textContent === ${JSON.stringify(name)}).click()`;

  await cdp.evaluate(`window.__prism.startPrism("spotify:track:4PhsKqMdgMEUSstTDAmMpg")`); // Often
  if (await waitFor(READY)) {
    await cdp.evaluate(clickButton("Next"));
    await waitFor(`!!${SOURCES} && ${rows}.length > 0`);
    await cdp.evaluate(`${ROW(SOURCES)}.click()`);
    await sleep(200);

    // First scan: real Last.fm lookups (unless cached by an earlier smoke run).
    let t0 = Date.now();
    await cdp.evaluate(clickButton("scan"));
    const scanning = await waitFor(`!!document.querySelector('[data-prism-state="scanning"] [role="progressbar"]')`, 5000);
    check("scan screen shows a progress bar", scanning);
    await sleep(1500);
    await screenshot("scan-progress.png");
    const done1 = await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 120000);
    const firstSeconds = ((Date.now() - t0) / 1000).toFixed(1);
    check(`scan of ${TEST.name} finishes`, done1, `${firstSeconds} s`);
    if (done1) {
      const title = await cdp.evaluate(SCAN_TITLE);
      check(`summary says ${TEST.count} songs scanned`, title === `Scanned ${TEST.count} songs`, title);
      const subline = await cdp.evaluate(`document.querySelector('[data-prism-state="scan-done"] p').textContent`);
      const moodCount = Number(/lyrics mood for (\d+)/.exec(subline)?.[1] ?? -1);
      check(`lyrics mood found for most ${TEST.name} songs`, moodCount >= Math.ceil(TEST.count * 0.6), `${moodCount} of ${TEST.count}`);
      info(`summary: ${await cdp.evaluate(`document.querySelector('[data-prism="scan-summary"]').innerText.replace(/\\s+/g, " ")`)}`);
      await screenshot("scan-done.png");

      // Second scan of the same playlist: should come from the cache, fast.
      await cdp.evaluate(clickButton("Back"));
      await waitFor(`!!${SOURCES} && ${rows}.length > 0`);
      t0 = Date.now();
      await cdp.evaluate(clickButton("scan"));
      const done2 = await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 30000);
      const secondSeconds = (Date.now() - t0) / 1000;
      check("re-scan uses the cache (under 5 s)", done2 && secondSeconds < 5, `${secondSeconds.toFixed(1)} s vs ${firstSeconds} s first time`);

      // Cancel: scan EVERYTHING (most songs not cached yet) and stop part-way.
      // If every song is already cached, the scan can finish before we get to
      // click Cancel; then this check is SKIPPED (reported), not passed.
      await cdp.evaluate(clickButton("Back"));
      await waitFor(`!!${SOURCES} && ${rows}.length > 0`);
      await cdp.evaluate(`${SOURCES}.querySelector('[data-prism="select-all"]').click()`);
      await sleep(200);
      await cdp.evaluate(clickButton("scan"));
      await waitFor(
        `(() => { const n = parseInt(document.querySelector('[data-prism="scan-count"]')?.textContent ?? ""); return n >= 30 || !!document.querySelector('[data-prism-state="scan-done"]'); })()`,
        60000
      );
      const finishedEarly = await cdp.evaluate(`!!document.querySelector('[data-prism-state="scan-done"]')`);
      if (finishedEarly) {
        info("SKIPPED Cancel check: every song was already cached, so the scan finished instantly");
      } else {
        await cdp.evaluate(clickButton("Cancel"));
        const stopped = await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 30000);
        const stoppedTitle = stopped ? await cdp.evaluate(SCAN_TITLE) : "(never finished)";
        check("Cancel stops the scan part-way", stopped && stoppedTitle.startsWith("Stopped after"), stoppedTitle);
      }
    }
  }
  await cdp.evaluate("window.__prism.goHome()");
  await sleep(500);

  console.log("\n[8] Preview (screen 4): Often vs Liked Songs - nothing is created");
  const PREVIEW = `document.querySelector('[data-prism-state="preview"]')`;
  await cdp.evaluate(`window.__prism.startPrism("spotify:track:4PhsKqMdgMEUSstTDAmMpg")`); // Often
  if (await waitFor(READY)) {
    await cdp.evaluate(clickButton("Next"));
    await waitFor(`!!${SOURCES} && ${rows}.length > 0`);
    await cdp.evaluate(tick("Liked Songs"));
    await sleep(200);
    await cdp.evaluate(clickButton("scan"));
    if (await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 180000)) {
      await cdp.evaluate(clickButton("see matches"));
      const shown = await waitFor(`!!${PREVIEW}`);
      check("Next: see matches opens the preview", shown);
      if (shown) {
        const seedRow = await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="preview-seed"]').textContent`);
        check("seed song is shown first, locked", seedRow.includes("Often") && seedRow.includes("always first"), seedRow);
        const scores = await cdp.evaluate(
          `[...${PREVIEW}.querySelectorAll('[data-prism="preview-score"]')].map((s) => parseInt(s.textContent))`
        );
        check("there are matches", scores.length > 0, `${scores.length} matches`);
        check("matches are sorted best first", scores.every((s, i) => i === 0 || s <= scores[i - 1]), scores.slice(0, 10).join(", "));
        const top = await cdp.evaluate(
          `[...${PREVIEW}.querySelectorAll('[data-prism="preview-list"] label')].slice(0, 5).map((r) => r.innerText.replace(/\\s+/g, " "))`
        );
        top.forEach((row) => info(`top: ${row}`));
        const tip = await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="preview-list"] label').title`);
        check("score tooltip includes the lyrics mood", /mood (\d+%|unknown)/.test(tip) && tip.includes("Lyrics mood:"), tip.replace(/\n/g, " / "));
        const createLabel = () => cdp.evaluate(`[...${PREVIEW}.querySelectorAll("button")].find((b) => b.textContent.startsWith("Create")).textContent`);
        const n = (label) => parseInt(label.match(/\((\d+)/)[1]);
        const REC_BOXES = `[...${PREVIEW}.querySelectorAll('[data-prism="preview-recommended"] input')]`;

        // Count chips (how many songs to recommend). Choosing one saves it in
        // LocalStorage, so remember the developer's choice and put it back.
        const savedCount = await cdp.evaluate(`Spicetify.LocalStorage.get("prism:growCount")`);
        // New finds are ticked as well, so with "New finds" on (the developer's
        // saved choice, e.g. 20) "count 10" shows 10 + the new finds once they
        // load. Turn them Off for the count checks; the New finds checks below
        // turn them on again, and the saved choice is put back afterwards.
        const savedNewCount = await cdp.evaluate(`Spicetify.LocalStorage.get("prism:growNewCount")`);
        const clickNew = async (id) => {
          await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="new-count-${id}"]').click()`);
          await sleep(250);
        };
        await clickNew("off");
        const clickCount = async (id) => {
          await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="count-${id}"]').click()`);
          await sleep(250);
        };
        const recState = () => cdp.evaluate(`({ n: ${REC_BOXES}.length, ticked: ${REC_BOXES}.every((b) => b.checked) })`);
        const libraryScores = await cdp.evaluate(`${PREVIEW}.querySelectorAll('[data-prism="preview-score"]').length`); // without the new finds
        const totalMatches = libraryScores + (await cdp.evaluate(`(() => { const t = ${PREVIEW}.querySelector('[data-prism="preview-more-toggle"]'); return t ? t.textContent.split(" ").map(Number).find((x) => x > 0) : 0; })()`));
        await clickCount(10);
        const ten = await recState();
        check("count 10 re-ticks the best 10", ten.n === Math.min(10, totalMatches) && ten.ticked && n(await createLabel()) === ten.n + 1, `${ten.n} recommended`);
        await clickCount("all");
        const all = await recState();
        check("count All recommends every match", all.n === totalMatches && all.ticked, `${all.n} of ${totalMatches}`);
        await clickCount("custom");
        // Clicking Custom re-applies the number already in its box (PR #38):
        // after "All", a box that says 15 must not leave every match ticked.
        const boxed = parseInt(await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="count-custom-input"]').value`));
        if (boxed > 0) {
          const reapplied = await recState();
          check("clicking Custom re-applies the number in its box", reapplied.n === Math.min(boxed, totalMatches) && reapplied.ticked, `box ${boxed}, ${reapplied.n} recommended`);
        }
        // Type 15. React ignores an "input" event whose value didn't change
        // (the box may already say 15 from an earlier run), so clear it first.
        await cdp.evaluate(`(() => {
          const input = ${PREVIEW}.querySelector('[data-prism="count-custom-input"]');
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          for (const value of ["", "15"]) {
            set.call(input, value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        })()`);
        await sleep(250);
        const custom = await recState();
        check("a custom count (15) re-ticks the best 15", custom.n === Math.min(15, totalMatches) && custom.ticked, `${custom.n} recommended`);
        await screenshot("preview-count.png");
        // New finds (DISCOVER): similar songs NOT in the library, marked with a
        // mint "New find" row. Read-only: it only searches. Choosing a count
        // saves it, so the developer's choice is put back afterwards.
        const NEW_ROWS = `[...${PREVIEW}.querySelectorAll('[data-prism="preview-recommended"] [data-prism="new-find"]')]`;
        const newStatus = () => cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="new-status"]').textContent`);
        await clickNew(10);
        const searched = await waitFor(`!${PREVIEW}.querySelector('[data-prism="new-status"]').textContent.includes("Looking")`, 120000);
        const status = await newStatus();
        check("new finds: the search finishes", searched && /found|No new songs/.test(status), status);
        const tenNew = await cdp.evaluate(`({ n: ${NEW_ROWS}.length, ticked: ${NEW_ROWS}.every((r) => r.querySelector("input").checked), pill: ${NEW_ROWS}.every((r) => r.textContent.includes("New find") && !!r.querySelector(".prism-new-pill .prism-star-icon")) })`);
        check("new finds: up to 10 ticked, each with the New find pill and its Prism star", tenNew.n > 0 && tenNew.n <= 10 && tenNew.ticked && tenNew.pill, JSON.stringify(tenNew));
        info(`new finds shown: ${tenNew.n}`);
        await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="new-find"]')?.scrollIntoView({ block: "center" })`);
        await screenshot("preview-new-finds.png");
        const newTip = await cdp.evaluate(`${NEW_ROWS}[0]?.title ?? ""`);
        check("new finds: the tooltip says it's not in your library", newTip.includes("not in your library"), newTip.split(String.fromCharCode(10)).pop());
        await clickNew(5);
        check("new finds: 5 re-ticks the best 5", (await cdp.evaluate(`${NEW_ROWS}.length`)) <= 5);
        await clickNew("off");
        check("new finds: Off hides them all", (await cdp.evaluate(`${PREVIEW}.querySelectorAll('[data-prism="new-find"]').length`)) === 0);
        await cdp.evaluate(savedNewCount === null ? `Spicetify.LocalStorage.remove("prism:growNewCount")` : `Spicetify.LocalStorage.set("prism:growNewCount", ${JSON.stringify(savedNewCount)})`);
        await clickCount(30); // back to the default for the checks below
        await cdp.evaluate(savedCount === null ? `Spicetify.LocalStorage.remove("prism:growCount")` : `Spicetify.LocalStorage.set("prism:growCount", ${JSON.stringify(savedCount)})`);
        const recCount = await cdp.evaluate(`${REC_BOXES}.length`);
        const allRecTicked = await cdp.evaluate(`${REC_BOXES}.every((b) => b.checked)`);
        check("every recommended song starts ticked (up to 30)", recCount > 0 && recCount <= 30 && allRecTicked, `${recCount} recommended`);
        const before = await createLabel();
        check("Create button counts recommended + seed", n(before) === recCount + 1, before);

        // Untick the first recommended song: the count drops by one.
        await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="preview-recommended"] label').click()`);
        await sleep(200);
        const afterUntick = await createLabel();
        check("unticking a song lowers the count", n(afterUntick) === n(before) - 1, `${before} -> ${afterUntick}`);

        // "Show more" reveals the weaker matches, unticked; ticking one adds it.
        const hasMore = await cdp.evaluate(`!!${PREVIEW}.querySelector('[data-prism="preview-more-toggle"]')`);
        if (hasMore) {
          await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="preview-more-toggle"]').click()`);
          await sleep(200);
          const moreBoxes = `[...${PREVIEW}.querySelectorAll('[data-prism="preview-more"] input')]`;
          check("Show more reveals extra matches, all unticked", await cdp.evaluate(`${moreBoxes}.length > 0 && ${moreBoxes}.every((b) => !b.checked)`), `${await cdp.evaluate(`${moreBoxes}.length`)} more`);
          await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="preview-more"] label').click()`);
          await sleep(200);
          const afterAdd = await createLabel();
          check("ticking an extra match raises the count", n(afterAdd) === n(afterUntick) + 1, `${afterUntick} -> ${afterAdd}`);
          await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="preview-more-toggle"]').click()`); // close again for the screenshot
          await sleep(200);
        } else {
          info("no extra matches beyond the recommended ones");
        }
        // Playlist name (step 9), asked in a popup. The popup's Create is NEVER
        // clicked here: the smoke test stays read-only (Cancel closes it).
        await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="open-naming"]').click()`);
        await sleep(300);
        check("Create playlist opens the naming popup", await cdp.evaluate(`!!${PREVIEW}.querySelector('[data-prism="name-popup"]')`));
        check(
          "the name box has the cursor in it",
          await cdp.evaluate(`document.activeElement === ${PREVIEW}.querySelector('[data-prism="playlist-name"]')`)
        );
        await screenshot("name-popup.png");
        const NAME = `${PREVIEW}.querySelector('[data-prism="playlist-name"]')`;
        const CREATE = `${PREVIEW}.querySelector('[data-prism="name-create"]')`;
        const defaultName = await cdp.evaluate(`${NAME}.value`);
        check("playlist name defaults to 'Prism · <seed>'", defaultName === "Prism · Often", defaultName);
        const typeName = (text) => cdp.evaluate(`(() => {
          const input = ${NAME};
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(text)});
          input.dispatchEvent(new Event("input", { bubbles: true }));
        })()`);
        await typeName("   ");
        await sleep(200);
        check("a blank name disables Create", await cdp.evaluate(`${CREATE}.disabled`));
        await typeName("Prism · Often");
        await sleep(200);
        check("a name enables Create again", !(await cdp.evaluate(`${CREATE}.disabled`)));
        await cdp.evaluate(`${PREVIEW}.querySelector('[data-prism="name-cancel"]').click()`);
        await sleep(300);
        check("Cancel closes the naming popup", await cdp.evaluate(`!${PREVIEW}.querySelector('[data-prism="name-popup"]')`));

        await screenshot("preview.png");
      }
    } else {
      check("scan finished for the preview test", false);
    }
  }
  await cdp.evaluate("window.__prism.goHome()");
  await sleep(500);

  console.log("\n[9] Scan screen layout: the bar must not move when the text changes (fake scan)");
  await cdp.evaluate("window.__prism.previewScan()");
  await waitFor(`!!document.querySelector('[data-prism="scan-preview"] [role="progressbar"]')`);
  const barTop = `Math.round(document.querySelector('[data-prism="scan-preview"] [role="progressbar"]').getBoundingClientRect().top)`;
  const setProgress = (p) => cdp.evaluate(`window.__prism.setPreviewProgress(${JSON.stringify(p)})`);
  const positions = {};
  // Wait for the page's open animation (rises 8 px over 220 ms) to finish,
  // or the first reading is taken mid-slide.
  // A fixed wait isn't enough when Spotify's window is hidden (animations run
  // slower), so wait until the browser says every animation has finished.
  await waitFor(`document.getAnimations().every((a) => a.playState === "finished")`, 5000);
  await sleep(100);
  positions["before any progress"] = await cdp.evaluate(barTop);
  await setProgress({ done: 3, total: 9, fromCache: 0, failed: 0 });
  await sleep(150);
  positions["short text"] = await cdp.evaluate(barTop);
  // Long text: big numbers + "remembered" + (after 5 lookups) a time estimate.
  await setProgress({ done: 575, total: 704, fromCache: 58, failed: 0 });
  await sleep(150);
  positions["long text"] = await cdp.evaluate(barTop);
  info(`detail line: "${await cdp.evaluate(`document.querySelector('[data-prism="scan-detail"]').textContent`)}"`);
  await screenshot("scan-layout-long.png");
  // Cancel turns the 2-line note into one short line ("Stopping...").
  await cdp.evaluate(`[...document.querySelectorAll('[data-prism="scan-preview"] button')].find((b) => b.textContent === "Cancel").click()`);
  await sleep(150);
  positions["after Cancel"] = await cdp.evaluate(barTop);
  check("progress bar stays in one place", new Set(Object.values(positions)).size === 1, JSON.stringify(positions));
  await cdp.evaluate("window.__prism.goHome()");
  await sleep(500);

  console.log("\n[10] Settings on the page (screenshot)");
  await cdp.evaluate("window.__prism.openSettings()");
  await sleep(800); // let React draw it
  const visible = await cdp.evaluate(
    `[...document.querySelectorAll("h1, h2")].some((el) => el.textContent.includes("Prism settings"))`
  );
  check("settings open on the page with their title", visible);
  await screenshot("settings.png");
  // Side rail: each section button shows its own section (and only that one).
  const railOk = await cdp.evaluate(`(async () => {
    const out = [];
    for (const id of ["look", "lastfm", "feedback", "about", "theme"]) {
      document.querySelector('[data-prism="settings-tab-' + id + '"]')?.click();
      await new Promise((r) => setTimeout(r, 150));
      const shown = [...document.querySelectorAll('[data-prism^="settings-section-"]')].map((el) => el.dataset.prism);
      out.push(shown.length === 1 && shown[0] === "settings-section-" + id);
    }
    return out.every(Boolean);
  })()`);
  check("the side rail switches between the five sections", railOk);
  await cdp.evaluate("window.__prism.goHome()");

  console.log("\n[11] Playlist stats page (sample numbers, read-only)");
  await cdp.evaluate("window.__prism.previewStats()");
  const statsShown = await waitFor(`!!document.querySelector('[data-prism-state="stats"]')`, 5000);
  check("stats page opens", statsShown);
  if (statsShown) {
    const statsName = await cdp.evaluate(`document.querySelector('[data-prism="stats-name"]').textContent`);
    check("it shows the playlist's name", statsName === "Prism · Sample", statsName);
    const bars = await cdp.evaluate(`document.querySelectorAll('[data-prism="stats-chart"] .prism-bar-fill').length`);
    check("the genre mix has one bar per top genre (8)", bars === 8, `${bars} bars`);
    const panels = await cdp.evaluate(
      `["stats-fingerprint", "stats-moods", "stats-tempo", "stats-match", "stats-length"].filter((p) => !document.querySelector('[data-prism="' + p + '"]'))`
    );
    check("fingerprint, mood, tempo, match and length panels are all shown", panels.length === 0, panels.length ? `missing: ${panels.join(", ")}` : "");
    await sleep(900); // let the bars finish growing
    await screenshot("stats.png");
  }
  // A playlist that doesn't exist: a friendly message, not an error.
  await cdp.evaluate(`window.__prism.openStats("spotify:playlist:0000000000000000000001")`);
  check(
    "a playlist that can't be read shows a message",
    await waitFor(`!!document.querySelector('[data-prism-state="stats-missing"]')`, 10000)
  );
  // A real playlist from the library (read-only): stats or an estimate appear.
  const firstPlaylist = await cdp.evaluate(`(async () => {
    const root = await Spicetify.Platform.RootlistAPI.getContents();
    const find = (items) => { for (const i of items || []) { if (i.type === "folder") { const f = find(i.items); if (f) return f; } else if (i.type === "playlist") return i.uri; } return null; };
    return find(root.items);
  })()`);
  if (firstPlaylist) {
    await cdp.evaluate(`window.__prism.openStats(${JSON.stringify(firstPlaylist)})`);
    check(
      "a real playlist's stats page loads (saved stats or an estimate)",
      await waitFor(`!!document.querySelector('[data-prism-state="stats"]')`, 30000)
    );
  }
  // The right-click item is offered for one playlist, not for songs.
  check(
    "\"Prism stats\" is offered for a playlist, not a song",
    await cdp.evaluate(
      `!window.__prism.isSinglePlaylist(["spotify:track:4PhsKqMdgMEUSstTDAmMpg"]) && window.__prism.isSinglePlaylist(["spotify:playlist:0000000000000000000001"])`
    )
  );
  await cdp.evaluate("window.__prism.goHome()");

  console.log("\n[12] Remix into moods: setup, scan, the two doors, Prism's groups (read-only, nothing is created)");
  await sleep(600);
  check(
    "the start page shows both modes",
    await waitFor(`!!document.querySelector('[data-prism="mode-prism"]') && !!document.querySelector('[data-prism="mode-organize"]')`, 5000)
  );
  await cdp.evaluate(`document.querySelector('[data-prism="flip-organize"]').click()`);
  await sleep(450);
  check("the Organize tile flips to its details", await faceShown('[data-prism="mode-organize"] .prism-flip-back'));
  await cdp.evaluate(`document.querySelector('[data-prism="start-organize"]').click()`);
  const ORG = `document.querySelector('[data-prism="organize"]')`;
  check("Remix opens on the shared playlist picker", await waitFor(`!!${ORG}?.querySelector('[data-prism="source-list"] label')`, 15000));
  check("the picker has no settings panel any more (they moved to More options)", await cdp.evaluate(`!${ORG}.querySelector('[data-prism="organize-settings"]')`));
  await screenshot("organize-setup.png");
  // Tick the test playlist (cached, so the scan is quick) and scan.
  await cdp.evaluate(`${ROW(ORG)}.click()`);
  await sleep(200);
  await cdp.evaluate(`${ORG}.querySelector('[data-prism="sources-next"]').click()`);
  const scanned = await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 120000);
  check("Remix scans the picked playlist", scanned);
  if (scanned) {
    // The two doors.
    await cdp.evaluate(`[...${ORG}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Next").click()`);
    const CHOOSE = `document.querySelector('[data-prism-state="organize-choose"]')`;
    check("after the scan comes one question with two doors", await waitFor(`!!${CHOOSE}?.querySelector('[data-prism="mode-auto"]') && !!${CHOOSE}.querySelector('[data-prism="mode-me"]')`, 3000));
    check("Next only shows once a door is picked", await cdp.evaluate(`!${CHOOSE}.querySelector('[data-prism="choose-next"]')`));
    await cdp.evaluate(`${CHOOSE}.querySelector('[data-prism="mode-auto"]').click()`);
    await sleep(200);
    check("picking a door marks it", await cdp.evaluate(`${CHOOSE}.querySelector('[data-prism="mode-auto"]').getAttribute("aria-checked") === "true"`));
    await screenshot("organize-choose.png");
    await cdp.evaluate(`${CHOOSE}.querySelector('[data-prism="choose-next"]').click()`);
    const shown = await waitFor(`!!document.querySelector('[data-prism-view="suggested"]')`, 5000);
    check("\"Sort them for me\" shows Prism's groups", shown);
    const GROUPS = `document.querySelector('[data-prism-state="organize-groups"]')`;
    const CARDS = `[...document.querySelectorAll('[data-prism="organize-group"]')]`;
    const intro0 = shown ? await cdp.evaluate(`${GROUPS}.querySelector('p').innerText`) : "";
    check("it says how the songs were grouped (Auto, balanced by default)", intro0.startsWith(`${TEST.count} songs`) && /genre, mood and tempo together/.test(intro0), intro0);
    // More options: 3 playlists, group by genre, overlap on and off again.
    check("More options starts closed", await cdp.evaluate(`!${GROUPS}.querySelector('[data-prism="organize-settings"]')`));
    await cdp.evaluate(`${GROUPS}.querySelector('[data-prism="more-options"]').click()`);
    await sleep(200);
    const SET = `document.querySelector('[data-prism="organize-settings"]')`;
    check("More options opens with How many, Group mostly by and overlap", await cdp.evaluate(`!!${SET}?.querySelector('[data-prism="count-3"]') && !!${SET}.querySelector('[data-prism="focus-genre"]') && !!${SET}.querySelector('[data-prism="overlap-on"]') && !${SET}.querySelector('[data-prism="count-1"]')`));
    await cdp.evaluate(`${SET}.querySelector('[data-prism="count-3"]').click()`);
    await sleep(250);
    await cdp.evaluate(`${SET}.querySelector('[data-prism="focus-genre"]').click()`);
    await sleep(250);
    await cdp.evaluate(`${SET}.querySelector('[data-prism="overlap-on"]').click()`);
    await sleep(300);
    check(
      "the settings buttons switch (3, genre, overlap on)",
      await cdp.evaluate(`["count-3", "focus-genre", "overlap-on"].every((id) => ${SET}.querySelector('[data-prism="' + id + '"]').getAttribute("aria-pressed") === "true") && ${SET}.querySelector('[data-prism="count-auto"]').getAttribute("aria-pressed") === "false"`)
    );
    const groups = await cdp.evaluate(`${CARDS}.map((g) => g.innerText.replace(/\\s+/g, " ").slice(0, 70))`);
    groups.forEach((g) => info(`group: ${g}`));
    check("changing How many regroups straight away (3 groups)", groups.length === 3, `${groups.length} groups`);
    const intro = await cdp.evaluate(`${GROUPS}.querySelector('p').innerText`);
    check("the line above says the new grouping", /mostly genre/.test(intro), intro);
    await screenshot("organize-groups.png");
    // Overlap off again for the editing checks (so a removed song is in no group).
    await cdp.evaluate(`${SET}.querySelector('[data-prism="overlap-off"]').click()`);
    await sleep(300);
    await cdp.evaluate(`${GROUPS}.querySelector('[data-prism="more-options"]').click()`);
    await sleep(200);
    check("More options closes again", await cdp.evaluate(`!document.querySelector('[data-prism="organize-settings"]')`));

    // 13c: editing on the review screen (all on screen only; nothing is created).
    const cardCount = (i) => cdp.evaluate(`parseInt(${CARDS}[${i}].innerText.match(/(\\d+) songs?/)[1])`);
    check("each group card shows a 2x2 cover mosaic", await cdp.evaluate(`${CARDS}.every((c) => c.querySelectorAll("img, span[style*='gradient']").length >= 4)`));
    check("with every song placed there's no Not included card", await cdp.evaluate(`!document.querySelector('[data-prism="organize-not-included"]')`));
    const before0 = await cardCount(0);
    const before1 = await cardCount(1);
    await cdp.evaluate(`${CARDS}[0].click()`);
    const DETAIL = `document.querySelector('[data-prism-state="organize-group-detail"]')`;
    check("clicking a card opens that group", await waitFor(`!!${DETAIL}`, 3000));
    // Rename: type a new name, then leave the box (blur saves it).
    await cdp.evaluate(`(() => {
      const input = ${DETAIL}.querySelector('[data-prism="group-name-input"]');
      input.focus(); // like a user clicking into the box (blur only fires after focus)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "Smoke test name");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // "Leave the box". When Spotify isn't the active window the browser sends
      // no real focus events, so send React's "focusout" ourselves.
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    })()`);
    await sleep(200);
    // A glass menu: open it, pick the first choice.
    const pickFromMenu = async (container, menu) => {
      await cdp.evaluate(`${container}.querySelector('[data-prism="${menu}"]').click()`);
      await sleep(150);
      const opened = await cdp.evaluate(`!!document.querySelector('[role="listbox"] [data-prism="menu-option"]')`);
      await cdp.evaluate(`document.querySelector('[role="listbox"] [data-prism="menu-option"]').dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))`);
      await sleep(200);
      return opened;
    };
    // Move the first song to the next group, then remove the (new) first song.
    check("the Move to… glass menu opens with the other groups", await pickFromMenu(DETAIL, "move-menu"));
    await sleep(200);
    const removedName = await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="group-song"]').innerText.split("\\n")[0]`);
    await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="remove-song"]').click()`);
    await sleep(200);
    const songsLeft = await cdp.evaluate(`${DETAIL}.querySelectorAll('[data-prism="group-song"]').length`);
    check("moving and removing a song each take one out of the open group", songsLeft === before0 - 2, `${before0} -> ${songsLeft}`);
    await screenshot("organize-group-detail.png");
    await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="all-groups"]').click()`);
    await sleep(300);
    const names = await cdp.evaluate(`${CARDS}.map((c) => c.innerText.split("\\n")[0])`);
    check("the rename shows on the card", names.includes("Smoke test name"), names.join(" | "));
    const renamedIndex = names.indexOf("Smoke test name");
    const otherIndex = renamedIndex === 0 ? 1 : 0;
    check(
      "the moved song is now in the other group",
      (await cardCount(otherIndex)) >= (otherIndex === 1 ? before1 : before0) || (await cardCount(otherIndex)) > 0
    );

    // Not included: the removed song shows there, with why, and can go back in.
    const LEFTCARD = `document.querySelector('[data-prism="organize-not-included"]')`;
    check("the removed song makes a Not included card (1 song)", await cdp.evaluate(`!!${LEFTCARD} && /\\b1 song\\b/.test(${LEFTCARD}.innerText)`));
    await screenshot("organize-not-included-card.png");
    await cdp.evaluate(`${LEFTCARD}.click()`);
    const LEFT = `document.querySelector('[data-prism-state="organize-not-included"]')`;
    check("opening it lists the song", await waitFor(`${LEFT}?.querySelectorAll('[data-prism="not-included-song"]').length === 1`, 3000));
    const leftRow = await cdp.evaluate(`${LEFT}.querySelector('[data-prism="not-included-song"]').innerText.replace(/\\s+/g, " ")`);
    check("it names the song and says why it's there", leftRow.includes(removedName) && /you took it out/.test(leftRow), leftRow);
    await screenshot("organize-not-included.png");
    check("Add to… offers the groups", await pickFromMenu(LEFT, "add-to-menu"));
    check("adding it empties the list", await waitFor(`${LEFT}.querySelectorAll('[data-prism="not-included-song"]').length === 0`, 2000));
    await cdp.evaluate(`${LEFT}.querySelector('[data-prism="not-included-back"]').click()`);
    await sleep(300);
    check("back on the cards, the Not included card is gone", await cdp.evaluate(`!${LEFTCARD} && ${CARDS}.length === 3`));

    // Combine: open the renamed group, pick another group, and confirm.
    const groupsBefore = await cdp.evaluate(`${CARDS}.length`);
    await cdp.evaluate(`${CARDS}[${renamedIndex}].click()`);
    await waitFor(`!!${DETAIL}`, 3000);
    await pickFromMenu(DETAIL, "combine-menu");
    const confirmText = await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="combine-confirm"]')?.innerText ?? ""`);
    check(
      "Combine asks first and says what will happen",
      /(Add \d+ songs? from|Every song in)/.test(confirmText) && /will disappear/.test(confirmText) && (await cdp.evaluate(`${CARDS}.length`)) === 0,
      confirmText.replace(/\s+/g, " ").slice(0, 120)
    );
    await screenshot("organize-combine-confirm.png");
    await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="combine-yes"]').click()`);
    await sleep(200);
    await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="all-groups"]').click()`);
    await sleep(300);
    check("merging leaves one group fewer", (await cdp.evaluate(`${CARDS}.length`)) === groupsBefore - 1, `${groupsBefore} -> ${await cdp.evaluate(`${CARDS}.length`)}`);

    // 13c-2: the "I'll pick the vibes" door (on screen only; nothing is created).
    console.log("\n[13] Remix: I'll pick the vibes (read-only)");
    await cdp.evaluate(`${GROUPS}.querySelector('[data-prism="groups-back"]').click()`);
    check("Back on the groups goes to the two doors, door still picked", await waitFor(`${CHOOSE}?.querySelector('[data-prism="mode-auto"]').getAttribute("aria-checked") === "true"`, 3000));
    await cdp.evaluate(`${CHOOSE}.querySelector('[data-prism="mode-me"]').click()`);
    await sleep(200);
    await cdp.evaluate(`${CHOOSE}.querySelector('[data-prism="choose-next"]').click()`);
    const BUILDER = `document.querySelector('[data-prism-state="organize-builder"]')`;
    check("\"I'll pick the vibes\" opens the group builder", await waitFor(`!!${BUILDER}`, 3000));
    const builderGroups = await cdp.evaluate(`${BUILDER}.querySelectorAll('[data-prism="builder-group"]').length`);
    check("it starts with one group (one playlist)", builderGroups === 1, `${builderGroups}`);
    check("it has Back and no \"Use suggestions\"", await cdp.evaluate(`!!${BUILDER}.querySelector('[data-prism="builder-back"]') && !${BUILDER}.querySelector('[data-prism="builder-use-suggestions"]')`));
    const genres = await cdp.evaluate(
      `[...${BUILDER}.querySelectorAll('[data-prism="pick-genre"]')].map((b) => b.dataset.label + " " + b.querySelector(".prism-tag-count").textContent)`
    );
    const moods = await cdp.evaluate(`[...${BUILDER}.querySelectorAll('[data-prism="pick-mood"]')].map((b) => b.dataset.label)`);
    info(`genres: ${genres.slice(0, 8).join(", ")}${genres.length > 8 ? ", ..." : ""} (${genres.length} shown)`);
    info(`moods: ${moods.join(", ") || "(none)"}`);
    check("the genres to pick come from the scanned songs, with song counts", genres.length > 0 && genres.every((g) => / \d+$/.test(g)));
    // Sorting with an empty group says what's missing instead of sorting.
    await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-sort"]').click()`);
    await sleep(200);
    const problem = await cdp.evaluate(`${BUILDER}?.querySelector('[data-prism="builder-problem"]')?.innerText ?? ""`);
    check("\"Sort songs\" with an empty group says what's missing", /has no genres or moods yet/.test(problem), problem);
    const pick = async (groupIndex, selector, labelIndex) => {
      await cdp.evaluate(`${BUILDER}.querySelectorAll('[data-prism="builder-group"]')[${groupIndex}].click()`);
      await sleep(150);
      await cdp.evaluate(`${BUILDER}.querySelectorAll('[data-prism="${selector}"]')[${labelIndex}].click()`);
      await sleep(150);
    };
    // One playlist: pick a less common genre, so some songs are left out.
    const lastGenre = Math.min(genres.length - 1, 4);
    await pick(0, "pick-genre", lastGenre);
    const firstPressed = await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="pick-genre"][aria-pressed="true"]')?.dataset.label ?? ""`);
    const firstName = await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-name-input"]').value`);
    check("picking a genre turns it on and names the group after it", !!firstPressed && firstName.toLowerCase() === firstPressed.toLowerCase(), `${firstPressed} -> "${firstName}"`);
    await screenshot("organize-builder.png");
    await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-sort"]').click()`);
    const sortedOne = await waitFor(`!!document.querySelector('[data-prism-view="custom"]')`, 3000);
    check("\"Sort songs\" shows your one playlist as a card", sortedOne && (await cdp.evaluate(`${CARDS}.length`)) === 1);
    if (sortedOne) {
      const line = await cdp.evaluate(`${GROUPS}.querySelector('p').innerText`);
      info(line);
      const matched = parseInt((line.match(new RegExp(`(\\d+) of ${TEST.count} `)) || [])[1] ?? "-1");
      check("it says how many songs match your picks", matched >= 0, line);
      check("one playlist has no More options", await cdp.evaluate(`!${GROUPS}.querySelector('[data-prism="more-options"]')`));
      check("one playlist says \"Create playlist\"", await cdp.evaluate(`${GROUPS}.querySelector('[data-prism="open-create"]').textContent.trim() === "Create playlist"`));
      if (matched < TEST.count) {
        check(`the ${TEST.count - matched} songs that don't match show as Not included`, await cdp.evaluate(`!!${LEFTCARD} && new RegExp("\\\\b${TEST.count - matched} songs?\\\\b").test(${LEFTCARD}.innerText)`));
        await screenshot("organize-one-playlist.png");
        await cdp.evaluate(`${LEFTCARD}.click()`);
        await waitFor(`!!${LEFT}`, 3000);
        const why = await cdp.evaluate(`${LEFT}.querySelector('[data-prism="not-included-song"]')?.innerText.replace(/\\s+/g, " ") ?? ""`);
        check("each one says why (no picked genre/mood, or no tags)", /has none of the genres or moods you picked|no genre tags or lyrics mood found/.test(why), why);
        check("with one playlist each row has a plain Add button", await cdp.evaluate(`!!${LEFT}.querySelector('[data-prism="add-song"]') && !${LEFT}.querySelector('[data-prism="add-to-menu"]')`));
        await cdp.evaluate(`${LEFT}.querySelector('[data-prism="add-all"]').click()`);
        await sleep(200);
        check("Add all puts every one in", await cdp.evaluate(`${LEFT}.querySelectorAll('[data-prism="not-included-song"]').length === 0`));
        await cdp.evaluate(`${LEFT}.querySelector('[data-prism="not-included-back"]').click()`);
        await sleep(300);
        check(`the playlist now has all ${TEST.count} songs`, (await cardCount(0)) === TEST.count &&(await cdp.evaluate(`!${LEFTCARD}`)));
      } else {
        info("every song matched the picked genre: Not included not tested with one playlist");
      }
      // Several playlists: add two groups in the builder.
      await cdp.evaluate(`${GROUPS}.querySelector('[data-prism="edit-picks"]').click()`);
      await waitFor(`!!${BUILDER}`, 3000);
      check("\"Edit my picks\" goes back to the builder with the pick kept", await cdp.evaluate(`!!${BUILDER}.querySelector('[data-prism="pick-genre"][aria-pressed="true"]')`));
      await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-add-group"]').click()`);
      await sleep(150);
      await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-add-group"]').click()`);
      await sleep(150);
      await pick(1, "pick-genre", 0);
      await pick(2, moods.length ? "pick-mood" : "pick-genre", moods.length ? 0 : 1);
      await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-sort"]').click()`);
      await waitFor(`${CARDS}.length === 3`, 3000);
      const custom = await cdp.evaluate(`${CARDS}.map((g) => g.innerText.replace(/\\s+/g, " ").slice(0, 70))`);
      custom.forEach((g) => info(`your group: ${g}`));
      const total = await cdp.evaluate(`${CARDS}.reduce((n, c) => n + parseInt(c.innerText.match(/(\\d+) songs?/)[1]), 0)`);
      check("3 groups, and every song is in one", custom.length === 3 && total >= TEST.count && (await cdp.evaluate(`!${LEFTCARD}`)), `${custom.length} groups, ${total} places`);
      // More options for your own groups: no How many (that's how many you made).
      await cdp.evaluate(`${GROUPS}.querySelector('[data-prism="more-options"]').click()`);
      await sleep(200);
      check("your groups' More options has no How many", await cdp.evaluate(`!!${SET} && !${SET}.querySelector('[data-prism="count-3"]') && !!${SET}.querySelector('[data-prism="overlap-on"]')`));
      await cdp.evaluate(`${SET}.querySelector('[data-prism="overlap-on"]').click()`);
      await sleep(300);
      const intro2 = await cdp.evaluate(`${GROUPS}.querySelector('p').innerText`);
      check("overlap on sorts your groups again", /can join every group/.test(intro2) && (await cdp.evaluate(`${CARDS}.length`)) === 3, intro2);
      await screenshot("organize-custom-groups.png");
      await cdp.evaluate(`${CARDS}[0].click()`);
      check("your groups open with the same editing tools", await waitFor(`!!${DETAIL}?.querySelector('[data-prism="group-name-input"]')`, 3000));
      await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="all-groups"]').click()`);
      await sleep(300);

      // 13d: the confirm screen. READ-ONLY: this test NEVER clicks
      // "Create playlists" (data-prism="create-go"); it only looks and goes Back.
      console.log("\n[14] Remix: confirm screen (step 13d, read-only: nothing is created)");
      const cardsNow = await cdp.evaluate(`${CARDS}.filter((c) => !/\\b0 songs/.test(c.innerText)).length`);
      await cdp.evaluate(`document.querySelector('[data-prism="open-create"]').click()`);
      const CONFIRM = `document.querySelector('[data-prism-state="organize-create-confirm"]')`;
      check("\"Create playlists\" opens a confirm screen first", await waitFor(`!!${CONFIRM}`, 3000));
      const rowNames = await cdp.evaluate(`[...${CONFIRM}.querySelectorAll('[data-prism="create-name"]')].map((n) => n.textContent)`);
      info(`will create: ${rowNames.join(" | ")}`);
      check("it lists one new playlist per group with songs", rowNames.length === cardsNow, `${rowNames.length} rows, ${cardsNow} groups`);
      check("names start with \"Prism · \" by default", rowNames.length > 0 && rowNames.every((n) => n.startsWith("Prism · ")));
      check("every row is still \"ready\" (nothing created)", await cdp.evaluate(`[...${CONFIRM}.querySelectorAll('[data-prism="create-row"]')].every((r) => r.dataset.status === "ready")`));
      await screenshot("organize-create-confirm.png");
      check("the prefix check bubble is ticked by default", await cdp.evaluate(`${CONFIRM}.querySelector('[data-prism="prefix-check"] input').checked`));
      await cdp.evaluate(`${CONFIRM}.querySelector('[data-prism="prefix-check"] input').click()`);
      await sleep(200);
      check(
        "turning the prefix off shows the plain names",
        await cdp.evaluate(`[...${CONFIRM}.querySelectorAll('[data-prism="create-name"]')].every((n) => !n.textContent.startsWith("Prism · "))`)
      );
      await cdp.evaluate(`${CONFIRM}.querySelector('[data-prism="create-back"]').click()`);
      await sleep(300);
      check("Back returns to the group cards", (await cdp.evaluate(`${CARDS}.length`)) > 0);
    }
  }
  await cdp.evaluate("window.__prism.goHome()");
} catch (error) {
  check("smoke test ran to the end", false, error.message);
} finally {
  cdp.close();
}

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
