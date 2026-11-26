// npm run users [days]: how many people used Prism per day (the relay's anonymous count,
// relay/src/usage.ts). Reads the relay's STATS_TOKEN from %USERPROFILE%\.prism\stats-token
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
const { days: rows } = await res.json();

const width = Math.max(1, ...rows.map((r) => r.users));
for (const { day, users } of rows) {
  const bar = "#".repeat(Math.round((users / width) * 30));
  console.log(`${day}  ${String(users).padStart(4)}  ${bar}`);
}
const counted = rows.filter((r) => r.users > 0);
const best = counted.reduce((a, r) => (r.users > a.users ? r : a), { day: "-", users: 0 });
console.log(`\nToday: ${rows[0].users}. Busiest day: ${best.users} (${best.day}). Days with users: ${counted.length} of ${rows.length}.`);
console.log("Counts are people per day (approximate); the same person on two days counts twice.");
