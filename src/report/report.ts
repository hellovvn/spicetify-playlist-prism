// Bug reports and ideas sent from Prism's Settings (pure parts, tests/report.test.ts).
//
// The form's answers + the auto-attached details become a ReportInput, the shape the
// relay (relay/src/report.ts) accepts. The SAME parseReport check runs here and on the
// relay, so what Prism lets you send is exactly what the relay takes.
//
// Privacy: details never contain the Last.fm key, lyrics, or song/playlist names.
// Error lines are scrubbed (scrubText) and the user sees every detail before sending.

import { parseReport, type ReportInput } from "../../relay/src/report";

export type ReportKind = "bug" | "idea";

export const FREQUENCIES = ["Once", "Sometimes", "Every time"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface ReportForm {
  kind: ReportKind;
  title: string;
  /** Bug: "What were you doing?" / Idea: "Your idea" */
  first: string;
  /** Bug: "What happened?" / Idea: "Why would it help?" */
  second: string;
  /** Bug only: "What did you expect?" */
  expected: string;
  /** Bug only. */
  frequency: Frequency;
}

/** The questions on the form, per kind (labels are also the issue's section headings). */
export const QUESTIONS: Record<ReportKind, { first: string; second: string; expected?: string }> = {
  bug: { first: "What were you doing?", second: "What happened?", expected: "What did you expect?" },
  idea: { first: "Your idea", second: "Why would it help?" },
};

export function emptyForm(kind: ReportKind): ReportForm {
  return { kind, title: "", first: "", second: "", expected: "", frequency: "Once" };
}

/** What the user must fill in before Send works, or null when it's ready. */
export function missingAnswer(form: ReportForm): string | null {
  if (form.title.trim().length < 3) return "Add a short title first.";
  if (form.kind === "bug" && !form.second.trim()) return 'Say what happened under "What happened?".';
  if (form.kind === "idea" && !form.first.trim()) return 'Describe it under "Your idea".';
  return null;
}

/** Builds what is sent to the relay. details = null when the user turned them off. */
export function buildReport(form: ReportForm, details: Record<string, string> | null): ReportInput | { error: string } {
  const missing = missingAnswer(form);
  if (missing) return { error: missing };
  const q = QUESTIONS[form.kind];
  const fields = [
    { label: q.first, text: form.first },
    { label: q.second, text: form.second },
  ];
  if (form.kind === "bug") {
    fields.push({ label: q.expected!, text: form.expected });
    fields.push({ label: "How often?", text: form.frequency });
  }
  const raw = { kind: form.kind, title: form.title, fields, details: details ?? undefined };
  const parsed = parseReport(raw);
  return parsed.ok ? parsed.report : { error: parsed.error };
}

/** Facts about this setup, gathered by the page (see collectDetails in ui/ReportScreen). */
export interface SetupInfo {
  prismVersion: string;
  spicetifyVersion?: string;
  spotifyVersion?: string;
  os?: string;
  screen: string;
  playlistTheme: string;
  recentErrors: string[];
}

/** The details block, in the order the user sees it. */
export function detailsFor(info: SetupInfo): Record<string, string> {
  const d: Record<string, string> = { Prism: info.prismVersion };
  if (info.spicetifyVersion) d.Spicetify = info.spicetifyVersion;
  if (info.spotifyVersion) d.Spotify = info.spotifyVersion;
  if (info.os) d.System = info.os;
  d.Screen = info.screen;
  d["Playlist theme"] = info.playlistTheme;
  if (info.recentErrors.length === 0) d["Recent errors"] = "none";
  info.recentErrors.forEach((e, i) => {
    d[`Error ${i + 1}`] = e;
  });
  return d;
}

/** "Windows" / "macOS" / "Linux" from a user agent; nothing more specific. */
export function osFrom(userAgent: string): string | undefined {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return undefined;
}

/** "1.2.52.442" from Spotify's user agent ("... Spotify/1.2.52.442 ..."). */
export function spotifyVersionFrom(userAgent: string): string | undefined {
  return userAgent.match(/Spotify\/([\d.]+)/)?.[1];
}

const MAX_ERROR_LENGTH = 200;

/**
 * Makes one error line safe to post publicly:
 * - the given secrets (the Last.fm key) become "[hidden]",
 * - api_key=... in URLs too (in case the key changed since),
 * - Spotify links/URIs become "spotify:<kind>" (no ids),
 * - text in quotes (often a song or playlist name) becomes "…".
 */
export function scrubText(text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of secrets) if (s && s.length >= 8) out = out.split(s).join("[hidden]");
  out = out
    .replace(/api_key=[^&\s"']+/gi, "api_key=[hidden]")
    .replace(/spotify:(track|playlist|album|artist|user|episode|show):[A-Za-z0-9]+/g, "spotify:$1")
    .replace(/https?:\/\/open\.spotify\.com\/(\w+)\/[A-Za-z0-9]+\S*/g, "spotify:$1")
    .replace(/"[^"]*"|“[^”]*”/g, "…")
    .replace(/\s+/g, " ")
    .trim();
  return out.length > MAX_ERROR_LENGTH ? `${out.slice(0, MAX_ERROR_LENGTH - 1)}…` : out;
}

/** A log line's own text, cut after " for " (Prism's logs put the song's name there). */
export function logContext(text: string): string {
  return text.replace(/ for [\s\S]*$/, " for …").trim();
}

/** Keeps the newest `max` lines (newest last), skipping a repeat of the line before. */
export function pushRecent(list: string[], line: string, max = 5): string[] {
  if (list[list.length - 1] === line) return list;
  return [...list, line].slice(-max);
}
