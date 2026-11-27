// Anonymous usage counts: which Prism features people use (relay/src/features.ts says
// exactly what is sent and how it is stored). On by default, Settings > Feedback turns it off.
// countFeature() (src/usage/countFeature.ts) adds to the counts from either bundle.
// Only the always-on script sends (startUsageSharing): once per UTC day, at Spotify start
// and then checked every hour, so counts reach the relay the day after they happen.
// Switched off = nothing is counted, the waiting counts are deleted and nothing is sent.

import { version as PRISM_VERSION } from "../../package.json";
import type { FeatureReport, Setting } from "../../relay/src/features";
import { REPORT_RELAY_URL } from "../report/send";
import { LOG_PREFIX } from "../log";
import {
  getOwnLastfmKey,
  loadLyricsThemeSetting,
  loadPanelStatsSetting,
  loadPlaylistThemeOverrides,
  loadPlaylistThemeSetting,
  loadTonesText,
  loadUsageCountsText,
  saveUsageCountsText,
} from "../storage";
import { isLyricsThemeOn } from "../ui/lyricsTheme";
import { isPanelStatsOn } from "../ui/sidePanel";
import { parsePlaylistTheme, parseThemeOverrides } from "../theme/playlistTheme";
import { parseTones } from "../tone/tone";
import { afterSend, parsePending, shouldSend } from "./featureCounts";
import { isUsageSharingEnabled } from "./countFeature";

const CHECK_EVERY_MS = 60 * 60_000;

function settingsSnapshot(): { settings: Setting[]; theme: string } {
  const settings: Setting[] = [];
  if (isLyricsThemeOn(loadLyricsThemeSetting())) settings.push("lyrics_look");
  if (isPanelStatsOn(loadPanelStatsSetting())) settings.push("side_panel");
  if (getOwnLastfmKey()) settings.push("own_lastfm_key");
  if (Object.keys(parseTones(loadTonesText())).length > 0) settings.push("uses_tones");
  if (Object.keys(parseThemeOverrides(loadPlaylistThemeOverrides())).length > 0) settings.push("uses_playlist_themes");
  return { settings, theme: parsePlaylistTheme(loadPlaylistThemeSetting()) };
}

let sending = false;

async function sendIfDue(): Promise<void> {
  if (sending || !REPORT_RELAY_URL || !isUsageSharingEnabled()) return;
  const today = new Date().toISOString().slice(0, 10);
  const pending = parsePending(loadUsageCountsText());
  if (!shouldSend(pending, today)) return;
  sending = true;
  try {
    const report: FeatureReport = { counts: pending.counts, ...settingsSnapshot(), version: PRISM_VERSION };
    const res = await fetch(`${REPORT_RELAY_URL}/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    // Switched off while sending: drop everything, don't save a new state.
    if (!isUsageSharingEnabled()) return;
    if (res.ok) {
      saveUsageCountsText(JSON.stringify(afterSend(parsePending(loadUsageCountsText()), report.counts, today)));
    }
  } catch {
    // Offline or relay down: try again at the next check.
  } finally {
    sending = false;
  }
}

/** Always-on script: send once now (if due) and check again every hour. */
export function startUsageSharing(): void {
  const check = () =>
    void sendIfDue().catch((error) => console.warn(`${LOG_PREFIX} usage counts not sent`, error));
  setTimeout(check, 20_000); // after Spotify has settled
  setInterval(check, CHECK_EVERY_MS);
}
