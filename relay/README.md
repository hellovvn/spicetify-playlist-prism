# Prism report relay

A tiny Cloudflare Worker. Prism sends bug reports and ideas to it, and it opens a
GitHub issue as the `prism-reports` GitHub App. The App's private key lives only here
(as a Cloudflare secret), never in Prism, so users need nothing.

```
Prism --POST /report--> relay (checks, rate limits) --GitHub App--> issue on GITHUB_REPO
```

- `src/report.ts`: checks the report and builds the issue (pure, tested in
  `tests/relayReport.test.ts`). `@mentions` are defused so a report never notifies anyone.
- `src/githubAuth.ts`: the App's sign-in (JWT from the .pem key, then an installation token).
- `src/worker.ts`: the HTTP endpoint, rate limits, GitHub calls.

Limits: 3 reports per sender per hour, 50 per day in total, 20 KB per report.
Senders' IPs are only kept as a hash, for one hour.

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
4. Deploy: `npx wrangler deploy`. It prints the relay's address
   (`https://prism-reports.<account>.workers.dev`), which Prism will call.

## Changing things later

- **Switch to a private repo:** install the App on that repo too (GitHub, Settings,
  Applications, prism-reports, Configure), change `GITHUB_REPO`, `npx wrangler deploy`.
- **Turn reports off:** `REPORTS_ENABLED = "off"`, deploy. Prism shows the relay's message.
- **New key** (if the old one leaked): generate one on the App's page, repeat step 3,
  delete the old key on GitHub.
- **Logs:** `npx wrangler tail` shows errors live (never the report text).
