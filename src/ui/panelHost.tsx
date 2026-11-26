// Puts the Prism stats panel (src/ui/PanelStats.tsx) on screen, over
// Spotify's right-hand Now Playing panel. Run once by the always-on script
// (src/extensions/prism.tsx).
//
// It shows only while ALL of these are true:
//   - the Settings switch "Prism stats in the side panel" is on (default),
//   - the open page is a playlist (ANY playlist since 2026-11-25: a saved
//     record for Prism-made ones, an estimate + background scan for the rest),
//   - Spotify's right panel is open and showing Now Playing (not the queue or
//     friend activity, which stay untouched),
//   - the panel's tabs are on "Prism stats". On "Now playing" (one choice for
//     every playlist, see PANEL_VIEW_ATTR) Spotify's own panel shows, with
//     the same tabs in a slim strip above it, so the user can switch back.
// Otherwise it takes itself off the page and Spotify's panel is as normal.
//
// How: our own <div> ("host") is placed inside Spotify's right panel element
// and covers it (position: absolute; inset: 0). React draws PanelStats into
// it with createRoot. Spotify sometimes rebuilds its panel (for example when
// you close and reopen it), so update() also runs every 1.5 s to put the
// host back if needed. Read-only: nothing here changes Spotify's data.

import React from "react";
import { parseRecords, RECORDS_CHANGED_EVENT } from "../stats/playlistStats";
import { loadPanelStatsSetting, loadPlaylistRecordsText } from "../storage";
import { openPage } from "../nav";
import { loadPanelEstimate, loadPlaylistExtras, loadToneFit, type PanelStatsState } from "../flow";
import { PanelStats, type NowPlaying } from "./PanelStats";
import { PanelTabs } from "./PanelTabs";
import { imageUrl, isPanelStatsOn, PANEL_STATS_CHANGED_EVENT, PANEL_VIEW_ATTR, readPanelView, type PanelView } from "./sidePanel";
import { playlistUriFromPath } from "./toneView";

const HOST_ID = "prism-panel-stats";
const TABS_STRIP_ID = "prism-panel-tabs";
const STRIP_STYLE_ID = "prism-panel-tabs-style";
// The tabs pill (30px) is centred in the strip, so the gap above and below it
// is the same (16px).
const STRIP_HEIGHT = 62; // px
// While the strip is up, Spotify's Now Playing view moves down by the strip's
// height. Done on the view's outer box, because Spotify has two layouts (the
// older one with its header in the flow, the video one with an overlaid header).
const STRIP_CSS = `
.Root__right-sidebar[data-prism-tabs-strip] .main-nowPlayingView-container {
  margin-top: ${STRIP_HEIGHT}px;
  height: calc(100% - ${STRIP_HEIGHT}px) !important;
}`;
export const PANEL_WIDTH_VAR = "--prism-side-panel-width";

function nowPlaying(): NowPlaying | null {
  const item: any = Spicetify.Player?.data?.item;
  if (!item?.name) return null;
  const image = item.images?.[0]?.url ?? item.metadata?.image_url;
  return {
    name: String(item.name),
    artists: (item.artists ?? []).map((a: any) => a.name).join(", "),
    image: imageUrl(image),
  };
}

// The estimate being worked out for one playlist (loadPanelEstimate).
interface EstimateJob {
  uri: string;
  stopped: boolean;
  state: PanelStatsState | null; // null = still reading the playlist
  failed: boolean;
}

export function startPanelStats(): void {
  const host = document.createElement("div");
  host.id = HOST_ID;
  // A solid twilight background from the first frame: the panel's content
  // fades and slides in on top of it, so Spotify's own panel never shows
  // through during that animation.
  host.style.cssText = "position:absolute;inset:0;z-index:3;border-radius:8px;background:linear-gradient(170deg,#21143d,#33195a 55%,#4d2270);";
  const root = (Spicetify.ReactDOM as any).createRoot(host);

  // The tabs strip over Spotify's own panel ("Now playing" picked).
  const strip = document.createElement("div");
  strip.id = TABS_STRIP_ID;
  strip.style.cssText = `position:absolute;top:0;left:0;right:0;height:${STRIP_HEIGHT}px;z-index:3;box-sizing:border-box;padding:0 16px;display:flex;justify-content:center;align-items:center;`;
  const stripRoot = (Spicetify.ReactDOM as any).createRoot(strip);

  const view = (): PanelView => readPanelView(document.documentElement);
  const pick = (next: PanelView) => {
    document.documentElement.setAttribute(PANEL_VIEW_ATTR, next);
    update();
  };
  const tabs = (current: PanelView) => <PanelTabs view={current} onPick={pick} />;

  // Should the panel show right now? Cheap: no drawing.
  const decide = () => {
    const sidebar = document.querySelector(".Root__right-sidebar");
    // Spotify draws the Queue inside the SAME .main-nowPlayingView-container
    // (checked 2026-11-25); only the Queue has a tab list ("Queue" /
    // "Recently played"), so that tells them apart.
    const container = sidebar?.querySelector(".main-nowPlayingView-container");
    const showingNowPlaying = !!container && !container.querySelector('[role="tablist"]');
    const uri = playlistUriFromPath(Spicetify.Platform.History.location.pathname);
    if (!isPanelStatsOn(loadPanelStatsSetting()) || !uri || !sidebar || !showingNowPlaying) return null;
    return { sidebar, uri, saved: parseRecords(loadPlaylistRecordsText())[uri] ?? null };
  };
  let shownUri: string | null = null; // whose stats are drawn in the host now

  // A playlist without a saved record: its estimate, worked out (and its
  // missing songs scanned) while it's on screen. Stopped as soon as it isn't.
  let job: EstimateJob | null = null;
  const stopJob = () => {
    if (job) job.stopped = true;
    job = null;
  };
  const ensureJob = (uri: string) => {
    if (job?.uri === uri) return job;
    stopJob();
    const started: EstimateJob = { uri, stopped: false, state: null, failed: false };
    job = started;
    loadPanelEstimate(
      uri,
      (state) => {
        if (started.stopped) return;
        started.state = state;
        update();
      },
      () => started.stopped
    ).catch((error) => {
      if (started.stopped) return;
      console.warn("[Prism] side panel: couldn't work out the stats", error);
      started.failed = true;
      update();
    });
    return started;
  };

  // "Now playing" picked: the tabs go in a strip across the top of Spotify's
  // right panel, and Spotify's own view moves down by its height (STRIP_CSS).
  const showStrip = (sidebar: Element) => {
    if (!document.getElementById(STRIP_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STRIP_STYLE_ID;
      style.textContent = STRIP_CSS;
      document.head.appendChild(style);
    }
    if (strip.parentElement !== sidebar) sidebar.appendChild(strip);
    sidebar.setAttribute("data-prism-tabs-strip", "");
    stripRoot.render(tabs("spotify"));
  };
  const hideStrip = () => {
    strip.remove();
    document.querySelectorAll("[data-prism-tabs-strip]").forEach((el) => el.removeAttribute("data-prism-tabs-strip"));
  };

  const update = () => {
    const show = decide();
    if (!show || view() === "spotify") {
      host.remove();
      shownUri = null;
      stopJob();
      if (show) showStrip(show.sidebar);
      else hideStrip();
      return;
    }
    hideStrip();
    if (host.parentElement !== show.sidebar) show.sidebar.appendChild(host);
    rememberWidth(show.sidebar);
    shownUri = show.uri;
    const openStats = () => openPage({ go: "stats", playlist: show.uri });
    if (show.saved) {
      stopJob();
      root.render(
        <PanelStats record={show.saved} nowPlaying={nowPlaying()} onOpenStats={openStats} loadExtras={loadPlaylistExtras} loadToneFit={loadToneFit} tabs={tabs("prism")} />
      );
      return;
    }
    const current = ensureJob(show.uri);
    if (current.state && current.state.record.songCount === 0) {
      root.render(<PanelWaiting tabs={tabs("prism")} message="No songs here to make stats from (only podcasts, audiobooks or local files)." />);
    } else if (current.state) {
      root.render(
        <PanelStats
          record={current.state.record}
          scanning={current.state.scanning}
          nowPlaying={nowPlaying()}
          onOpenStats={openStats}
          loadExtras={loadPlaylistExtras}
          loadToneFit={loadToneFit}
          tabs={tabs("prism")}
        />
      );
    } else {
      root.render(
        <PanelWaiting
          tabs={tabs("prism")}
          message={current.failed ? "Couldn't read this playlist's songs." : "Working out this playlist's stats…"}
          isError={current.failed}
        />
      );
    }
  };

  // After a page change: put the (empty, twilight) host in place STRAIGHT
  // AWAY, so Spotify's own panel never flashes up, but draw the stats only
  // once the browser is idle (Spotify has drawn its new page), so the two
  // don't compete and stutter; the stats then slide in. (At most 400 ms later.)
  const updateWhenIdle = () => {
    const idle = (window as any).requestIdleCallback as ((run: () => void, options: { timeout: number }) => number) | undefined;
    if (idle) idle(update, { timeout: 400 });
    else window.setTimeout(update, 120);
  };
  // Remember the panel's width (as a CSS variable on the page), so the full
  // stats page can morph to exactly this size later: while that page is
  // open, Spotify's layout shrinks the right-hand column to 0px.
  const rememberWidth = (sidebar: Element) => {
    const width = Math.round(sidebar.getBoundingClientRect().width);
    if (width > 0) document.documentElement.style.setProperty(PANEL_WIDTH_VAR, `${width}px`);
  };

  const onPageChange = () => {
    const show = decide();
    if (!show || view() === "spotify") {
      update();
      return;
    }
    hideStrip();
    if (host.parentElement !== show.sidebar) show.sidebar.appendChild(host);
    if (shownUri !== show.uri) {
      stopJob(); // the last playlist's scan stops here
      root.render(null); // empty until the idle draw below (never another playlist's stats)
      shownUri = null;
    }
    updateWhenIdle();
  };

  update();
  Spicetify.Platform.History.listen(() => onPageChange()); // another page opened
  Spicetify.Player.addEventListener("songchange", () => update()); // new song in the strip
  window.addEventListener(RECORDS_CHANGED_EVENT, () => update()); // a new Prism playlist was saved
  window.addEventListener(PANEL_STATS_CHANGED_EVENT, () => update()); // Settings switch
  window.setInterval(update, 1500); // the panel was opened, closed or rebuilt
}

// No stats to show (yet): the tabs and one quiet line, on the twilight
// background. While a playlist is still being read, if that failed, or if it
// has no songs at all.
function PanelWaiting({ tabs, message, isError = false }: { tabs: React.ReactNode; message: string; isError?: boolean }) {
  return (
    <div className="prism-cosmos" style={{ position: "absolute", inset: 0, borderRadius: 8, color: "#ffffff" }} data-prism="panel-waiting">
      <div style={{ position: "relative", zIndex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {tabs}
        <p style={{ margin: 0, fontSize: 12, color: isError ? "#ffb3d1" : "#cdb8ff" }}>{message}</p>
      </div>
    </div>
  );
}
