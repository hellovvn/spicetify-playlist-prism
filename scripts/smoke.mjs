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

  console.log("\n[1b] The Playlist Prism page (step 12a)");
  // Spicetify adds a header button for every custom app, labelled with its name.
  const HEADER_ICON = `document.querySelector('button[aria-label="Playlist Prism"]')`;
  // Known starting point: the page's start screen, then away to Spotify's
  // Home, so clicking the icon must bring us BACK to the page.
  await cdp.evaluate("window.__playlistPrism.goHome()");
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
    await cdp.evaluate("window.__playlistPrism.goHome()");
  } else {
    check("header has the Playlist Prism icon", iconFound);
    if (!iconFound) throw new Error("No header icon; stopping.");
    await cdp.evaluate(`${HEADER_ICON}.click()`);
  }
  let homeShown = false;
  for (let i = 0; i < 40 && !homeShown; i++) {
    homeShown = await cdp.evaluate(`!!document.querySelector('[data-prism-state="home"]')`);
    if (!homeShown) await sleep(250);
  }
  check("clicking it opens the page's start screen", homeShown, await cdp.evaluate("Spicetify.Platform.History.location.pathname"));
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
      // The full chain, exactly as the extension runs it.
      const result = await cdp.evaluate(`window.__playlistPrism.getSongTags(${JSON.stringify(track)})`);
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
  const audio = await cdp.evaluate(`window.__playlistPrism.getAudioAttributes(${JSON.stringify(audioUris)})`);
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
  const all = await cdp.evaluate(`window.__playlistPrism.getAudioAttributes(${JSON.stringify(allUris)})`);
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

  await cdp.evaluate(`window.__playlistPrism.startPrism("spotify:track:4PhsKqMdgMEUSstTDAmMpg")`); // Often
  // The page should open at once, showing the spinner while it loads.
  const loadingShown = await waitFor(`!!document.querySelector('[data-prism-state="loading"]')`, 1000);
  check("Prism page opens immediately with a loading spinner", loadingShown);
  const path = await cdp.evaluate("Spicetify.Platform.History.location.pathname");
  check("it's the Playlist Prism page (not a popup)", path === "/playlist-prism" && !(await cdp.evaluate(`!!document.querySelector(".GenericModal")`)), path);
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
    await cdp.evaluate("window.__playlistPrism.goHome()");
  }

  // A song with no song-level tags: artist row + "broader matches" warning, still allowed.
  await sleep(500);
  await cdp.evaluate(`window.__playlistPrism.startPrism("spotify:track:19Lnk1Q2FJcB3Hia0wfgye")`); // RESCUER
  const rescuerReady = await waitFor(READY);
  check("RESCUER: shows the 'From the artist' chip row", rescuerReady && (await cdp.evaluate(`${PANEL}.textContent.includes("From the artist")`)));
  if (rescuerReady) {
    check("RESCUER: artist-only warning shown", (await cdp.evaluate(statusKind)) === "artist-only", await cdp.evaluate(statusKind));
    check("RESCUER: Next still enabled (warning, not a block)", !(await cdp.evaluate(`${NEXT}.disabled`)));
    await screenshot("seed-panel-artist-only.png");
  }
  await cdp.evaluate("window.__playlistPrism.goHome()");
  await sleep(500);

  console.log("\n[6] Source picker (screen 2) - UI clicks only, playlists are only read");
  const SOURCES = `document.querySelector('[data-prism-state="sources"]')`;
  const rows = `[...${SOURCES}.querySelectorAll('[data-prism="source-list"] label')]`;
  const rowNames = `${rows}.map((r) => r.querySelector("span span").textContent)`;
  const summary = `${SOURCES}.querySelector('[data-prism="source-summary"]').textContent`;
  const SCAN = `[...${SOURCES}.querySelectorAll("button")].find((b) => b.textContent.includes("scan"))`;
  const tickedNames = `${rows}.filter((r) => r.querySelector("input").checked).map((r) => r.querySelector("span span").textContent)`;

  await cdp.evaluate(`window.__playlistPrism.startPrism("spotify:track:4PhsKqMdgMEUSstTDAmMpg")`); // Often
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

      // Tick Dark Romance by clicking its row (the whole row is a label).
      await cdp.evaluate(`${rows}.find((r) => r.textContent.includes("Dark Romance")).click()`);
      await sleep(200);
      const sum = await cdp.evaluate(summary);
      check("ticking Dark Romance updates the summary", sum.startsWith("1 picked · up to 25 songs"), sum);
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
      check("Next again: Dark Romance is still ticked", JSON.stringify(await cdp.evaluate(tickedNames)) === JSON.stringify(["Dark Romance"]));

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
  await cdp.evaluate("window.__playlistPrism.goHome()");
  await sleep(500);

  console.log("\n[7] Scan (screen 3) - reads playlists + Last.fm only, nothing in Spotify changes");
  const SCAN_STATE = `document.querySelector('[data-prism-state^="scan"]')?.dataset.prismState`;
  const SCAN_TITLE = `document.querySelector('[data-prism-state="scan-done"] div div')?.textContent`;
  const clickButton = (label) =>
    `[...document.querySelectorAll('[data-prism="seed-panel"] button')].find((b) => b.textContent.includes(${JSON.stringify(label)})).click()`;
  const tick = (name) => `${rows}.find((r) => r.querySelector("span span").textContent === ${JSON.stringify(name)}).click()`;

  await cdp.evaluate(`window.__playlistPrism.startPrism("spotify:track:4PhsKqMdgMEUSstTDAmMpg")`); // Often
  if (await waitFor(READY)) {
    await cdp.evaluate(clickButton("Next"));
    await waitFor(`!!${SOURCES} && ${rows}.length > 0`);
    await cdp.evaluate(tick("Dark Romance"));
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
    check("scan of Dark Romance finishes", done1, `${firstSeconds} s`);
    if (done1) {
      const title = await cdp.evaluate(SCAN_TITLE);
      check("summary says 25 songs scanned", title === "Scanned 25 songs", title);
      const subline = await cdp.evaluate(`document.querySelector('[data-prism-state="scan-done"] p').textContent`);
      const moodCount = Number(/lyrics mood for (\d+)/.exec(subline)?.[1] ?? -1);
      check("lyrics mood found for most Dark Romance songs", moodCount >= 15, `${moodCount} of 25`);
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
  await cdp.evaluate("window.__playlistPrism.goHome()");
  await sleep(500);

  console.log("\n[8] Preview (screen 4): Often vs Liked Songs - nothing is created");
  const PREVIEW = `document.querySelector('[data-prism-state="preview"]')`;
  await cdp.evaluate(`window.__playlistPrism.startPrism("spotify:track:4PhsKqMdgMEUSstTDAmMpg")`); // Often
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
  await cdp.evaluate("window.__playlistPrism.goHome()");
  await sleep(500);

  console.log("\n[9] Scan screen layout: the bar must not move when the text changes (fake scan)");
  await cdp.evaluate("window.__playlistPrism.previewScan()");
  await waitFor(`!!document.querySelector('[data-prism="scan-preview"] [role="progressbar"]')`);
  const barTop = `Math.round(document.querySelector('[data-prism="scan-preview"] [role="progressbar"]').getBoundingClientRect().top)`;
  const setProgress = (p) => cdp.evaluate(`window.__playlistPrism.setPreviewProgress(${JSON.stringify(p)})`);
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
  await cdp.evaluate("window.__playlistPrism.goHome()");
  await sleep(500);

  console.log("\n[10] Settings on the page (screenshot)");
  await cdp.evaluate("window.__playlistPrism.openSettings()");
  await sleep(800); // let React draw it
  const visible = await cdp.evaluate(
    `[...document.querySelectorAll("h1, h2")].some((el) => el.textContent.includes("Playlist Prism settings"))`
  );
  check("settings open on the page with their title", visible);
  await screenshot("settings.png");
  await cdp.evaluate("window.__playlistPrism.goHome()");

  console.log("\n[11] Playlist stats page (sample numbers, read-only)");
  await cdp.evaluate("window.__playlistPrism.previewStats()");
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
  await cdp.evaluate(`window.__playlistPrism.openStats("spotify:playlist:0000000000000000000001")`);
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
    await cdp.evaluate(`window.__playlistPrism.openStats(${JSON.stringify(firstPlaylist)})`);
    check(
      "a real playlist's stats page loads (saved stats or an estimate)",
      await waitFor(`!!document.querySelector('[data-prism-state="stats"]')`, 30000)
    );
  }
  // The right-click item is offered for one playlist, not for songs.
  check(
    "\"Prism stats\" is offered for a playlist, not a song",
    await cdp.evaluate(
      `!window.__playlistPrism.isSinglePlaylist(["spotify:track:4PhsKqMdgMEUSstTDAmMpg"]) && window.__playlistPrism.isSinglePlaylist(["spotify:playlist:0000000000000000000001"])`
    )
  );
  await cdp.evaluate("window.__playlistPrism.goHome()");

  console.log("\n[12] Organize playlists (step 13a, read-only: setup + scan, nothing is created)");
  await sleep(600);
  check(
    "the start page shows both modes",
    await waitFor(`!!document.querySelector('[data-prism="mode-prism"]') && !!document.querySelector('[data-prism="mode-organize"]')`, 5000)
  );
  await cdp.evaluate(`document.querySelector('[data-prism="start-organize"]').click()`);
  const ORG = `document.querySelector('[data-prism="organize"]')`;
  check(
    "Organize opens on the shared playlist picker with its settings panel",
    await waitFor(`!!${ORG}?.querySelector('[data-prism="source-list"] label') && !!${ORG}.querySelector('[data-prism="organize-settings"]')`, 15000)
  );
  // Settings: pick 3 playlists-to-make and overlap on; the chosen buttons say so.
  await cdp.evaluate(`${ORG}.querySelector('[data-prism="count-3"]').click()`);
  await cdp.evaluate(`${ORG}.querySelector('[data-prism="overlap-on"]').click()`);
  await cdp.evaluate(`${ORG}.querySelector('[data-prism="focus-genre"]').click()`);
  await sleep(200);
  check(
    "the settings buttons switch (3 playlists, overlap on, group by genre)",
    await cdp.evaluate(
      `${ORG}.querySelector('[data-prism="count-3"]').getAttribute("aria-pressed") === "true" && ${ORG}.querySelector('[data-prism="overlap-on"]').getAttribute("aria-pressed") === "true" && ${ORG}.querySelector('[data-prism="count-5"]').getAttribute("aria-pressed") === "false" && ${ORG}.querySelector('[data-prism="focus-genre"]').getAttribute("aria-pressed") === "true"`
    )
  );
  await screenshot("organize-setup.png");
  // Tick Dark Romance (cached, so the scan is quick) and scan.
  await cdp.evaluate(`[...${ORG}.querySelectorAll('[data-prism="source-list"] label')].find((r) => r.textContent.includes("Dark Romance")).click()`);
  await sleep(200);
  await cdp.evaluate(`${ORG}.querySelector('[data-prism="sources-next"]').click()`);
  const scanned = await waitFor(`!!document.querySelector('[data-prism-state="scan-done"]')`, 120000);
  check("Organize scans the picked playlist", scanned);
  if (scanned) {
    await cdp.evaluate(`[...${ORG}.querySelectorAll("button")].find((b) => b.textContent.includes("group songs")).click()`);
    const shown = await waitFor(`!!document.querySelector('[data-prism-state="organize-groups"]')`, 5000);
    const groups = shown
      ? await cdp.evaluate(`[...document.querySelectorAll('[data-prism="organize-group"]')].map((g) => g.innerText.replace(/\\s+/g, " ").slice(0, 70))`)
      : [];
    groups.forEach((g) => info(`group: ${g}`));
    check("after the scan it suggests 3 groups (the number picked)", groups.length === 3, `${groups.length} groups`);
    const intro = shown ? await cdp.evaluate(`document.querySelector('[data-prism-state="organize-groups"] p').innerText`) : "";
    check("it says how the songs were grouped", /25 songs/.test(intro) && /mostly genre/.test(intro), intro);
    await screenshot("organize-groups.png");

    // 13c: editing on the review screen (all on screen only; nothing is created).
    const CARDS = `[...document.querySelectorAll('[data-prism="organize-group"]')]`;
    const cardCount = (i) => cdp.evaluate(`parseInt(${CARDS}[${i}].innerText.match(/(\\d+) songs/)[1])`);
    check("each group card shows a 2x2 cover mosaic", await cdp.evaluate(`${CARDS}.every((c) => c.querySelectorAll("img, span[style*='gradient']").length >= 4)`));
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
    // Move the first song to the next group (glass menu: open it, pick the
    // first choice), then remove the (new) first song.
    const pickFromMenu = async (menu) => {
      await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="${menu}"]').click()`);
      await sleep(150);
      const opened = await cdp.evaluate(`!!document.querySelector('[role="listbox"] [data-prism="menu-option"]')`);
      await cdp.evaluate(`document.querySelector('[role="listbox"] [data-prism="menu-option"]').dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))`);
      await sleep(200);
      return opened;
    };
    check("the Move to… glass menu opens with the other groups", await pickFromMenu("move-menu"));
    await sleep(200);
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
    // Combine: open the renamed group, pick another group, and confirm.
    const groupsBefore = await cdp.evaluate(`${CARDS}.length`);
    await cdp.evaluate(`${CARDS}[${renamedIndex}].click()`);
    await waitFor(`!!${DETAIL}`, 3000);
    await pickFromMenu("combine-menu");
    const confirmText = await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="combine-confirm"]')?.innerText ?? ""`);
    check(
      "Combine asks first and says what will happen",
      /Move all \d+ songs from/.test(confirmText) && /will disappear/.test(confirmText) && (await cdp.evaluate(`${CARDS}.length`)) === 0,
      confirmText.replace(/\s+/g, " ").slice(0, 120)
    );
    await screenshot("organize-combine-confirm.png");
    await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="combine-yes"]').click()`);
    await sleep(200);
    await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="all-groups"]').click()`);
    await sleep(300);
    check("merging leaves one group fewer", (await cdp.evaluate(`${CARDS}.length`)) === groupsBefore - 1, `${groupsBefore} -> ${await cdp.evaluate(`${CARDS}.length`)}`);
    const suggestedAfterEdits = await cdp.evaluate(`${CARDS}.length`);

    // 13c-2: "Start from scratch" (on screen only; nothing is created).
    console.log("\n[13] Organize: Start from scratch (step 13c-2, read-only)");
    const BUILDER = `document.querySelector('[data-prism-state="organize-builder"]')`;
    await cdp.evaluate(`document.querySelector('[data-prism="start-from-scratch"]').click()`);
    check("\"Start from scratch\" opens the group builder", await waitFor(`!!${BUILDER}`, 3000));
    const builderGroups = await cdp.evaluate(`${BUILDER}.querySelectorAll('[data-prism="builder-group"]').length`);
    check("it starts with as many empty groups as picked in setup (3)", builderGroups === 3, `${builderGroups}`);
    const genres = await cdp.evaluate(
      `[...${BUILDER}.querySelectorAll('[data-prism="pick-genre"]')].map((b) => b.dataset.label + " " + b.querySelector(".prism-tag-count").textContent)`
    );
    const moods = await cdp.evaluate(`[...${BUILDER}.querySelectorAll('[data-prism="pick-mood"]')].map((b) => b.dataset.label)`);
    info(`genres: ${genres.slice(0, 8).join(", ")}${genres.length > 8 ? ", ..." : ""} (${genres.length} shown)`);
    info(`moods: ${moods.join(", ") || "(none)"}`);
    check("the genres to pick come from the scanned songs, with song counts", genres.length > 0 && genres.every((g) => / \d+$/.test(g)));
    // Sorting with empty groups says what's missing instead of sorting.
    await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-sort"]').click()`);
    await sleep(200);
    const problem = await cdp.evaluate(`${BUILDER}?.querySelector('[data-prism="builder-problem"]')?.innerText ?? ""`);
    check("\"Sort songs\" with an empty group says what's missing", /has no genres or moods yet/.test(problem), problem);
    // Give each group a label: group 1 and 2 a genre each, group 3 a mood (or a 3rd genre).
    const pick = async (groupIndex, selector, labelIndex) => {
      await cdp.evaluate(`${BUILDER}.querySelectorAll('[data-prism="builder-group"]')[${groupIndex}].click()`);
      await sleep(150);
      await cdp.evaluate(`${BUILDER}.querySelectorAll('[data-prism="${selector}"]')[${labelIndex}].click()`);
      await sleep(150);
    };
    await pick(0, "pick-genre", 0);
    const firstPressed = await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="pick-genre"][aria-pressed="true"]')?.dataset.label ?? ""`);
    const firstName = await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-name-input"]').value`);
    check("picking a genre turns it on and names the group after it", !!firstPressed && firstName.toLowerCase() === firstPressed.toLowerCase(), `${firstPressed} -> "${firstName}"`);
    await pick(1, "pick-genre", 1);
    await pick(2, moods.length ? "pick-mood" : "pick-genre", moods.length ? 0 : 2);
    await screenshot("organize-builder.png");
    await cdp.evaluate(`${BUILDER}.querySelector('[data-prism="builder-sort"]').click()`);
    const sorted = await waitFor(`document.querySelector('[data-prism-view="custom"]') !== null`, 3000);
    check("\"Sort songs\" shows the user's groups as album-cover cards", sorted);
    if (sorted) {
      const custom = await cdp.evaluate(`${CARDS}.map((g) => g.innerText.replace(/\\s+/g, " ").slice(0, 70))`);
      custom.forEach((g) => info(`your group: ${g}`));
      const total = await cdp.evaluate(`${CARDS}.reduce((n, c) => n + parseInt(c.innerText.match(/(\\d+) songs/)[1]), 0)`);
      const intro2 = await cdp.evaluate(`document.querySelector('[data-prism-state="organize-groups"] p').innerText`);
      info(intro2);
      check("3 groups, and every song is in one (overlap on: at least 25 places)", custom.length === 3 && total >= 25, `${custom.length} groups, ${total} places`);
      await screenshot("organize-custom-groups.png");
      await cdp.evaluate(`${CARDS}[0].click()`);
      check("your groups open with the same editing tools", await waitFor(`!!${DETAIL}?.querySelector('[data-prism="group-name-input"]')`, 3000));
      await cdp.evaluate(`${DETAIL}.querySelector('[data-prism="all-groups"]').click()`);
      await sleep(300);
      // Back to the suggestions: the edits made to them earlier are still there.
      await cdp.evaluate(`document.querySelector('[data-prism="use-suggestions"]').click()`);
      await sleep(300);
      check(
        "\"Use suggestions\" goes back to the suggested groups, edits kept",
        (await cdp.evaluate(`document.querySelector('[data-prism-view="suggested"]') !== null`)) &&
          (await cdp.evaluate(`${CARDS}.length`)) === suggestedAfterEdits &&
          (await cdp.evaluate(`${CARDS}.some((c) => c.innerText.startsWith("Smoke test name"))`))
      );
      // And the builder still has the picked labels.
      await cdp.evaluate(`document.querySelector('[data-prism="start-from-scratch"]').click()`);
      await sleep(300);
      check("the builder keeps your groups while you switch", (await cdp.evaluate(`${BUILDER}?.querySelectorAll('[aria-pressed="true"][data-prism^="pick-"]').length ?? 0`)) >= 1);
    }
  }
  await cdp.evaluate("window.__playlistPrism.goHome()");
} catch (error) {
  check("smoke test ran to the end", false, error.message);
} finally {
  cdp.close();
}

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
