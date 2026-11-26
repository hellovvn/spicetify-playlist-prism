# Prism report relay

A tiny Cloudflare Worker. Prism sends bug reports and ideas to it, and it opens a
GitHub issue as the `prism-reports` GitHub App. The App's private key lives only here
(as a Cloudflare secret), never in Prism, so users need nothing.

```
Prism --POST /report--> relay (checks, rate limits) --GitHub App--> issue on GITHUB_REPO
Prism --GET /lastfm-key--> relay --> { ok: true, key } (Prism's own Last.fm API key)
you   --GET /usage (token)--> relay --> { ok: true, days: [{ day, users }] }
```

The Last.fm key is Prism's shared key for users who haven't added their own. It's a
read-only app key (no shared secret, no sign-in), so handing it out is fine; keeping it
here means it is never in the repo and can be swapped without a Prism release.

- `src/report.ts`: checks the report and builds the issue (pure, tested in
  `tests/relayReport.test.ts`). `@mentions` are defused so a report never notifies anyone.
- `src/githubAuth.ts`: the App's sign-in (JWT from the .pem key, then an installation token).
- `src/usage.ts`: the anonymous daily user count (pure, tested in `tests/relayUsage.test.ts`).
- `src/worker.ts`: the HTTP endpoint, rate limits, GitHub calls.

Limits: 3 reports per sender per hour, 50 per day in total, 20 KB per report.
Senders' IPs are only kept as a hash, for one hour.

**User count:** every Prism asks `/lastfm-key` once per Spotify start, so the relay counts
the distinct callers per UTC day. The IP is never stored: it is hashed with the day and the
secret `STATS_TOKEN`, and that hash expires after 2 days. Only one number per day is kept
(`users:<day>`). It's approximate: people sharing a network count once, someone whose IP
changes counts twice, and two first calls at the same moment can count as one. Without
`STATS_TOKEN` nothing is counted.

Easiest: keep the token in `%USERPROFILE%\.prism\stats-token` (outside the repo) and run
`npm run users` (or `npm run users 90`) in the project folder. Or by hand in PowerShell
(`?days=` up to 90):

```powershell
$t = Read-Host "Stats token"; (irm https://prism-reports.hellovvn-spicetify-prism.workers.dev/usage -Headers @{ Authorization = "Bearer $t" }).days
```

## One-time setup

GitHub App (done 2026-11-25): `prism-reports`, App ID 5928498, permission Issues read and
write only, installed on spicetify-prism only (installation 185933361).

Cloudflare (run in this `relay` folder):

1. Make a free account at cloudflare.com, then sign in from the terminal:
   `npx wrangler login`
2. Make the rate-limit store and paste the printed `id` into `wrangler.toml`:
   `npx wrangler kv namespace create LIMITS`
3. Store the App's private key (the .pem GitHub downloaded) as a secret:
   `npx wrangler secret put GITHUB_PRIVATE_KEY < "C:\path\to\prism-reports.<date>.private-key.pem"`
   Then delete the .pem from Downloads (a new one can always be generated on GitHub).
4. Store Prism's Last.fm API key (an app registered at last.fm/api/account/create as
   "Prism"; only the "API key", never the "shared secret"):
   `npx wrangler secret put LASTFM_APP_KEY`
5. Make a long random token for the user count (reading the count needs it; keep a copy in your
   password manager) and store it: `npx wrangler secret put STATS_TOKEN`
6. Deploy: `npx wrangler deploy`. It prints the relay's address
   (`https://prism-reports.<account>.workers.dev`), which Prism will call.

## Changing things later

- **Switch to a private repo:** install the App on that repo too (GitHub, Settings,
  Applications, prism-reports, Configure), change `GITHUB_REPO`, `npx wrangler deploy`.
- **Turn reports off:** `REPORTS_ENABLED = "off"`, deploy. Prism shows the relay's message.
- **New key** (if the old one leaked): generate one on the App's page, repeat step 3,
  delete the old key on GitHub.
- **New Last.fm key** (suspended or abused): register a new Last.fm app, repeat step 4.
  Prism picks it up the next time Spotify starts (no Prism release needed).
- **Logs:** `npx wrangler tail` shows errors live (never the report text).
