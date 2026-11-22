# Playlist Prism (Spicetify extension)

## Goal
Build a NEW Spotify playlist around the vibe of 1–2 "seed" songs, using only songs
from the playlists the user picks (never new songs from Spotify's catalog). Songs are
scored on **song-level** signals (see "Scoring signals"), not Spotify's artist-level genres.

## User flow
1. Right-click a song, then choose **Start a Prism playlist** (option to add a second seed).
2. Fetch and clean the seed songs' tags, then show them as toggleable chips.
3. The user turns off any tags they don't want.
4. The user picks source playlists and/or Liked Songs.
5. Scan the sources, score each candidate against the seed (tags, BPM/key, later lyrics
   mood), and show a preview with each song's score and the reasons it matched.
6. The user confirms, and the extension creates a **new** playlist with those songs.
   Candidates come ONLY from the selected sources: no Song Radio / recommendations.

## Scoring signals (decided 2026-11-20 after a read-only spike on "Dark Romance", 25 songs)
1. **Last.fm tags**: song tags, artist-tag fallback at half weight. About 50% of songs
   have song-level tags. Used for the chips and the "why it matched" text.
2. **BPM + musical key**: 25/25 coverage. Read via
   `PlaylistAPI._metadataExtensionsAPI.fetch(...uris.map(u => [u, 222]))` (222 =
   AUDIO_ATTRIBUTES_V2, found by watching the client's own call) →
   `{ bpm, key: { key, mode, camelotKey: { value } } }`. Internal and undocumented: keep it in
   one read helper so a Spotify update is easy to fix.
3. **Lyrics mood** (step 10, word list, decided 2026-11-21): lyrics from
   `CosmosAsync.get("https://spclient.wg.spotify.com/color-lyrics/v2/track/{id}?format=json&market=from_token")`
   (`src/spotify/lyrics.ts`) -> `src/mood/lyricsMood.ts` counts words from 8 mood lists into a
   profile; songs compare by cosine similarity. English only; <5 mood words = no profile.
   Never store or log the lyrics text itself (only the profile, cached in `prism:moodCache`).
   Gotchas: CosmosAsync often RETURNS errors as `{code, message}` instead of throwing (404 = no
   lyrics; anything else must not be cached). The endpoint allows a burst, then 429s for a
   while, so lookups pause 60 s after a 429 and the next scan fills in the rest.
   Score weights: tags 60, mood 15, BPM 15, key 10.
- Not available: Web API audio features (energy/valence) return 429.
- Rejected: Song Radio and playlist recommendations. They work, but only 1/50 radio songs
  was in Liked Songs, and the user wants only their own songs.

## Hard rule: never modify existing playlists
- Never add to, remove from, reorder, rename, or delete any existing playlist or Liked Songs.
- The only write allowed is: create a new playlist, then add tracks to **that new playlist's URI**.
- All write calls live in one module (`src/spotify/write.ts`). Every function there
  asserts that the target URI equals the playlist created in the same session.
- Code review checklist item: grep for any other write call before merging.

## Stack
- Spicetify Creator (`npx create-spicetify-app`), TypeScript, React
- Data: Last.fm API (`track.getTopTags`, fallback `artist.getTopTags`), Spotify BPM/key,
  Spotify lyrics (later)
- Spotify access: `Spicetify.Platform.*` / `Spicetify.CosmosAsync` (Spotify client's own auth)
- Tests: Vitest for pure functions (tag cleanup, scoring, title normalization)

## Commands
```powershell
npm install            # first time
npm run watch          # rebuild on save (keep running while developing)
spicetify watch -a     # in a 2nd terminal: reload Spotify when the custom app changes
npm run build          # one-off build, writes to %APPDATA%\spicetify\CustomApps\playlist-prism
spicetify apply        # apply after first build or config changes
npm test               # unit tests (Vitest, tests/*.test.ts, no Spotify needed)
npm run smoke          # in-Spotify smoke test via debug port 9222 (needs spicetify watch -e)
```
Since step 12a this is a Spicetify CUSTOM APP (src/settings.json has an "icon"), not an extension:
- `src/app.tsx` = the page at `/playlist-prism`. Spicetify adds its header icon automatically
  (`button[aria-label="Playlist Prism"]`, picture from `src/assets/prism.svg`), no sidebar entry.
- `src/extensions/*.tsx` = always-on scripts (right-click item, profile menu, debug hook). They are
  a SEPARATE bundle from the page (no shared variables) and run as plain scripts: call main()
  yourself. They talk to the page only by navigating to it (`src/nav.ts`, `?go=...&r=...`).
- First-time registration: `spicetify config custom_apps playlist-prism`, then `spicetify apply`.
  (Done 2026-11-21; the old `extensions playlist-prism.js` entry was removed.)

## Spicetify.Platform APIs (confirmed present 2026-11-20, Spotify via Spicetify 2.46.4)
- Reads we plan to use: `RootlistAPI.getContents` (user's playlists), `PlaylistAPI.getContents`
  (a playlist's tracks), `LibraryAPI.getTracks` (Liked Songs).
- Writes allowed ONLY in `src/spotify/write.ts`: `RootlistAPI.createPlaylist`, then
  `PlaylistAPI.add` targeting the URI we just created.
- Never call: `PlaylistAPI.remove/move/updateDetails/setAttributes/clearAttributes/uploadImage`,
  `RootlistAPI.remove/move/renameFolder/removeFolder`, `LibraryAPI.add/remove/pin/unpin`.
- Method signatures are undocumented: test each one by logging before relying on it.
- Avoid the Web API via `Spicetify.CosmosAsync` (api.spotify.com): it returned 429 Too Many
  Requests even for single calls. For song details use `Spicetify.GraphQL.Request(
  Spicetify.GraphQL.Definitions.getTrack, { uri })` → `data.trackUnion`.

## Secrets
- The Last.fm API key is entered by the user in a settings field and stored in
  `Spicetify.LocalStorage` (key `prism:lastfmKey`). Never hardcode it or commit it.

## Code layout
- `src/app.tsx` (page entry), `src/ui/PrismPage.tsx` (the page), `src/extensions/prism.tsx`
  (always-on), `src/nav.ts` (page requests), `src/flow.ts` (load seed / scan / create)
- `src/lastfm/`: API client, throttle, cache
- `src/tags/`: cleanup and normalization (pure, unit-tested)
- `src/scoring/`: match scoring (pure, unit-tested)
- `src/spotify/`: read helpers and the single write module
- `src/ui/`: React components (chips, playlist picker, preview)

## Build plan
Done: 1 research, 2 scaffold + right-click item, 3 Last.fm key + tags, 4 tag cleanup,
4b title retries + artist fallback, 4c BPM/key, 5 seed panel + chips, 6 source picker,
7 scan (throttle, cache, progress), 8 scoring + preview (top 30 recommended, ticked),
9 create the new playlist (writes only in `src/spotify/write.ts`, guarded + static test
`tests/writeGuard.test.ts`; real test 2026-11-21 made "[Prism test] Often", no other list changed).
  Note: `RootlistAPI.createPlaylist` has no public/private option; on the developer's account new
  playlists came out Private. The smoke test never creates playlists.
- 9b (from the original spec, not built yet): optional second seed song.
- 10: Lyrics mood (word list) as an extra score. Done (tested by the developer 2026-11-21).
- 12 (redesign, decided 2026-11-21): Playlist Prism becomes ONE page (Spicetify custom app,
  `/playlist-prism`) instead of popups. Header (top bar) icon only, no sidebar entry. Inside the
  page, each Prism being generated is a TAB. Right-click "Start a Prism playlist" opens the page
  with a new tab for that song. Scans keep running while the user browses Spotify.
  - 12a: switch to a custom app; the 4 screens + settings live on the page (one Prism at a time,
    leaving the page ends it); start screen: playing song or pasted link. Page content is
    centred both ways; header icon = faceted pyramid diamond on a purple circle, hover: spin, star
    halo, rainbow ring (`src/ui/headerIcon.ts`, CSS injected by the always-on script; icon SVG in
    `src/assets/prism.svg`). DONE: tested by the developer and committed 2026-11-22.
  - 12b: tabs + background jobs: a job store outside React so scans survive navigation; parallel
    scans share the one Last.fm rate limiter.
  - 12c: purple "cosmic" theme scoped to the page; translucent spinning diamond while scanning
    (respect reduced motion). DONE early with 12a (committed 2026-11-22): twilight background with
    wavy rainbow light bands + sparkles, glass header/buttons/popup, star-halo scanning diamond.
  - 12d: result rows: tag chips with the shared tags highlighted, mood and BPM/key labels, score badge.
    Built early with 12a's polish (developer picked mockup "C" + "frosted glass with colour dot"):
    score ring, labels from `src/ui/tagLabels.ts` (colour = hash of the tag name), BPM/key + mood.
    DONE (committed 2026-11-22).
  - 12e (decided and built 2026-11-22, committed 2026-11-22): playlist stats page. Right-click a Prism playlist ->
    "Prism stats" opens the page (`?go=stats&playlist=...`): name, seed, date, "built from" tag
    labels, stat cards (songs, average BPM, top mood) and the genre mix as frosted GLASS BARS
    (developer picked bars over donut/bubbles). Data: records saved at creation in
    `prism:playlists` (`src/stats/playlistStats.ts`, saved since 2026-11-22; older Prism playlists
    have no record). Developer's choice: "Prism stats" shows on ANY playlist; without a record
    the page shows an ESTIMATE from the scan caches (read-only: playlist songs + cached tags/moods
    + BPM/key; nothing sent to Last.fm), saying how many songs were scanned.
    Code: `src/ui/StatsScreen.tsx`, `src/ui/GenreLabels.tsx` (shared labels; NOT "TagLabels.tsx":
    Windows treats it as the same file as `tagLabels.ts`). Debug hook: previewStats (sample
    numbers), openStats(uri), isSinglePlaylist.
    Extra stats (developer picked 2026-11-22; fingerprint = glass bubbles): mood mix, tempo spread (slow <90, fast 120+, slowest/
    fastest), Prism fingerprint (`src/ui/Fingerprint.tsx`, a glass bubble per genre), total length
    (+ longest/shortest; lengths from playlist reads and the seed lookup), and match spread (saved
    at creation only). Record fields tempo/length/match are OPTIONAL (older records lack them).
  - Sidebar: Prism playlists (a saved record, or still named "Prism · ...") get a purple hover
    (`src/ui/prismRows.ts`, always-on). Spotify paints its row hover on the row's ::after layer,
    so the purple goes there. Refreshed at start, after a playlist is created (window event
    "playlist-prism:records-changed") and every 20 s.
  - Fingerprint bubbles pop on click ("sparkle shower": soft fade + translucent sparkles drifting
    down), back after 3 s. Postponed (2026-11-22): cute hover doodles per playlist; two style rounds
    (faces, white scribbles) were rejected, so revisit with a better art direction.
- 11: Cleanup: remove the debug hook, README, release (after 12).

## Dev loop (Claude runs this, not the developer)
- Keep two terminal tabs running: `npm run watch` (rebuild on save) and `spicetify watch -e`
  (copies the build into Spotify and reloads Spotify automatically via the debugger).
- Before handing a step over for testing, Claude makes sure the new build reached Spotify
  (watch tab says "Reloaded Spotify", or run `spicetify refresh -e` + `spicetify restart`).
  Never ask the developer to press Ctrl+Shift+R.
- If Spotify's window is minimized/hidden: `Spicetify.showNotification` may stay undefined (so
  never wait for it at startup), Spicetify doesn't draw header links (the smoke test then SKIPS the
  icon check), and CDP screenshots never return (the smoke test gives up after 5 s). A plain
  `location.reload()` while minimized can leave Spicetify half-started (`Spicetify.ReactDOM`
  missing, extension never runs). Fix: over the debug port send
  `Emulation.setFocusEmulationEnabled {enabled:true}` + `Page.setWebLifecycleState {state:"active"}`,
  then `Page.reload`: it then starts fully without showing the window.
- A stopped background Bash task can leave `node scripts/smoke.mjs` running and driving Spotify;
  check for stray node processes before re-running the smoke test.
- Type check: `npx -y -p typescript@5.6.3 tsc --noEmit -p .` (TypeScript isn't a local dependency;
  plain `npx tsc` fetches an unrelated package).
- Before handing over a step, run `npm test` and `npm run smoke` and report results.
  Smoke test is READ-ONLY (uses `window.__playlistPrism` debug hook in src/extensions/prism.tsx); it never
  prints the API key. Screenshots go to `smoke-output/` (gitignored; they show the user's library).
- Test fixtures in `tests/fixtures/` are real recorded Last.fm data: don't "fix" them.
- `window.__playlistPrism` debug hook must be removed or dev-only before any public release.

## Working style
- **Explain what you change and why**,
  including any new concepts (APIs, React patterns, TypeScript features).
- Work in **small steps**. Do one step of the build plan at a time, then **stop** so the
  developer can test it before moving on.
- Prefer simple, readable code over clever code. Add unit tests for pure logic.
- Say clearly what was verified and what wasn't.

## Git
- "Commit" means commit AND push to `origin/main`.
- No `Co-Authored-By` or other AI attribution lines in commit messages or PR descriptions.
- On Windows PowerShell 5.1, write the message to a file and use `git commit -F <file>`:
  double quotes inside `-m "..."` get mangled and the commit can fail silently.
  Afterwards check that `git rev-parse HEAD` matches `origin/main`.
