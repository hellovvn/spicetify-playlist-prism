// The Prism PAGE (step 12a): everything Prism shows lives here.
//
// It shows one of:
//   home       start screen: use the playing song, or paste a song link
//   prism      the flow (tags -> sources -> scan -> preview) for one seed song
//   stats      how a Prism playlist was made (right-click it > "Prism stats")
//   tone       set a playlist's tone (right-click it > "Prism tone")
//   organize   split several playlists into new ones by genre/mood (step 13)
//   merge      join several playlists into one, without duplicates
//   addto      "Add with Prism": the 5 playlists that fit a song best
//   demo-scan  DEV/TEST: scan screen with a fake scan (smoke test)
//   demo-stats DEV/TEST: stats page with sample numbers (smoke test)
// Settings (the Last.fm key) open ON TOP of whichever of these is showing:
// the screen underneath is only hidden, so "Back" returns to it unchanged
// (e.g. a half-finished Prism keeps its chips, picks and scan results).
//
// Other parts of Spotify (right-click menu, profile menu, debug hook) open
// this page with a request in the address, e.g. ?go=start&seed=... (see
// src/nav.ts). The page reads it when it opens, and listens for new ones
// while it's open.
//
// For now (12a) there's ONE Prism at a time, and leaving the page ends it.
// Step 12b adds tabs and scans that keep running while you browse.

import React from "react";
import { FlipTile } from "./FlipTile";
import { StartBar } from "./StartBar";
import { UpdateNotice } from "./UpdateNotice";
import { OrganizeIcon, PrismIcon as PrismTileIcon } from "./HomeIcons";
import { getPlaylistCover, getSources, getSourceTracks } from "../spotify/read";
import { getLastfmKey, loadPanelStatsSetting } from "../storage";
import { SAMPLE_RECORD } from "../stats/playlistStats";
import { StatsScreen } from "./StatsScreen";
import { isPanelStatsOn, readPanelView } from "./sidePanel";


import { OrganizeFlow } from "./OrganizeFlow";
import { MergeFlow } from "./MergeFlow";
import { AddSongIcon, MergeIcon } from "./HomeIcons";
import { AddToScreen } from "./AddToScreen";
import { addSongTo, findPlaylistsForSong, createFromPreview, createOrganizedPlaylist, findNewSongs, mergePlaylists, friendlyError, loadPlaylistExtras, loadPlaylistStats, loadSeed, loadToneFit, loadToneSongs, loadTones, runScan, saveTone } from "../flow";
import { getPlaylistName } from "../spotify/read";
import { ToneEditor } from "./ToneEditor";
import { PAGE_PATH, parsePageRequest, parseTrackLink, type PageRequest } from "../nav";
import { SeedPanel } from "./SeedPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ReportScreen } from "./ReportScreen";
import type { ReportKind } from "../report/report";
import { ScanDemo } from "./ScanScreen";
import { injectStyles, SCREEN_HEIGHT } from "./styles";
import { PrismIcon } from "./PrismIcon";

// Background sparkles: [left %, top %, size px, twinkle length s, delay s].
// Fixed, hand-picked "random" values, so they're spread out and never blink
// together (CSS has no random numbers).
const SPARKLES: [number, number, number, number, number][] = [
  [8, 12, 18, 5.2, 0], [22, 70, 13, 6.8, 1.9], [35, 28, 14, 4.6, 3.1], [48, 88, 20, 7.4, 0.8],
  [62, 15, 13, 5.9, 2.6], [74, 55, 16, 6.3, 4.2], [88, 32, 22, 5.5, 1.2], [93, 80, 14, 7.9, 3.7],
  [15, 45, 11, 6.1, 4.8], [55, 40, 11, 8.2, 5.6], [80, 8, 16, 4.9, 2.1], [4, 90, 16, 6.6, 3.4],
  [40, 5, 13, 7.1, 6.2], [68, 92, 13, 5.3, 0.4],
];

type View =
  | { kind: "home" }
  | { kind: "prism"; seed: string; id: string }
  | { kind: "stats"; playlist: string; id: string } // stats for a Prism playlist
  | { kind: "tone"; playlist: string; id: string } // set a playlist's tone
  | { kind: "organize"; id: string } // Organize playlists (step 13)
  | { kind: "merge"; id: string } // Merge playlists
  | { kind: "addto"; song?: string; id: string } // Add with Prism
  | { kind: "demo-scan"; id: string }
  | { kind: "demo-stats"; id: string };

// Settings, when open. thenStart: seed to continue with after saving the key.
// report: "Report a bug" / "Suggest an idea" is open (inside Settings; Back returns to Settings).
type SettingsState = { notice?: string; thenStart?: string; report?: ReportKind };

// What a request does: switch the screen, or open settings on top of it.
type PageAction = { view: View } | { settings: SettingsState };

// Requests already handled. Kept OUTSIDE the component, so it survives the
// page closing and opening again: going Back to an old address never
// restarts an old Prism. (Module-level variables live as long as Spotify runs.)
const handledRequests = new Set<string>();

let localIds = 0;
const newId = () => `local-${++localIds}`;

// What to do for a request.
function actionFor(request: PageRequest, id: string): PageAction {
  switch (request.go) {
    case "start":
      // No key yet: ask for it first, then carry on with this song.
      if (!getLastfmKey()) {
        return { settings: { notice: "Add your Last.fm API key first, then your Prism starts.", thenStart: request.seed } };
      }
      return { view: { kind: "prism", seed: request.seed, id } };
    case "settings":
      return { settings: {} };
    case "home":
      return { view: { kind: "home" } };
    case "stats":
      return { view: { kind: "stats", playlist: request.playlist, id } };
    case "tone":
      return { view: { kind: "tone", playlist: request.playlist, id } };
    case "addto":
      return { view: { kind: "addto", song: request.song, id } };
    case "demo-scan":
      return { view: { kind: "demo-scan", id } };
    case "demo-stats":
      return { view: { kind: "demo-stats", id } };
  }
}

// The request in the current address, if it's new. Marks it as handled.
function takeRequest(location: { pathname?: string; search?: string } | undefined): PageAction | null {
  if (!location || location.pathname !== PAGE_PATH) return null;
  const parsed = parsePageRequest(location.search ?? "");
  if (!parsed || handledRequests.has(parsed.requestId)) return null;
  handledRequests.add(parsed.requestId);
  return actionFor(parsed.request, parsed.requestId);
}

// Where Spotify's right-hand side panel sits: the last column of its
// window layout (a grid: library | main view | right panel), at the full
// height of the page. Falls back to the panel's remembered width, then to
// the right third of the page.
function sidePanelBox(page: DOMRect): { left: number; top: number; width: number; height: number } {
  const grid = document.querySelector(".Root__top-container");
  const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").map(parseFloat) : [];
  // While the full stats page is open, Spotify shrinks the right-hand column
  // to 0px, so use the width the side panel last had (panelHost.tsx keeps it).
  const remembered = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--prism-side-panel-width"));
  const width =
    columns.length >= 3 && columns[2] > 0 ? columns[2] : remembered > 0 ? remembered : page.width / 3;
  const capped = Math.min(width, page.width);
  return { left: page.right - capped, top: page.top, width: capped, height: page.height };
}

export function PrismPage() {
  const { ButtonSecondary } = Spicetify.ReactComponent as any;
  const History = Spicetify.Platform.History;
  // The useState initializers run once: start with the address's request, if any.
  const [first] = React.useState(() => takeRequest(History.location));
  const [view, setView] = React.useState<View>(first && "view" in first ? first.view : { kind: "home" });
  const [settings, setSettings] = React.useState<SettingsState | null>(first && "settings" in first ? first.settings : null);

  // Carry out a request: a new screen closes settings; settings open on top.
  const apply = (action: PageAction) => {
    if ("view" in action) {
      setView(action.view);
      setSettings(null);
    } else {
      setSettings(action.settings);
    }
  };

  React.useEffect(() => {
    injectStyles();
    // New requests while the page is open (e.g. right-click another song).
    // listen() returns a function that stops listening; React calls it when
    // the page closes (the "cleanup" of useEffect).
    return History.listen((location: { pathname?: string; search?: string }) => {
      const next = takeRequest(location);
      if (next) apply(next);
    });
  }, []);

  const goHome = () => apply({ view: { kind: "home" } });

  // Is a scan running right now? (SeedPanel -> ScanScreen tell us.) Leaving
  // the Prism stops its scan (until step 12b), so "Start page" asks first.
  const [scanning, setScanning] = React.useState(false);
  // "Show in the side panel": a still copy ("ghost") of the stats page is
  // laid over the window and shrinks towards the right (styles.ts,
  // .prism-ghost) while Spotify opens the playlist underneath. The ghost only
  // moves and fades, which the browser keeps animating even while Spotify is
  // busy, so there's no stutter and no black screen. Two animation frames
  // are waited first so the ghost is on screen before Spotify gets busy.
  const minimize = (uri: string) => {
    const open = () => History.push(`/playlist/${uri.split(":")[2]}`);
    const page = document.querySelector('[data-prism="cosmos"]') as HTMLElement | null;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!page || reduceMotion) return open();
    // Only the part of the page you can see: the main view's box (the page
    // itself can be taller than the window when it scrolls).
    const pageBox = page.getBoundingClientRect();
    const view = (document.querySelector(".Root__main-view") as HTMLElement | null)?.getBoundingClientRect() ?? pageBox;
    const box = new DOMRect(view.left, view.top, view.width, view.height);
    const ghost = page.cloneNode(true) as HTMLElement;
    // The copy must not be mistaken for the real page (tests and our own code
    // look things up by these attributes).
    ghost.removeAttribute("data-prism");
    ghost.querySelectorAll("[data-prism], [data-prism-state], [data-prism-view], [id]").forEach((el) => {
      el.removeAttribute("data-prism");
      el.removeAttribute("data-prism-state");
      el.removeAttribute("data-prism-view");
      el.removeAttribute("id");
    });
    ghost.classList.remove("is-wide-stats");
    // A window-sized frame that clips the copy to what was on screen; the
    // frame is what moves.
    Object.assign(ghost.style, { position: "absolute", left: `${pageBox.left - box.left}px`, top: `${pageBox.top - box.top}px`, width: `${pageBox.width}px`, height: `${pageBox.height}px`, margin: "0" });
    const frame = document.createElement("div");
    frame.className = "prism-ghost";
    Object.assign(frame.style, { position: "fixed", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, overflow: "hidden", zIndex: "50", borderRadius: "8px" });
    frame.appendChild(ghost);
    document.body.appendChild(frame);
    // Hide the real page's content (its twilight background stays), so only
    // the shrinking copy moves: no second copy of the stats behind it.
    page.classList.add("is-leaving");
    // "Morph into the panel": shrink to exactly where the side panel will be
    // (the right-hand column of Spotify's layout, the same height as the
    // page) and fade into it. element.animate() is the Web Animations API:
    // the same as a CSS animation, but with numbers worked out right now.
    const target = sidePanelBox(box);
    const morph = frame.animate(
      [
        { transform: "none", opacity: 1 },
        { opacity: 0.85, offset: 0.6 },
        {
          transform: `translate(${target.left - box.left}px, ${target.top - box.top}px) scale(${target.width / box.width}, ${target.height / box.height})`,
          opacity: 0.4,
        },
      ],
      { duration: 480, easing: "cubic-bezier(0.5, 0, 0.2, 1)", fill: "forwards" }
    );
    const remove = () => frame.remove();
    // The last step is a CROSSFADE: the copy waits in the panel's spot until
    // the side panel's stats are actually drawn, then fades out while they
    // fade in (so there's no moment with neither on screen).
    morph.onfinish = () => {
      const started = performance.now();
      const fadeWhenReady = () => {
        const drawn = !!document.querySelector('#prism-panel-stats [data-prism="panel-stats"]');
        if (!drawn && performance.now() - started < 700) return requestAnimationFrame(fadeWhenReady);
        frame.animate([{ opacity: 0.4 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" }).onfinish = remove;
      };
      fadeWhenReady();
    };
    window.setTimeout(remove, 2500); // just in case
    requestAnimationFrame(() => requestAnimationFrame(open));
  };
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  React.useEffect(() => {
    if (!scanning) setConfirmLeave(false); // scan finished: nothing to warn about
  }, [scanning]);
  const startPageClicked = () => (scanning ? setConfirmLeave(true) : goHome());
  const start = (seed: string) => apply(actionFor({ go: "start", seed }, newId()));

  let body: React.ReactNode;
  if (view.kind === "prism") {
    body = (
      <SeedPanel
        // key: a NEW panel for every Prism, so nothing carries over from the last one.
        key={view.id}
        load={() => loadSeed(view.seed)}
        loadSources={getSources}
        runScan={runScan}
        findNew={findNewSongs}
        describeError={friendlyError}
        onCancel={goHome}
        onScanningChange={setScanning}
        onCreate={async (choice) => {
          const playlistUri = await createFromPreview(choice);
          const count = choice.songs.length + 1;
          Spicetify.showNotification(`Created "${choice.name.trim()}" with ${count} songs`);
          goHome();
          // Open the new playlist (just navigation, like clicking it in the sidebar).
          History.push(`/playlist/${playlistUri.split(":")[2]}`);
        }}
      />
    );
  } else if (view.kind === "demo-scan") {
    body = <ScanDemo key={view.id} onRunningChange={setScanning} />;
  } else if (view.kind === "stats") {
    const playlist = view.playlist;
    body = (
      <StatsScreen
        key={view.id}
        load={() => loadPlaylistStats(playlist)}
        // Just navigation, like clicking the playlist in the sidebar.
        onOpenPlaylist={(uri) => History.push(`/playlist/${uri.split(":")[2]}`)}
        onMinimize={isPanelStatsOn(loadPanelStatsSetting()) && readPanelView(document.documentElement) === "prism" ? minimize : undefined}
        loadExtras={loadPlaylistExtras}
        loadToneFit={loadToneFit}
        loadCover={getPlaylistCover}
      />
    );
  } else if (view.kind === "tone") {
    const playlist = view.playlist;
    const openPlaylist = () => History.push(`/playlist/${playlist.split(":")[2]}`);
    body = (
      <ToneEditor
        key={view.id}
        playlist={playlist}
        loadName={getPlaylistName}
        loadSongs={loadToneSongs}
        saved={loadTones()[playlist] ?? null}
        describeError={friendlyError}
        onBack={openPlaylist}
        onSave={(tone) => {
          saveTone(playlist, tone);
          openPlaylist(); // with the Tone view switched on
        }}
        onRemove={() => {
          saveTone(playlist, null);
          openPlaylist();
        }}
      />
    );
  } else if (view.kind === "organize") {
    body = (
      <OrganizeFlow
        key={view.id}
        loadSources={getSources}
        createPlaylist={createOrganizedPlaylist}
        // Just navigation, like clicking the playlist in the sidebar.
        onOpenPlaylist={(uri) => History.push(`/playlist/${uri.split(":")[2]}`)}
        runScan={runScan}
        describeError={friendlyError}
        onCancel={goHome}
        onScanningChange={setScanning}
      />
    );
  } else if (view.kind === "merge") {
    body = (
      <MergeFlow
        key={view.id}
        loadSources={getSources}
        loadTracks={getSourceTracks}
        merge={mergePlaylists}
        describeError={friendlyError}
        onCancel={goHome}
        // Just navigation, like clicking the playlist in the sidebar.
        onOpenPlaylist={(uri) => History.push(`/playlist/${uri.split(":")[2]}`)}
      />
    );
  } else if (view.kind === "addto") {
    body = (
      <AddToRoute
        key={view.id}
        song={view.song}
        onHome={goHome}
        onOpenPlaylist={(uri) => History.push(`/playlist/${uri.split(":")[2]}`)}
      />
    );
  } else if (view.kind === "demo-stats") {
    body = <StatsScreen key={view.id} load={async () => SAMPLE_RECORD} />;
  } else {
    body = (
      <HomeScreen
        onStart={start}
        onOrganize={() => apply({ view: { kind: "organize", id: newId() } })}
        onMerge={() => apply({ view: { kind: "merge", id: newId() } })}
        onAddTo={() => apply({ view: { kind: "addto", id: newId() } })}
      />
    );
  }

  return (
    // Two boxes: the outer one fills the whole page area and centres the
    // inner one (flexbox: justify = left/right, align = up/down); the inner
    // one keeps the content at a readable width.
    // prism-cosmos: the twilight background with drifting glows and light waves (styles.ts).
    // is-wide-stats: the full stats page grows in from the right (styles.ts).
    <div
      className={`prism-cosmos${view.kind === "stats" && !settings ? " is-wide-stats" : ""}`}
      style={styles.centerer}
      data-prism="cosmos"
    >
     {/* aria-hidden: pure decoration, screen readers skip it. */}
     <div className="prism-cosmos-bg" aria-hidden="true">
      <span className="prism-blob prism-blob-1" />
      <span className="prism-blob prism-blob-2" />
      <span className="prism-blob prism-blob-3" />
      <span className="prism-wave prism-wave-1" />
      <span className="prism-wave prism-wave-2" />
      <span className="prism-wave prism-wave-3" />
      {SPARKLES.map(([left, top, size, length, delay], i) => (
        <span
          key={i}
          className="prism-star"
          style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDuration: `${length}s`, animationDelay: `${delay}s` }}
        />
      ))}
     </div>
     <div className="prism-page" style={styles.page} data-prism="page" data-prism-view={settings ? (settings.report ? "report" : "settings") : view.kind}>
      {/* No header on the full stats page (it has its own title and the
          "Show in the side panel" button); every other screen keeps it. */}
      {(view.kind !== "stats" || settings) && (
        <header className="prism-header" style={styles.header}>
          <div style={styles.brand}>
            <PrismIcon size={34} />
            <h1 className="prism-title" style={styles.title}>Prism</h1>
          </div>
          <div style={styles.headerButtons}>
            {settings ? (
              // Back closes settings and shows the screen you were on
              // (from a report form: back to Settings).
              <ButtonSecondary
                buttonSize="sm"
                onClick={() => setSettings(settings.report ? { ...settings, report: undefined } : null)}
                data-prism="nav-back"
              >
                Back
              </ButtonSecondary>
            ) : (
              <>
                {view.kind !== "home" && (
                  <ButtonSecondary buttonSize="sm" onClick={startPageClicked} data-prism="nav-home">
                    Home
                  </ButtonSecondary>
                )}
                <ButtonSecondary buttonSize="sm" onClick={() => setSettings({})} data-prism="nav-settings">
                  Settings
                </ButtonSecondary>
              </>
            )}
          </div>
        </header>
      )}
      {/* The content area has a fixed minimum height, so the header stays in
          the same spot whichever screen is showing (the whole block is
          centred, so a shorter screen used to move the header down). */}
      <div style={styles.content}>
        {confirmLeave && !settings && (
          <div className="prism-notice" role="alert" style={styles.confirm} data-prism="leave-confirm">
            <span>Going to the start page stops this scan. Songs already scanned are remembered.</span>
            <div style={styles.confirmButtons}>
              <ButtonSecondary buttonSize="sm" onClick={() => setConfirmLeave(false)} data-prism="keep-scanning">
                Keep scanning
              </ButtonSecondary>
              <ButtonSecondary buttonSize="sm" onClick={goHome} data-prism="leave-scan">
                Stop and leave
              </ButtonSecondary>
            </div>
          </div>
        )}
        {settings && settings.report && (
          <ReportScreen
            key={settings.report}
            kind={settings.report}
            screen={view.kind}
            onClose={() => setSettings({ ...settings, report: undefined })}
          />
        )}
        {settings && !settings.report && (
          <SettingsPanel
            notice={settings.notice}
            onSaved={() => {
              if (settings.thenStart) start(settings.thenStart);
            }}
            onReport={(kind) => setSettings({ ...settings, report: kind })}
          />
        )}
        {/* Hidden (not removed) while settings are open, so it keeps its state. */}
        <div style={settings ? { display: "none" } : undefined}>{body}</div>
      </div>
     </div>
    </div>
  );
}

// ----- Start screen -----

function HomeScreen({ onStart, onOrganize, onMerge, onAddTo }: { onStart: (seed: string) => void; onOrganize: () => void; onMerge: () => void; onAddTo: () => void }) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [link, setLink] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const playing = usePlayingSong();

  function startFromLink() {
    const uri = parseTrackLink(link);
    if (!uri) {
      setLinkError("That isn't a Spotify song link. In Spotify: song's ... menu > Share > Copy Song Link.");
      return;
    }
    onStart(uri);
  }

  return (
    <div className="prism-fade-in" style={styles.column} data-prism-state="home">
      {/* Only shows when GitHub has a newer Prism release (UpdateNotice.tsx). */}
      <UpdateNotice />
      {/* Two modes side by side, as flip tiles: an icon on the front, the
          details and buttons on the back (FlipTile.tsx). */}
      <div style={styles.modes}>
        <FlipTile id="mode-prism" icon={<PrismTileIcon />} label="Grow a playlist" tip="Turn one favourite song into a whole playlist">
          <h3 className="prism-screen-title">Make a Prism playlist</h3>
          <p style={styles.subtext}>Start with a favourite song and grow a playlist of songs that feel like it.</p>

          <div style={styles.option}>
            <span style={styles.optionLabel}>The song playing now</span>
            {playing ? (
              <div style={styles.row}>
                <span style={styles.text} data-prism="playing-song">
                  {playing.name} · {playing.artists}
                </span>
                {/* nowrap + no shrinking: the button keeps its pill shape and the song name wraps instead. */}
                <span style={styles.keepWhole}>
                  <ButtonPrimary buttonSize="sm" onClick={() => onStart(playing.uri)} data-prism="start-playing">
                    Use this song
                  </ButtonPrimary>
                </span>
              </div>
            ) : (
              <p style={styles.subtext}>Nothing is playing (or it isn't a song).</p>
            )}
          </div>

          <div style={styles.option}>
            <span style={styles.optionLabel}>Or paste a song link</span>
            <div style={styles.row}>
              <input
                value={link}
                placeholder="https://open.spotify.com/track/..."
                onChange={(event) => {
                  setLink(event.target.value);
                  setLinkError(null);
                }}
                onKeyDown={(event) => event.key === "Enter" && startFromLink()}
                className="prism-glass-input"
                style={styles.input}
                data-prism="link-input"
                aria-label="Spotify song link"
              />
              <ButtonSecondary buttonSize="sm" onClick={startFromLink} disabled={!link.trim()}>
                Start
              </ButtonSecondary>
            </div>
            {linkError && (
              <p role="alert" style={styles.error}>
                {linkError}
              </p>
            )}
          </div>

          <p style={styles.hint}>Tip: right-click any song in Spotify and choose "Start a Prism playlist".</p>
        </FlipTile>

        <FlipTile id="mode-organize" icon={<OrganizeIcon />} label="Remix into moods" tip="Split playlists by genre and mood">
          <h3 className="prism-screen-title">Organize playlists</h3>
          <p style={styles.subtext}>
            Shuffle your playlists into fresh ones sorted by genre and mood. Make several, or just the one you want.
          </p>
          <ul style={styles.points}>
            <li>Prism suggests the groups; you can rename, move songs or start from scratch</li>
            <li>Choose how many new playlists, and whether a song can be in more than one</li>
            <li>Songs without genre tags still find their closest group</li>
          </ul>
          <div style={{ flex: 1 }} />
          <div>
            <ButtonPrimary buttonSize="sm" onClick={onOrganize} data-prism="start-organize">
              Organize playlists
            </ButtonPrimary>
          </div>
        </FlipTile>
      </div>

      {/* Merge: a wide glass bar under the tiles (mockup "B"), opens straight away. */}
      <StartBar
        id="start-merge"
        icon={<MergeIcon />}
        label="Merge playlists"
        text="Stack your playlists together and drop the doubles"
        onClick={onMerge}
        labelStyle={styles.barLabel}
        textStyle={styles.barText}
      />

      {/* Add with Prism: the same start bar, for one song. */}
      <StartBar
        id="start-addto"
        icon={<AddSongIcon />}
        label="Add a song to your playlists"
        text="Let Prism find the best home for a song"
        onClick={onAddTo}
        labelStyle={styles.barLabel}
        textStyle={styles.barText}
      />
    </div>
  );
}

// The Add with Prism screen, with the playing song and the real lookups.
function AddToRoute({ song, onHome, onOpenPlaylist }: { song?: string; onHome: () => void; onOpenPlaylist: (uri: string) => void }) {
  const playing = usePlayingSong();
  return (
    <AddToScreen
      song={song}
      playing={playing}
      find={findPlaylistsForSong}
      add={addSongTo}
      describeError={friendlyError}
      onOpenPlaylist={onOpenPlaylist}
      onHome={onHome}
    />
  );
}

// The song playing right now (or null), kept up to date: a "custom hook",
// i.e. a function that bundles React state + an effect so components can reuse it.
function usePlayingSong(): { uri: string; name: string; artists: string } | null {
  const read = () => {
    const item: any = Spicetify.Player?.data?.item;
    if (!item?.uri || !Spicetify.URI.isTrack(item.uri)) return null;
    const artists = (item.artists ?? []).map((a: any) => a.name).join(", ");
    return { uri: item.uri as string, name: (item.name ?? "") as string, artists };
  };
  const [song, setSong] = React.useState(read);
  React.useEffect(() => {
    const update = () => setSong(read());
    Spicetify.Player.addEventListener("songchange", update);
    return () => Spicetify.Player.removeEventListener("songchange", update);
  }, []);
  return song;
}

// Spotify's theme colours (CSS variables), so the page follows the user's theme.
// The twilight background and the see-through card colour are in styles.ts.
const styles: Record<string, React.CSSProperties> = {
  centerer: { minHeight: "100%", display: "flex", justifyContent: "center", alignItems: "center", boxSizing: "border-box" },
  page: { width: "100%", maxWidth: 760, boxSizing: "border-box", padding: "32px", display: "flex", flexDirection: "column", gap: 24, color: "var(--spice-text)" },
  // flexWrap: in a narrow window the buttons move under the title instead of
  // squashing it; whiteSpace nowrap keeps "Prism" and button labels on one line.
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 },
  // SCREEN_HEIGHT = the height of the tallest screens (picker, scan, preview).
  // SCREEN_HEIGHT + room for Organize's title (46px) and the start page's two
  // mode cards when they're stacked in a narrow window (633px measured), so
  // the header sits in the same place on every screen of both modes.
  content: { minHeight: SCREEN_HEIGHT + 80, position: "relative" },
  // The leave warning floats over the top of the screen, so the screen
  // underneath (and its progress bar) doesn't move.
  confirm: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", background: "rgba(40, 20, 70, 0.92)" },
  confirmButtons: { display: "flex", gap: 8, flexShrink: 0 },
  brand: { display: "flex", alignItems: "center", gap: 12, color: "#f3e8ff" },
  // "Segoe UI Variable Display" is built into Windows 11 (no download); thin
  // weight + a little letter spacing gives the light, airy look.
  title: { margin: 0, fontFamily: '"Segoe UI Variable Display", "Segoe UI", sans-serif', fontSize: 32, fontWeight: 300, letterSpacing: "0.04em", lineHeight: 1.2, whiteSpace: "nowrap" },
  headerButtons: { display: "flex", gap: 8, whiteSpace: "nowrap", flexShrink: 0 },
  column: { display: "flex", flexDirection: "column", gap: 16 },
  // The two mode tiles: side by side, wrapping to stacked in a narrow window.
  modes: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, alignItems: "stretch" },
  option: { display: "flex", flexDirection: "column", gap: 6 },
  optionLabel: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600 },
  hint: { margin: 0, color: "var(--spice-subtext)", fontSize: 12 },
  barLabel: { fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" },
  barText: { color: "var(--spice-subtext)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  points: { margin: 0, paddingLeft: 18, color: "var(--spice-subtext)", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  text: { color: "var(--spice-text)" },
  keepWhole: { flexShrink: 0, whiteSpace: "nowrap" },
  subtext: { color: "var(--spice-subtext)", margin: 0 },
  input: { flex: 1, width: "auto", minWidth: 0, fontSize: 13, padding: "7px 12px" },
  // Soft pink instead of Spotify's red, which clashes with the purple theme.
  error: { margin: 0, color: "#ffb3d1" },
};
