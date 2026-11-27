// npm run users [days]: how many people used Prism per day (the relay's anonymous count,
// relay/src/usage.ts), and what they used (anonymous feature counts, relay/src/features.ts). Reads the relay's STATS_TOKEN from %USERPROFILE%\.prism\stats-token
// (or the PRISM_STATS_TOKEN env var). The token is never printed.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const RELAY = "https://prism-reports.hellovvn-spicetify-prism.workers.dev";
const TOKEN_FILE = join(homedir(), ".prism", "stats-token");

function readToken() {
  if (process.env.PRISM_STATS_TOKEN) return process.env.PRISM_STATS_TOKEN.trim();
  try {
    return readFileSync(TOKEN_FILE, "utf8").trim();
  } catch {
    console.error(`No stats token. Put it in ${TOKEN_FILE} (or set PRISM_STATS_TOKEN).`);
    process.exit(1);
  }
}

const days = Math.min(Math.max(Number(process.argv[2]) || 30, 1), 90);
const res = await fetch(`${RELAY}/usage?days=${days}`, {
  headers: { Authorization: `Bearer ${readToken()}` },
});
if (!res.ok) {
  console.error(res.status === 404 ? "The relay refused the token (or /usage isn't deployed)." : `Relay error ${res.status}`);
  process.exit(1);
}
const { days: rows, features = [] } = await res.json();

const width = Math.max(1, ...rows.map((r) => r.users));
for (const { day, users } of rows) {
  const bar = "#".repeat(Math.round((users / width) * 30));
  console.log(`${day}  ${String(users).padStart(4)}  ${bar}`);
}
const counted = rows.filter((r) => r.users > 0);
const best = counted.reduce((a, r) => (r.users > a.users ? r : a), { day: "-", users: 0 });
console.log(`\nToday: ${rows[0].users}. Busiest day: ${best.users} (${best.day}). Days with users: ${counted.length} of ${rows.length}.`);
console.log("Counts are people per day (approximate); the same person on two days counts twice.");

// ---- What people use (only from people with "Share anonymous usage counts" on) ----
// Counts arrive with Prism's next daily send, so they usually show a day after they happened.
const LABELS = {
  grow: "Grow playlists made",
  grow_new_finds: "  ...with New finds",
  remix: "Remix playlists made",
  merge: "Merges",
  add: "Add with Prism",
  tone: "Tones saved",
  stats: "Stats pages opened",
  playlist_theme: "Themes set on a playlist",
  report: "Reports / ideas sent",
};
const SETTING_LABELS = {
  lyrics_look: "Prism lyrics look on",
  side_panel: "Side panel stats on",
  own_lastfm_key: "Own Last.fm key",
  uses_tones: "Has a tone",
  uses_playlist_themes: "Has a playlist theme",
};

const shared = features.filter((f) => f.sharing > 0);
console.log("
Sharing usage counts (people per day; the rest switched it off or haven't sent yet):");
for (const f of features.slice(0, Math.min(features.length, 14))) {
  const users = rows.find((r) => r.day === f.day)?.users ?? 0;
  const off = Math.max(0, users - f.sharing);
  console.log(`${f.day}  ${String(users).padStart(4)} users  ${String(f.sharing).padStart(4)} sharing  ~${off} off`);
}
if (!shared.length) {
  console.log("
No feature counts yet (they start with the Prism release that adds the switch).");
} else {
  const sum = (key) => {
    const out = {};
    for (const f of features) for (const [k, n] of Object.entries(f[key] ?? {})) out[k] = (out[k] ?? 0) + n;
    return out;
  };
  const people = shared.reduce((a, f) => a + f.sharing, 0);
  const print = (title, totals, labels, unit) => {
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return;
    console.log(`
${title}`);
    for (const [k, n] of entries) console.log(`  ${(labels?.[k] ?? k).padEnd(28)} ${String(n).padStart(5)}${unit}`);
  };
  console.log(`
Totals over ${rows.length} days (${people} person-days of sharing):`);
  print("Used", sum("counts"), LABELS, "");
  print("Settings (person-days with it on)", sum("settings"), SETTING_LABELS, "");
  print("Main theme (person-days)", sum("themes"), null, "");
  print("Prism version (person-days)", sum("versions"), null, "");
}
