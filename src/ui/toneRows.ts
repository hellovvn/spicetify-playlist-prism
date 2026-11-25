// The TONE VIEW on Spotify's own playlist page (rings: mockup "A"; strip:
// mockup "E", developer's picks 2026-11-24): for a playlist with a tone
// (src/tone/tone.ts), a slim glass TONE STRIP sits under the action bar
// (Play/Shuffle): a toggle, the tone's genres/moods and Edit (plus a short
// status only while the rings load). With the toggle on, every
// song row gets a small score ring (how well the song fits the tone, same %
// idea as Grow), and songs under 50% get a grey ring.
//
// Spotify draws this page, so we can't change its React code. Instead this
// adds our own elements into its rows and re-checks them whenever the page
// changes (Spotify reuses row elements while you scroll, so a ring must
// always follow the SONG, not the element). Each row's song URI is read from
// React's own data on the element (no song ID is in the page's HTML).
//
// READ-ONLY: it only reads the playlist (and looks up tags/moods like a
// scan); nothing is ever written to the playlist. Runs from the always-on
// script (src/extensions/prism.tsx). Pure parts are in src/ui/toneView.ts
// (tests/toneRows.test.ts).

import { loadTones, loadToneSongs, saveTone, TONES_CHANGED_EVENT } from "../flow";
import { describeMatch, scoreAgainstTone, type PlaylistTone, type ToneMatch } from "../tone/tone";
import { LOG_PREFIX } from "../log";
import { openTonePopup } from "./tonePopup";
import { moodColour, tagColour } from "./tagLabels";
import { playlistUriFromPath, ringSvg, stripStatus } from "./toneView";
import { PRISM_STAR_CSS, PRISM_STAR_HTML } from "./prismStar";

const STYLE_ID = "playlist-prism-tone-rows";
const STRIP_ATTR = "data-prism-tone-strip";
const MAX_CHIPS = 4; // genres/moods shown in the strip; the rest as "+N"
const RING_CLASS = "prism-tone-ring";

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// The tone's labels as Prism's read-only tag labels (moods dashed).
function chipsHtml(tone: PlaylistTone): string {
  const labels = [...tone.genres.map((g) => ({ name: g, mood: false })), ...tone.moods.map((m) => ({ name: m, mood: true }))];
  const shown = labels.slice(0, MAX_CHIPS).map(
    (l) => `<span class="prism-tag shared${l.mood ? " mood" : ""}" style="--tag:${l.mood ? moodColour(l.name) : tagColour(l.name)}"><span class="prism-tag-text">${escapeHtml(l.name)}</span></span>`
  );
  if (labels.length > MAX_CHIPS) shown.push(`<span class="prism-tone-strip-more">+${labels.length - MAX_CHIPS}</span>`);
  if (tone.tempo !== "any") shown.push(`<span class="prism-tone-strip-tempo">${tone.tempo} tempo</span>`);
  return shown.join("");
}

const CSS = `
/* ----- Tone view on Spotify's playlist page (src/ui/toneRows.ts) ----- */
/* The tone strip: a slim glass band under the action bar. It sits outside
   Prism's page, so it brings the few Prism colours it uses. */
[${STRIP_ATTR}] {
  --prism-accent-soft: #cdb8ff;
  --prism-ease: 150ms ease-out;
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  width: 100%; box-sizing: border-box; /* the full width of the song list */
  margin: 4px 0 8px; padding: 8px 14px; min-height: 36px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(183, 148, 255, 0.18), rgba(183, 148, 255, 0.08));
  border: 1px solid rgba(205, 184, 255, 0.35);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
  color: #f2ecff; font-size: 13px;
}
[${STRIP_ATTR}] .prism-tone-strip-title { font-weight: 700; cursor: pointer; white-space: nowrap; user-select: none; }
[${STRIP_ATTR}] .prism-tone-strip-chips { display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap; }
[${STRIP_ATTR}] .prism-tone-strip-tempo, [${STRIP_ATTR}] .prism-tone-strip-more { font-size: 11px; color: #b3a6d6; }
/* Empty once loaded, but still pushes Edit to the right end. */
[${STRIP_ATTR}] .prism-tone-strip-status { margin-left: auto; font-size: 12px; color: #b3a6d6; white-space: nowrap; }
[${STRIP_ATTR}] .prism-quiet-button { align-self: center; padding: 2px; }
.${RING_CLASS} { display: inline-flex; flex: none; width: 32px; height: 32px; margin-right: 12px; cursor: default; }
`;

// The song URI of one of Spotify's track rows, from React's data on it.
function trackUriOfRow(row: Element): string | null {
  const key = Object.keys(row).find((k) => k.startsWith("__reactFiber"));
  let fiber = key ? (row as any)[key] : null;
  for (let depth = 0; fiber && depth < 25; depth++, fiber = fiber.return) {
    const uri = fiber.memoizedProps?.uri;
    if (typeof uri === "string" && uri.startsWith("spotify:track:")) return uri;
  }
  return null;
}

interface Scores {
  key: string; // playlist + tone version
  byUri: Map<string, { match: ToneMatch; bpm: number | null }>;
  loading: { done: number; total: number } | null; // the first load (progress in the switch)
  failed: boolean;
  // Songs added to the playlist after the first load: a row whose song has
  // no score makes the view read the playlist again (quietly, rings stay).
  refreshing: boolean;
  lastRefresh: number;
  notInPlaylist: Set<string>; // rows that aren't playlist songs (Spotify's "Recommended")
}

// At most one re-read of the playlist every this many ms.
const REFRESH_GAP_MS = 5000;

// Only touch the DOM when the content changed (no flicker, no observer loop).
function setHtml(el: Element, html: string) {
  if (el.innerHTML !== html) el.innerHTML = html;
}

// The strip's fixed parts; chips and status are filled in by update().
function buildStrip(): HTMLElement {
  const strip = document.createElement("div");
  strip.setAttribute(STRIP_ATTR, "");
  strip.innerHTML =
    `<button type="button" class="prism-toggle" role="switch" aria-checked="false" aria-label="Show tone rings on the songs"></button>` +
    `<span class="prism-tone-strip-title">${PRISM_STAR_HTML} Tone</span>` +
    `<span class="prism-tone-strip-chips"></span>` +
    `<span class="prism-tone-strip-status" aria-live="polite"></span>` +
    `<button type="button" class="prism-quiet-button" data-prism-tone-edit>Edit</button>`;
  const toggle = () => {
    const now = playlistUriFromPath(Spicetify.Platform.History.location?.pathname);
    const saved = now ? loadTones()[now] : undefined;
    if (now && saved) saveTone(now, { ...saved, show: !saved.show }); // a LOCAL setting, sends TONES_CHANGED_EVENT
  };
  strip.querySelector(".prism-toggle")!.addEventListener("click", toggle);
  strip.querySelector(".prism-tone-strip-title")!.addEventListener("click", toggle);
  strip.querySelector("[data-prism-tone-edit]")!.addEventListener("click", () => {
    const now = playlistUriFromPath(Spicetify.Platform.History.location?.pathname);
    if (now) openTonePopup(now); // over the playlist, not on the Prism page
  });
  return strip;
}

export function startToneRows(): void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS + PRISM_STAR_CSS;
  document.head.appendChild(style);

  let scores: Scores | null = null;
  let scheduled = false;

  const currentPlaylist = () => playlistUriFromPath(Spicetify.Platform.History.location?.pathname);

  // Scores for this playlist + tone (loaded once; songs without cached tags
  // are looked up like a scan, with progress in the switch).
  const scoreAll = (mine: Scores, uri: string, tone: PlaylistTone, onProgress: (p: { done: number; total: number }) => void) =>
    loadToneSongs(uri, onProgress, () => scores !== mine).then((songs) => {
      const byUri: Scores["byUri"] = new Map();
      for (const s of songs) {
        const bpm = s.audio?.bpm ?? null;
        byUri.set(s.uri, { match: scoreAgainstTone(tone, { tags: s.tags, bpm, mood: s.mood }), bpm });
      }
      mine.byUri = byUri;
    });

  const ensureScores = (uri: string, tone: PlaylistTone) => {
    const key = `${uri}|${tone.updatedAt}`;
    if (scores?.key === key) return;
    const mine: Scores = {
      key, byUri: new Map(), loading: { done: 0, total: 0 }, failed: false,
      refreshing: false, lastRefresh: Date.now(), notInPlaylist: new Set(),
    };
    scores = mine;
    scoreAll(mine, uri, tone, (p) => {
      mine.loading = { done: p.done, total: p.total };
      schedule();
    })
      .then(() => {
        mine.loading = null;
        schedule();
      })
      .catch((error) => {
        console.warn(`${LOG_PREFIX} tone view: couldn't score the playlist`, error);
        mine.loading = null;
        mine.failed = true;
        schedule();
      });
  };

  // Rows showed songs with no score: read the playlist again and score the
  // new songs (cached songs are instant). Songs still missing afterwards
  // aren't in the playlist (Spotify's recommendations) and are skipped.
  const refreshFor = (mine: Scores, uri: string, tone: PlaylistTone, missing: string[]) => {
    if (mine.refreshing || mine.loading || Date.now() - mine.lastRefresh < REFRESH_GAP_MS) return;
    mine.refreshing = true;
    scoreAll(mine, uri, tone, () => {})
      .catch((error) => console.warn(`${LOG_PREFIX} tone view: couldn't re-read the playlist`, error))
      .then(() => {
        missing.filter((m) => !mine.byUri.has(m)).forEach((m) => mine.notInPlaylist.add(m));
        mine.refreshing = false;
        mine.lastRefresh = Date.now();
        schedule();
      });
  };

  const clearRows = () => {
    document.querySelectorAll(`.${RING_CLASS}`).forEach((el) => el.remove());
  };

  const update = () => {
    scheduled = false;
    const uri = currentPlaylist();
    const tone = uri ? loadTones()[uri] : undefined;
    const bar = document.querySelector('.Root__main-view [data-testid="action-bar-row"]');
    let strip = document.querySelector(`[${STRIP_ATTR}]`) as HTMLElement | null;

    if (!uri || !tone || !bar?.parentElement) {
      strip?.remove();
      clearRows();
      return;
    }

    // The strip, right under the action bar row.
    if (!strip || strip.previousElementSibling !== bar) {
      strip?.remove();
      strip = buildStrip();
      bar.after(strip);
    }
    if (tone.show) ensureScores(uri, tone);
    const status = stripStatus(tone.show, { loading: scores?.loading ?? null, failed: !!scores?.failed });
    setHtml(strip.querySelector(".prism-tone-strip-chips")!, chipsHtml(tone));
    setHtml(strip.querySelector(".prism-tone-strip-status")!, status);
    strip.querySelector(".prism-toggle")!.setAttribute("aria-checked", String(tone.show));

    if (!tone.show || !scores || scores.loading) {
      clearRows();
      return;
    }

    // A ring in every visible song row (before the duration).
    const rows = document.querySelectorAll('.Root__main-view [role="grid"] [role="row"]');
    const missing: string[] = [];
    rows.forEach((row) => {
      const end = row.querySelector(".main-trackList-rowSectionEnd");
      if (!end) return; // the header row
      const songUri = trackUriOfRow(row);
      const scored = songUri ? scores!.byUri.get(songUri) : undefined;
      let ring = end.querySelector(`.${RING_CLASS}`) as HTMLElement | null;
      if (!scored) {
        if (songUri && !scores!.notInPlaylist.has(songUri)) missing.push(songUri);
        ring?.remove();
        return;
      }
      if (!ring) {
        ring = document.createElement("span");
        ring.className = RING_CLASS;
        ring.setAttribute("role", "img");
        end.insertBefore(ring, end.firstChild);
      }
      // Only touch the DOM when something changed (Spotify reuses rows).
      if (ring.dataset.uri !== songUri || ring.dataset.key !== scores!.key) {
        const text = describeMatch(tone, scored.match, scored.bpm);
        ring.innerHTML = ringSvg(scored.match.score, scored.match.partial);
        ring.title = text;
        ring.setAttribute("aria-label", text);
        ring.dataset.uri = songUri!;
        ring.dataset.key = scores!.key;
      }
    });
    if (missing.length > 0) refreshFor(scores, uri, tone, missing);
  };

  // Many changes come at once while Spotify draws or scrolls: handle them
  // together on the next frame.
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };

  const observer = new MutationObserver((mutations) => {
    // Ignore our own changes (rings and the switch), or we'd loop.
    const ours = mutations.every((m) => {
      const target = m.target as Element;
      return target.closest?.(`.${RING_CLASS}, [${STRIP_ATTR}]`) || [...m.addedNodes, ...m.removedNodes].every((n) => (n as Element).matches?.(`.${RING_CLASS}, [${STRIP_ATTR}]`));
    });
    if (!ours) schedule();
  });
  const watchMainView = () => {
    const main = document.querySelector(".Root__main-view");
    if (main && !(main as any).__prismToneWatched) {
      (main as any).__prismToneWatched = true;
      observer.observe(main, { childList: true, subtree: true });
    }
  };

  watchMainView();
  schedule();
  Spicetify.Platform.History.listen(() => schedule());
  window.addEventListener(TONES_CHANGED_EVENT, () => schedule());
  window.setInterval(() => {
    watchMainView(); // Spotify may rebuild its main view
    schedule();
  }, 1500);
}
