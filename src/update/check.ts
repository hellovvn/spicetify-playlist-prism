// Asks GitHub for Prism's latest release (public, no sign-in, nothing about the
// user is sent), at most once a day. The answer is kept in prism:updateCheck.

import { version as PRISM_VERSION } from "../../package.json";
import { LOG_PREFIX } from "../log";
import { type LatestRelease, needsCheck, noticeFor, parseSavedCheck, readRelease } from "./version";

const RELEASE_URL = "https://api.github.com/repos/hellovvn/spicetify-prism/releases/latest";
const CHECK_KEY = "prism:updateCheck";
// "Not now" lasts until Spotify restarts (developer's request, 2026-11-26), so it
// lives in sessionStorage.
const DISMISSED_KEY = "prism:updateDismissed";

export { PRISM_VERSION };

/** The release to show in the notice, or null (no newer one, hidden, or offline). */
export async function findUpdate(now = Date.now()): Promise<LatestRelease | null> {
  let saved = parseSavedCheck(Spicetify.LocalStorage.get(CHECK_KEY));
  if (needsCheck(saved, now)) {
    try {
      const res = await fetch(RELEASE_URL, { headers: { Accept: "application/vnd.github+json" } });
      // 404 = no release published yet: remember "none" for a day too.
      if (res.ok || res.status === 404) {
        const latest = res.ok ? readRelease(await res.json()) : null;
        saved = { checkedAt: now, latest };
        Spicetify.LocalStorage.set(CHECK_KEY, JSON.stringify(saved));
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} couldn't check for a new version`, error);
    }
  }
  return noticeFor(saved?.latest ?? null, PRISM_VERSION, sessionStorage.getItem(DISMISSED_KEY));
}

/** "Not now": hide the notice until Spotify restarts (or a later version is out). */
export function dismissUpdate(version: string): void {
  sessionStorage.setItem(DISMISSED_KEY, version);
}
