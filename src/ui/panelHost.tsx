// Puts the Prism stats panel (src/ui/PanelStats.tsx) on screen, over
// Spotify's right-hand Now Playing panel. Run once by the always-on script
// (src/extensions/prism.tsx).
//
// It shows only while ALL of these are true:
//   - the Settings switch "Prism stats in the side panel" is on (default),
//   - the open page is a playlist Prism made or organized (has a saved record),
//   - Spotify's right panel is open and showing Now Playing (not the queue or
//     friend activity, which stay untouched).
// Otherwise it takes itself off the page and Spotify's panel is as normal.
//
// How: our own <div> ("host") is placed inside Spotify's right panel element
// and covers it (position: absolute; inset: 0). React draws PanelStats into
// it with createRoot. Spotify sometimes rebuilds its panel (for example when
// you close and reopen it), so update() also runs every 1.5 s to put the
// host back if needed. Read-only: nothing here changes Spotify's data.

import React from "react";
import { parseRecords } from "../stats/playlistStats";
import { loadPanelStatsSetting, loadPlaylistRecordsText } from "../storage";
import { openPage } from "../nav";
import { loadPlaylistExtras } from "../flow";
import { RECORDS_CHANGED_EVENT } from "./prismRows";
import { PanelStats, type NowPlaying } from "./PanelStats";
import { imageUrl, isPanelStatsOn, panelRecordFor, PANEL_STATS_CHANGED_EVENT } from "./sidePanel";

const HOST_ID = "playlist-prism-panel-stats";
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

export function startPanelStats(): void {
  const host = document.createElement("div");
  host.id = HOST_ID;
  // A solid twilight background from the first frame: the panel's content
  // fades and slides in on top of it, so Spotify's own panel never shows
  // through during that animation.
  host.style.cssText = "position:absolute;inset:0;z-index:3;border-radius:8px;background:linear-gradient(170deg,#21143d,#33195a 55%,#4d2270);";
  const root = (Spicetify.ReactDOM as any).createRoot(host);

  // Should the panel show right now? (setting on, a Prism playlist open,
  // Spotify's panel open on Now Playing). Cheap: no drawing.
  const decide = () => {
    const sidebar = document.querySelector(".Root__right-sidebar");
    const showingNowPlaying = !!sidebar?.querySelector(".main-nowPlayingView-container");
    const record = panelRecordFor(Spicetify.Platform.History.location.pathname, parseRecords(loadPlaylistRecordsText()));
    if (!isPanelStatsOn(loadPanelStatsSetting()) || !record || !sidebar || !showingNowPlaying) return null;
    return { sidebar, record };
  };
  let shownUri: string | null = null; // whose stats are drawn in the host now

  const update = () => {
    const show = decide();
    if (!show) {
      host.remove();
      shownUri = null;
      return;
    }
    if (host.parentElement !== show.sidebar) show.sidebar.appendChild(host);
    rememberWidth(show.sidebar);
    shownUri = show.record.uri;
    root.render(
      <PanelStats
        record={show.record}
        nowPlaying={nowPlaying()}
        onOpenStats={() => openPage({ go: "stats", playlist: show.record.uri })}
        loadExtras={loadPlaylistExtras}
      />
    );
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
    if (!show) {
      host.remove();
      shownUri = null;
      return;
    }
    if (host.parentElement !== show.sidebar) show.sidebar.appendChild(host);
    if (shownUri !== show.record.uri) {
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
