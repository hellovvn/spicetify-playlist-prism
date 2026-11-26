// "Add with Prism" in a song's right-click menu (always-on, mockup "C",
// developer's pick 2026-11-24): a sub-menu that lists the 5 playlists that
// fit the song best, each with its fit %, plus "More on the Prism page…".
// Clicking a playlist adds the song to its end (flow.ts addSongTo ->
// write.ts addSongToPlaylist). Works for any song row, including the
// now-playing bar's song (right-click it).
//
// Spicetify's sub-menu re-draws whenever an item's text changes, so the menu
// opens at once with "Finding playlists…" and fills in when the scores are in.

import { addSongTo, findPlaylistsForSong, friendlyError, type SongFits } from "../flow";
import { fitPercent } from "../addto/fitPlaylists";
import { openPage } from "../nav";
import { isKeyProblem } from "../lastfm/keyErrors";

// Short enough for the menu; clicking it opens the Prism page, which shows the full message.
const KEY_MENU_LINE = "Last.fm access problem: see Prism page";
import { LOG_PREFIX } from "../log";

const SLOTS = 5;
const FRESH_MS = 2 * 60 * 1000;

type State =
  | { uri: string; at: number; status: "loading" }
  | { uri: string; at: number; status: "ready"; result: SongFits; added: Set<string> }
  | { uri: string; at: number; status: "error"; message: string };

let state: State | null = null;
const slotItems: Spicetify.ContextMenu.Item[] = [];
let statusItem: Spicetify.ContextMenu.Item;

const isSingleTrack = (uris: string[]) => uris.length === 1 && Spicetify.URI.isTrack(uris[0]);

// Starts the lookup for the song the menu opened on (or re-uses a fresh one).
function ensure(uri: string): void {
  if (state && state.uri === uri && (state.status === "loading" || Date.now() - state.at < FRESH_MS)) return;
  const mine: State = { uri, at: Date.now(), status: "loading" };
  state = mine;
  setTimeout(redraw); // not during the menu's own drawing (shouldAdd runs while React draws it)
  findPlaylistsForSong(uri).then(
    (result) => {
      if (state !== mine) return; // the user right-clicked another song meanwhile
      state = { uri, at: Date.now(), status: "ready", result, added: new Set() };
      redraw();
    },
    (error) => {
      if (state !== mine) return;
      console.error(`${LOG_PREFIX} add with Prism failed`, error);
      state = { uri, at: Date.now(), status: "error", message: isKeyProblem(error) ? KEY_MENU_LINE : friendlyError(error) };
      redraw();
    }
  );
}

const h = (...args: any[]) => (Spicetify.React.createElement as any)(...args);

// One playlist line: its name, then the fit % as a small lavender pill.
function slotLabel(name: string, right: string, done = false) {
  return h(
    "span",
    { className: "prism-menu-fit-row" },
    h("span", { className: "prism-menu-fit-name" }, name),
    h("span", { className: done ? "prism-menu-fit-pill is-done" : "prism-menu-fit-pill" }, right)
  );
}

// Sets every item's text from the state. Each set re-draws an open menu.
function redraw(): void {
  slotItems.forEach((item, i) => {
    const fit = state?.status === "ready" ? state.result.fits[i] : undefined;
    if (!fit || state?.status !== "ready") return;
    const done = state.added.has(fit.uri);
    item.name = slotLabel(fit.name, done ? "Added ✓" : fitPercent(fit.score), done) as any;
    item.disabled = done;
  });
  if (!statusItem) return;
  if (!state || state.status === "loading") {
    statusItem.name = "Finding playlists…";
    statusItem.disabled = true;
  } else if (state.status === "error") {
    statusItem.name = state.message.length > 60 ? "Couldn't rank your playlists" : state.message;
    statusItem.disabled = false;
  } else if (!state.result.tagged) {
    statusItem.name = "No genre tags for this song yet";
    statusItem.disabled = false;
  } else if (state.result.fits.length === 0) {
    statusItem.name = "No playlist fits yet: see Prism page";
    statusItem.disabled = false;
  } else {
    statusItem.name = "More on the Prism page…";
    statusItem.disabled = false;
  }
}

async function addFromSlot(i: number): Promise<void> {
  if (state?.status !== "ready") return;
  const current = state;
  const fit = current.result.fits[i];
  if (!fit || current.added.has(fit.uri)) return;
  try {
    await addSongTo(fit, current.result.song);
    current.added.add(fit.uri);
    redraw();
    Spicetify.showNotification(`Added "${current.result.song.name}" to ${fit.name}`);
  } catch (error) {
    console.error(`${LOG_PREFIX} add with Prism: adding failed`, error);
    Spicetify.showNotification(friendlyError(error), true);
  }
}

const CSS = `
.prism-menu-fit-row { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 180px; }
.prism-menu-fit-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.prism-menu-fit-pill { flex: none; font-size: 11px; line-height: 16px; padding: 1px 8px; border-radius: 999px;
  background: rgba(201, 167, 255, 0.22); color: #e6d8ff; font-variant-numeric: tabular-nums; }
.prism-menu-fit-pill.is-done { background: rgba(167, 240, 216, 0.2); color: #c8f5e6; }
`;

export function startAddWithPrism(icon: string): void {
  const style = document.createElement("style");
  style.dataset.prism = "add-with-prism";
  style.textContent = CSS;
  document.head.appendChild(style);

  for (let i = 0; i < SLOTS; i++) {
    slotItems.push(
      new Spicetify.ContextMenu.Item(
        "",
        () => void addFromSlot(i),
        (uris) => state?.uri === uris[0] && state.status === "ready" && state.result.fits.length > i
      )
    );
  }
  statusItem = new Spicetify.ContextMenu.Item("Finding playlists…", (uris) => openPage({ go: "addto", song: uris[0] }), () => true);
  // The 5th argument (icon) exists in Spicetify's code but not in its type list.
  const SubMenu = Spicetify.ContextMenu.SubMenu as any;
  new SubMenu(
    "Add with Prism",
    [...slotItems, statusItem],
    (uris: string[]) => {
      if (!isSingleTrack(uris)) return false;
      ensure(uris[0]);
      return true;
    },
    false,
    icon
  ).register();
  redraw();
}

// Smoke/debug: what the menu would show for a song (read-only).
export function addWithPrismState(): unknown {
  if (!state) return null;
  if (state.status !== "ready") return { uri: state.uri, status: state.status };
  return {
    uri: state.uri,
    status: state.status,
    fits: state.result.fits.map((f) => ({ name: f.name, score: Math.round(f.score * 100), reasons: f.reasons })),
    unjudged: state.result.unjudged,
  };
}
