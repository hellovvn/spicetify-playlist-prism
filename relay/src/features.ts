// Anonymous feature counts ("which parts of Prism do people use").
// Prism (when Settings > Feedback > "Share anonymous usage counts" is on, the default) adds up
// how often each feature below was used, and once a day sends those totals plus a few On/Off
// settings to the relay (POST /features). The relay adds them to one record per UTC day.
// Privacy: only names from the fixed lists below and small numbers are accepted. No song,
// playlist, artist, Spotify id, Last.fm key or install id is ever sent. The sender's IP is
// only used, hashed with the day and a secret (like usage.ts), to count "people sharing today"
// once each; that hash expires after 2 days. Switched off = Prism sends nothing at all, so
// "people who switched it off" is estimated as daily users (usage.ts) minus people sharing.
// This file is shared: Prism imports the lists and checks from here too.

import { usageDay, type UsageKV } from "./usage";

/** Things a user DID (counted each time). */
export const FEATURES = [
  "grow", // a Grow playlist was created
  "grow_new_finds", // ... and it included New finds
  "remix", // a Remix playlist was created (one per playlist)
  "merge", // playlists were merged
  "add", // Add with Prism added a song
  "tone", // a playlist tone was saved
  "stats", // the full stats page was opened
  "playlist_theme", // a theme was set on one playlist (right-click > Prism theme)
  "report", // a bug report / idea was sent
] as const;
export type Feature = (typeof FEATURES)[number];

/** On/Off settings, reported once per day as "this person has it on". */
export const SETTINGS = ["lyrics_look", "side_panel", "own_lastfm_key", "uses_tones", "uses_playlist_themes"] as const;
export type Setting = (typeof SETTINGS)[number];

/** Settings > Playlist theme ids (tests check this matches src/theme/playlistTheme.ts). */
export const THEMES = ["none", "twilight", "aurora", "stars", "milkyway", "nebula", "afterglow", "mist", "blossom", "rain"] as const;

/** What Prism sends once a day. */
export interface FeatureReport {
  counts: Partial<Record<Feature, number>>;
  settings: Setting[]; // the ones that are on
  theme: string; // one of THEMES
  version: string; // Prism's version, e.g. "0.1.1"
}

/** The relay's record for one day. */
export interface FeatureDay {
  sharing: number; // people who sent counts that day
  counts: Record<string, number>;
  settings: Record<string, number>; // people with it on
  themes: Record<string, number>; // people with that main theme
  versions: Record<string, number>; // people on that version
}

const MAX_COUNT = 500; // per feature per send: more than this is a bug or abuse
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** Checks and cleans what Prism sent. Unknown names are dropped, odd numbers refused. */
export function parseFeatureReport(raw: unknown): { ok: true; report: FeatureReport } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Expected an object." };
  const r = raw as Record<string, unknown>;
  const counts: Partial<Record<Feature, number>> = {};
  if (r.counts && typeof r.counts === "object") {
    for (const name of FEATURES) {
      const n = (r.counts as Record<string, unknown>)[name];
      if (n === undefined) continue;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > MAX_COUNT) {
        return { ok: false, error: `Bad count for ${name}.` };
      }
      if (n > 0) counts[name] = n;
    }
  }
  const given = Array.isArray(r.settings) ? r.settings : [];
  const settings = SETTINGS.filter((s) => given.includes(s));
  const theme = (THEMES as readonly string[]).includes(r.theme as string) ? (r.theme as string) : "none";
  const version = typeof r.version === "string" && VERSION_RE.test(r.version) ? r.version : "unknown";
  return { ok: true, report: { counts, settings, theme, version } };
}

export function emptyFeatureDay(): FeatureDay {
  return { sharing: 0, counts: {}, settings: {}, themes: {}, versions: {} };
}

function parseFeatureDay(text: string | null): FeatureDay {
  if (!text) return emptyFeatureDay();
  try {
    return { ...emptyFeatureDay(), ...(JSON.parse(text) as Partial<FeatureDay>) };
  } catch {
    return emptyFeatureDay();
  }
}

function bump(map: Record<string, number>, key: string, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

/** Adds one report to today's record. Pure. `newSender` = first report from this person today. */
export function addReport(day: FeatureDay, report: FeatureReport, newSender: boolean): FeatureDay {
  const next: FeatureDay = {
    sharing: day.sharing,
    counts: { ...day.counts },
    settings: { ...day.settings },
    themes: { ...day.themes },
    versions: { ...day.versions },
  };
  for (const [name, n] of Object.entries(report.counts)) bump(next.counts, name, n ?? 0);
  // Settings, theme and version describe a PERSON, so only their first report of the day counts.
  if (newSender) {
    next.sharing += 1;
    for (const s of report.settings) bump(next.settings, s);
    bump(next.themes, report.theme);
    bump(next.versions, report.version);
  }
  return next;
}

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

const SEEN_TTL_SECONDS = 2 * 86400;

/** Stores one report. KV is read-then-write, so totals are approximate under races. */
export async function recordFeatures(kv: UsageKV, report: FeatureReport, ip: string, now: Date, pepper: string): Promise<void> {
  const day = usageDay(now);
  const seenKey = `fseen:${day}:${await sha256Hex(`${pepper}|features|${day}|${ip}`)}`;
  const newSender = !(await kv.get(seenKey));
  if (newSender) await kv.put(seenKey, "1", { expirationTtl: SEEN_TTL_SECONDS });
  const key = `features:${day}`;
  const updated = addReport(parseFeatureDay(await kv.get(key)), report, newSender);
  await kv.put(key, JSON.stringify(updated));
}

/** The last `days` days' records, newest first. */
export async function readFeatures(kv: UsageKV, now: Date, days: number): Promise<({ day: string } & FeatureDay)[]> {
  const out: ({ day: string } & FeatureDay)[] = [];
  for (let i = 0; i < days; i++) {
    const day = usageDay(new Date(now.getTime() - i * 86400_000));
    out.push({ day, ...parseFeatureDay(await kv.get(`features:${day}`)) });
  }
  return out;
}
