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
  // The popup should appear at once, showing the spinner while it loads.
  const loadingShown = await waitFor(`!!document.querySelector('[data-prism-state="loading"]')`, 1000);
  check("popup opens immediately with a loading spinner", loadingShown);
  const anim = await cdp.evaluate(`getComputedStyle(document.querySelector(".GenericModal")).animationName`);
  check("open animation is applied to the popup", anim === "prism-pop", `animation: ${anim}`);
  const opened = await waitFor(READY);
  check("seed panel finishes loading for Often", opened);
  if (opened) {
    const before = await cdp.evaluate(chipStates);
    check("Often: one chip per tag, all on", before.length === 5 && before.every((s) => s === "true"), JSON.stringify(before));
    check("counter says 5 of 5", (await cdp.evaluate(keptText)) === "5 of 5 tags on", await cdp.evaluate(keptText));
    info(`BPM/key line: ${await cdp.evaluate(`${PANEL}.textContent.match(/\\d+ BPM[^)]*\\)/)?.[0]`)}`);

    await cdp.evaluate(`${PANEL}.querySelector('[role="checkbox"]').click()`); // switch the first chip off
    await sleep(300);
    const after = await cdp.evaluate(chipStates);
    check("clicking a chip switches it off", after[0] === "false" && after.slice(1).every((s) => s === "true"), JSON.stringify(after));
    check("counter updates to 4 of 5", (await cdp.evaluate(keptText)) === "4 of 5 tags on", await cdp.evaluate(keptText));

    await cdp.evaluate(`${PANEL}.querySelector('[role="checkbox"]').click()`); // and back on
    await sleep(300);
    check("clicking again switches it back on", (await cdp.evaluate(chipStates))[0] === "true");
    check("all tags on: no warning, Next enabled", (await cdp.evaluate(statusKind)) === "none" && !(await cdp.evaluate(`${NEXT}.disabled`)));

    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await writeFile(new URL("seed-panel.png", outputDir), Buffer.from(shot.result.data, "base64"));
    info("screenshot: smoke-output/seed-panel.png");

    // Switch EVERY chip off: Next must be blocked, with an explanation.
    await cdp.evaluate(`${PANEL}.querySelectorAll('[role="checkbox"]').forEach((c) => c.click())`);
    await sleep(300);
    check("all tags off: blocked message shown", (await cdp.evaluate(statusKind)) === "all-off", await cdp.evaluate(statusKind));
    check("all tags off: Next is disabled", await cdp.evaluate(`${NEXT}.disabled`));
    const blockedShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await writeFile(new URL("seed-panel-blocked.png", outputDir), Buffer.from(blockedShot.result.data, "base64"));
    info("screenshot: smoke-output/seed-panel-blocked.png");
    await cdp.evaluate("Spicetify.PopupModal.hide()");
  }

  // A song with no song-level tags: artist row + "broader matches" warning, still allowed.
  await sleep(500);
  await cdp.evaluate(`window.__playlistPrism.startPrism("spotify:track:19Lnk1Q2FJcB3Hia0wfgye")`); // RESCUER
  const rescuerReady = await waitFor(READY);
  check("RESCUER: shows the 'From the artist' chip row", rescuerReady && (await cdp.evaluate(`${PANEL}.textContent.includes("From the artist")`)));
  if (rescuerReady) {
    check("RESCUER: artist-only warning shown", (await cdp.evaluate(statusKind)) === "artist-only", await cdp.evaluate(statusKind));
    check("RESCUER: Next still enabled (warning, not a block)", !(await cdp.evaluate(`${NEXT}.disabled`)));
    const warnShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    await writeFile(new URL("seed-panel-artist-only.png", outputDir), Buffer.from(warnShot.result.data, "base64"));
    info("screenshot: smoke-output/seed-panel-artist-only.png");
  }
  await cdp.evaluate("Spicetify.PopupModal.hide()");
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
      const pickerShot = await cdp.send("Page.captureScreenshot", { format: "png" });
      await writeFile(new URL("source-picker.png", outputDir), Buffer.from(pickerShot.result.data, "base64"));
      info("screenshot: smoke-output/source-picker.png");

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
      const allShot = await cdp.send("Page.captureScreenshot", { format: "png" });
      await writeFile(new URL("source-picker-all.png", outputDir), Buffer.from(allShot.result.data, "base64"));
      info("screenshot: smoke-output/source-picker-all.png");
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

      // The popup must keep ONE size whatever the search shows.
      const SET_QUERY = (q) => `(() => {
        const input = ${SOURCES}.querySelector('input[type="search"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(q)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()`;
      const modalHeight = `Math.round(document.querySelector(".GenericModal").getBoundingClientRect().height)`;
      const heights = {};
      for (const q of ["", "kpop", "zzz-no-match"]) {
        await cdp.evaluate(SET_QUERY(q));
        await sleep(200);
        heights[q || "(empty)"] = await cdp.evaluate(modalHeight);
      }
      const sizes = new Set(Object.values(heights));
      check("popup height stays the same while searching", sizes.size === 1, JSON.stringify(heights));
      check("no matches: 'Select all' stays visible but disabled", await cdp.evaluate(`${SELECT_ALL}.querySelector("input").disabled`));
    }
  }
  await cdp.evaluate("Spicetify.PopupModal.hide()");
  await sleep(500);

  console.log("\n[7] Settings popup (screenshot)");
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
