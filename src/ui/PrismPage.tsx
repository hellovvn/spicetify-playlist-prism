// The Playlist Prism PAGE (step 12a): everything Prism shows lives here.
//
// It shows one of:
//   home       start screen: use the playing song, or paste a song link
//   prism      the flow (tags -> sources -> scan -> preview) for one seed song
//   stats      how a Prism playlist was made (right-click it > "Prism stats")
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
import { getSources } from "../spotify/read";
import { getLastfmKey } from "../storage";
import { SAMPLE_RECORD } from "../stats/playlistStats";
import { StatsScreen } from "./StatsScreen";
import { createFromPreview, friendlyError, loadPlaylistStats, loadSeed, runScan } from "../flow";
import { PAGE_PATH, parsePageRequest, parseTrackLink, type PageRequest } from "../nav";
import { SeedPanel } from "./SeedPanel";
import { SettingsPanel } from "./SettingsPanel";
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
  | { kind: "demo-scan"; id: string }
  | { kind: "demo-stats"; id: string };

// Settings, when open. thenStart: seed to continue with after saving the key.
type SettingsState = { notice?: string; thenStart?: string };

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
      />
    );
  } else if (view.kind === "demo-stats") {
    body = <StatsScreen key={view.id} load={async () => SAMPLE_RECORD} />;
  } else {
    body = <HomeScreen onStart={start} />;
  }

  return (
    // Two boxes: the outer one fills the whole page area and centres the
    // inner one (flexbox: justify = left/right, align = up/down); the inner
    // one keeps the content at a readable width.
    // prism-cosmos: the twilight background with drifting glows and light waves (styles.ts).
    <div className="prism-cosmos" style={styles.centerer} data-prism="cosmos">
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
     <div className="prism-page" style={styles.page} data-prism="page" data-prism-view={settings ? "settings" : view.kind}>
      <header className="prism-header" style={styles.header}>
        <div style={styles.brand}>
          <PrismIcon size={34} />
          <h1 className="prism-title" style={styles.title}>Playlist Prism</h1>
        </div>
        <div style={styles.headerButtons}>
          {settings ? (
            // Back closes settings and shows the screen you were on.
            <ButtonSecondary buttonSize="sm" onClick={() => setSettings(null)} data-prism="nav-back">
              Back
            </ButtonSecondary>
          ) : (
            <>
              {view.kind !== "home" && (
                <ButtonSecondary buttonSize="sm" onClick={startPageClicked} data-prism="nav-home">
                  Start page
                </ButtonSecondary>
              )}
              <ButtonSecondary buttonSize="sm" onClick={() => setSettings({})} data-prism="nav-settings">
                Settings
              </ButtonSecondary>
            </>
          )}
        </div>
      </header>
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
        {settings && (
          <SettingsPanel
            notice={settings.notice}
            onSaved={() => {
              if (settings.thenStart) start(settings.thenStart);
            }}
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

function HomeScreen({ onStart }: { onStart: (seed: string) => void }) {
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
      <div>
        <h2 style={styles.heading}>Start a Prism playlist</h2>
        <p style={styles.subtext}>
          Pick a seed song. Prism finds songs with the same vibe in the playlists you choose, and makes a new
          playlist from them. Your existing playlists are never changed.
        </p>
      </div>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>From anywhere in Spotify</h3>
        <p style={styles.subtext}>Right-click any song and choose "Start a Prism playlist".</p>
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>The song playing now</h3>
        {playing ? (
          <div style={styles.row}>
            <span style={styles.text} data-prism="playing-song">
              {playing.name} · {playing.artists}
            </span>
            <ButtonPrimary buttonSize="sm" onClick={() => onStart(playing.uri)} data-prism="start-playing">
              Use this song
            </ButtonPrimary>
          </div>
        ) : (
          <p style={styles.subtext}>Nothing is playing (or it isn't a song).</p>
        )}
      </section>

      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Paste a song link</h3>
        <div style={styles.row}>
          <input
            value={link}
            placeholder="https://open.spotify.com/track/..."
            onChange={(event) => {
              setLink(event.target.value);
              setLinkError(null);
            }}
            onKeyDown={(event) => event.key === "Enter" && startFromLink()}
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
      </section>
    </div>
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
  // squashing it; whiteSpace nowrap keeps "Playlist Prism" and button labels on one line.
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 },
  // SCREEN_HEIGHT = the height of the tallest screens (picker, scan, preview).
  content: { minHeight: SCREEN_HEIGHT, position: "relative" },
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
  heading: { margin: "0 0 6px", fontSize: 22, fontWeight: 700 },
  card: { background: "var(--spice-card)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8 },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  text: { color: "var(--spice-text)" },
  subtext: { color: "var(--spice-subtext)", margin: 0 },
  input: { flex: 1, padding: 8, borderRadius: 4, border: "1px solid var(--spice-subtext)", background: "transparent", color: "var(--spice-text)" },
  // Soft pink instead of Spotify's red, which clashes with the purple theme.
  error: { margin: 0, color: "#ffb3d1" },
};
