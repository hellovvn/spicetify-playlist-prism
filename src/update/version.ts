// "New version" notice on the start page (developer's pick "A", 2026-11-26).
// Pure parts: reading GitHub's answer, comparing versions, deciding whether to
// show the notice. The fetch itself is in check.ts.

/** What we remember about the latest release (saved as prism:updateCheck). */
export type LatestRelease = { version: string; url: string };
export type SavedCheck = { checkedAt: number; latest: LatestRelease | null };

/** Check GitHub at most once a day. */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

/** "v0.2.0" / "0.2.0" / "Prism 0.2.0" -> [0, 2, 0]; null when there's no x.y.z. */
export function parseVersion(text: string): number[] | null {
  const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(text ?? "");
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

/** True when `latest` is a higher version than `current` (unreadable = false). */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/** GitHub's /releases/latest answer -> the version and its page, or null. */
export function readRelease(data: unknown): LatestRelease | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown };
  if (d.draft || d.prerelease) return null;
  if (typeof d.tag_name !== "string" || typeof d.html_url !== "string") return null;
  const v = parseVersion(d.tag_name);
  // Only links to the repo's own GitHub pages.
  if (!v || !d.html_url.startsWith("https://github.com/")) return null;
  return { version: v.join("."), url: d.html_url };
}

/** The saved check (JSON text) or null when missing / unreadable. */
export function parseSavedCheck(text: string | null): SavedCheck | null {
  if (!text) return null;
  try {
    const d = JSON.parse(text);
    if (typeof d?.checkedAt !== "number") return null;
    const latest = d.latest && typeof d.latest.version === "string" && typeof d.latest.url === "string" ? d.latest : null;
    return { checkedAt: d.checkedAt, latest };
  } catch {
    return null;
  }
}

/** Time to ask GitHub again? */
export function needsCheck(saved: SavedCheck | null, now: number): boolean {
  return !saved || now - saved.checkedAt >= CHECK_EVERY_MS || saved.checkedAt > now;
}

/** The release to tell the user about, or null. "Not now" hides one version
 *  until Spotify restarts (sessionStorage); a later version shows the notice again. */
export function noticeFor(latest: LatestRelease | null, current: string, dismissed: string | null): LatestRelease | null {
  if (!latest || !isNewer(latest.version, current)) return null;
  if (dismissed && !isNewer(latest.version, dismissed)) return null;
  return latest;
}

/** "How to update" in the notice (option "B", 2026-11-26). Windows users get the
 *  install line (re-running it updates); macOS/Linux the README's install steps. */
export const UPDATE_COMMAND =
  "iwr -useb https://raw.githubusercontent.com/hellovvn/spicetify-prism/main/install.ps1 | iex";
export const INSTALL_GUIDE_URL = "https://github.com/hellovvn/spicetify-prism#install";

/** Show the PowerShell line? Only on Windows (unknown = show it, with the guide link). */
export function showsUpdateCommand(os: string | undefined): boolean {
  return os !== "macOS" && os !== "Linux";
}
