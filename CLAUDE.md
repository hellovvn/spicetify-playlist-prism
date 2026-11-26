# Prism (Spicetify extension)
Repo: github.com/hellovvn/spicetify-prism, folder Documents\Projects\spicetify-prism.

## Goal
Prism is a Spotify companion that helps people get more out of the music they already
have: grow a fresh playlist from a favourite song, remix messy playlists into tidy ones
by genre and mood, and see what each playlist is made of, all inside a page that feels
nicer than plain Spotify. It works from the user's own library and judges songs on **song-level** signals (see "Scoring signals"), not
Spotify's artist-level genres. ONE deliberate exception to "own library" (developer's
request, 2026-11-23): Grow's optional "New finds" (14e DISCOVER) add similar songs NOT in
the user's library, clearly marked, user-controlled (Off/5/10/20), and only ever added to
the NEW playlist.

## User flow
1. Right-click a song, then choose **Start a Prism playlist** (option to add a second seed).
2. Fetch and clean the seed songs' tags, then show them as toggleable chips.
3. The user turns off any tags they don't want.
4. The user picks source playlists and/or Liked Songs.
5. Scan the sources, score each candidate against the seed (tags, BPM/key, later lyrics
   mood), and show a preview with each song's score and the reasons it matched.
6. The user confirms, and the extension creates a **new** playlist with those songs.
   Candidates come from the selected sources, plus (if on) the marked "New finds" from
   Last.fm's similar songs (14e). Still no Song Radio / Spotify recommendations.

## Scoring signals (decided 2026-11-20 after a read-only spike on a 25-song playlist)
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
  was in Liked Songs, and the user wanted their own songs. (Later the developer asked for
  new songs too: that is 14e DISCOVER, via Last.fm similar songs, NOT Song Radio.)

## Writing to playlists
- The old hard rule "never modify existing playlists" was REMOVED by the developer on
  2026-11-24 (for "Add with Prism": add a song to one of the top-5 fitting playlists).
- All write calls still live in one module (`src/spotify/write.ts`), so they're easy to find
  and review; tests/writeGuard.test.ts lists the calls that module may make.
- Each write happens only after the user clicks a clear button for it (Create, Merge, Add).
- MERGE PLAYLISTS may RENAME the playlists
  it merged, and only when the user leaves the "Rename the originals" switch on. The rename
  only puts "[merged] " in front of the playlist's current name (never twice), only for
  playlists picked in that same merge, only AFTER the new merged playlist was created and
  filled, and only for the user's OWN playlists (`isOwnedBySelf`; the rootlist's
  `canEditMetadata` is false even for your own; followed playlists and Liked Songs are never renamed). Songs, order, description and cover of the originals are
  never touched. Lives in `createMergedPlaylist` in write.ts (`PlaylistAPI.updateDetails`
  with `{ name }` only); tests/writeGuard.test.ts allows exactly that one extra call.

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
npm run build          # one-off build, writes to %APPDATA%\spicetify\CustomApps\prism
spicetify apply        # apply after first build or config changes
npm test               # unit tests (Vitest, tests/*.test.ts, no Spotify needed)
npm run smoke          # in-Spotify smoke test via debug port 9222 (needs spicetify watch -e)
npm run release        # PUBLIC build: release/prism + release/prism-<version>.zip, no debug hook
npm run site           # guide website: site/pages/*.md -> site-dist/ (GitHub Pages)
```
Since step 12a this is a Spicetify CUSTOM APP (src/settings.json has an "icon"), not an extension:
- `src/app.tsx` = the page at `/prism`. Spicetify adds its header icon automatically
  (`button[aria-label="Prism"]`, picture from `src/assets/prism.svg`), no sidebar entry.
- `src/extensions/*.tsx` = always-on scripts (right-click item, profile menu, debug hook). They are
  a SEPARATE bundle from the page (no shared variables) and run as plain scripts: call main()
  yourself. They talk to the page only by navigating to it (`src/nav.ts`, `?go=...&r=...`).
- First-time registration: `spicetify config custom_apps prism`, then `spicetify apply`.
  (Done 2026-11-21; the old `extensions playlist-prism.js` entry was removed.)

## Spicetify.Platform APIs (confirmed present 2026-11-20, Spotify via Spicetify 2.46.4)
- Reads we plan to use: `RootlistAPI.getContents` (user's playlists), `PlaylistAPI.getContents`
  (a playlist's tracks), `LibraryAPI.getTracks` (Liked Songs).
- Writes live ONLY in `src/spotify/write.ts`: `RootlistAPI.createPlaylist`, `PlaylistAPI.add`,
  and Merge's `[merged] ` rename (`PlaylistAPI.updateDetails(uri, { name })`).
- Not used so far: `PlaylistAPI.remove/move/setAttributes/clearAttributes/uploadImage`,
  `RootlistAPI.remove/move/renameFolder/removeFolder`, `LibraryAPI.add/remove/pin/unpin`.
- Method signatures are undocumented: test each one by logging before relying on it.
- Avoid the Web API via `Spicetify.CosmosAsync` (api.spotify.com): it returned 429 Too Many
  Requests even for single calls. For song details use `Spicetify.GraphQL.Request(
  Spicetify.GraphQL.Definitions.getTrack, { uri })` → `data.trackUnion`.

## Last.fm terms (read 2026-11-25, https://www.last.fm/api/tos)
- Non-commercial use only; doubtful cases go to partners@last.fm. They "must credit Last.fm
  and include links"; their logo needs written approval (so text only).
- Credit lives in Settings > "About" (developer's pick "A", `data-prism="lastfm-credit"`) and
  the README's Credits section.
- Tip/donation link: the terms don't mention donations (suggested: ask Last.fm).

## Ko-fi support (2026-11-25, developer's pick "A")
- A "Support Prism" glass button (an `<a class="prism-glass-button">`, cup icon) under the
  Last.fm credit in Settings > About, linking to ko-fi.com/<username> in the browser.
- The username is ONE constant, `KOFI_USERNAME` in `src/support.ts` ("hellovvn"); while empty
  the button is hidden. Also `.github/FUNDING.yml` (GitHub Sponsor button) and the README's
  Support section. A plain link only: never load Ko-fi's widget/overlay script inside Spotify.

## Secrets
- Last.fm key (decided 2026-11-26, developer's pick): Prism works WITHOUT a key of the
  user's own. Order (`chooseLastfmKey` in `src/lastfm/keyChoice.ts`, tested):
  1. the user's OWN key from Settings (optional), `prism:lastfmKey`;
  2. Prism's SHARED key: a read-only Last.fm app key registered as "Prism", handed out by the
     relay (`GET /lastfm-key`, Worker secret `LASTFM_APP_KEY`) and copied into
     `prism:sharedLastfmKey` (`src/lastfm/sharedKey.ts`: asked once per Spotify start by the
     always-on script; the page waits for it only when there's no key at all yet).
  Last.fm's limit is per IP, so one shared key is fine; Prism calls Last.fm directly (the relay
  never forwards Last.fm calls). Swap a suspended key: new Last.fm app, `npx wrangler secret
  put LASTFM_APP_KEY`, users get it at their next restart. Never hardcode or commit either key
  (the developer's personal key included); reports scrub both.
- KEY ERRORS (2026-11-26, PR #39, adapted for the shared key): `src/lastfm/keyErrors.ts` (pure,
  tests/keyErrors.test.ts). No key at all (our code -1) = the shared key couldn't be fetched;
  invalid (10) / suspended (26) get a message by whose key it was (`keyProblemMessage(error,
  getLastfmKeySource())`): the user's own -> fix it in Settings; Prism's shared -> try later or
  add your own. Nothing asks for a key before starting any more. Settings links to the guide site's
  lastfm-key.html (LASTFM_KEY_GUIDE_URL), framed as optional (the README no longer has it).

## Code layout
- `src/app.tsx` (page entry), `src/ui/PrismPage.tsx` (the page), `src/extensions/prism.tsx`
  (always-on), `src/nav.ts` (page requests), `src/flow.ts` (load seed / scan / create)
- `src/lastfm/`: API client, throttle, cache
- `src/tags/`: cleanup and normalization (pure, unit-tested)
- `src/scoring/`: match scoring (pure, unit-tested)
- `src/spotify/`: read helpers and the single write module
- `src/ui/`: React components (chips, playlist picker, preview)

## Name
The app is called "Prism" everywhere users see it (src/settings.json displayName, page
title, Settings title, profile-menu item, messages). Since step 15 (2026-11-26) the
internal ids are "prism" too: custom app nameId `prism` (page `/prism`, folder
CustomApps\prism), `window.__prism` debug hook, `[Prism]` console prefix, "prism:*" window
events, "prism-*" element/style ids. Storage keys were already "prism:*", so saved
settings and playlists keep working.
The start page has no "What would you like to do?" heading any more (Prism will start
changing playlist contents in the future, so its "never changed" line no longer holds).

## Build plan
Done: 1 research, 2 scaffold + right-click item, 3 Last.fm key + tags, 4 tag cleanup,
4b title retries + artist fallback, 4c BPM/key, 5 seed panel + chips, 6 source picker,
7 scan (throttle, cache, progress), 8 scoring + preview (top 30 recommended, ticked),
9 create the new playlist (writes only in `src/spotify/write.ts`, guarded + static test
`tests/writeGuard.test.ts`; real test 2026-11-21 made a "[Prism test] ..." playlist, no other list changed).
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
  - Sidebar: Prism playlists USED to get a purple hover with rainbow rays (`src/ui/prismRows.ts`).
    REMOVED 2026-11-24 at the developer's request: with a playlist theme on, every row gets the
    "rainbow edge" hover instead (see LIBRARY PANEL THEME). Spotify paints its row hover on the
    row's ::after layer. "prism:records-changed" (RECORDS_CHANGED_EVENT, now in
    playlistStats.ts) still tells the side panel about new records.
  - Fingerprint bubbles: restyled 2026-11-22 (mockup "C3", developer's pick after rejecting
    other styles and colourless soap bubbles). Each bubble keeps its GENRE TAG COLOUR: see-through
    colour that's strongest at the edge, a soft glow in that colour, a faint white rim, two
    reflections, and a gentle float plus wobble. A pop vanishes in a 140 ms flash and sprays 16
    droplets (colour and white). Back after 3 s. Genre-mix numbers sit right after their bars
    (narrow column, left-aligned). Postponed (2026-11-22): cute hover doodles per playlist; two style rounds
    (faces, white scribbles) were rejected, so revisit with a better art direction.
- 13 (decided 2026-11-22, before 12b): ORGANIZE PLAYLISTS mode. Pick several playlists and split
  ALL their songs into N NEW playlists by genre + mood. Source playlists are never changed.
  Decisions: groups are auto-suggested, then the user refines them, OR the user scraps the
  suggestions ("Start from scratch") and defines groups by picking genres/moods per group;
  overlap (a song in several groups) is the user's choice; songs with no tags are force-sorted
  into the closest group using BPM/key + lyrics mood. The playlist picker is the SAME component
  as the Prism flow's (consistency); Organize adds a settings panel (how many: 3/4/5/6/8/Auto,
  overlap on/off). Review screen = option "A, album covers": one glass card per group with a 2x2
  mosaic of its songs' album art, name, song count, genre/mood labels; click to see/edit songs.
  - 13a: start page with two modes (Make a Prism playlist / Organize playlists); Organize setup
    (shared picker + settings panel; how many: 2/3/4/5/6/8/Auto); scan (reuses runScan). Ends on a scan summary. DONE: tested and committed
    2026-11-22. Code: `src/ui/OrganizeFlow.tsx`; SourcePicker and
    ScanScreen got optional intro/extra/nextLabel props; page content minHeight SCREEN_HEIGHT + 80
    so the header stays put on every screen (start page cards stack at 633px in a narrow window).
  - 13b: grouping, PURE + unit-tested: song vectors from tags + mood + BPM; k-means with a fixed
    start (same input = same groups); Auto picks N; group names from their top tags/moods;
    untagged songs go to the closest group; overlap mode adds a song to every group it fits
    well (similarity >= a share of its best fit).
    Signals (decided 2026-11-22): genre tags (main), lyrics mood, BPM. Musical KEY is NOT used for
    grouping, only SHOWN. Setup gets a "Group mostly by" choice: Genre / Mood / Energy (BPM) /
    Balanced (default), which shifts the weights. Untagged songs: mood + BPM only.
    Review screen shows a per-group SUMMARY (grouped by what; genre/mood/tempo/key mix) ON SCREEN
    ONLY: nothing of it is written into the new playlists (no description).
    DONE: tested by the developer and committed 2026-11-22.
    `src/organize/grouping.ts` (+ tests/grouping.test.ts, 17 tests). Weights per focus in
    FOCUS_WEIGHTS; OVERLAP_SHARE 0.8; Auto tries 3-8 with a silhouette-style score; names skip
    tags of 4+ words. Real data (Liked Songs + one playlist, 250 songs): grouping ~0.15 s, Auto
    chose 8. Groups screen in OrganizeFlow is a plain list until 13c's album-cover cards.
    Improvements after testing "2 playlists into 2" (2026-11-22): count choice 2 added; seeds are
    "different AND typical of a crowd" (plain farthest-first grew groups around lone outliers);
    tags weighted by rarity in the selection (TF-IDF: "pop" everywhere counts less); personal
    junk tags ("my top songs", "saw live"...) added to cleanTags and skipped by grouping via
    isJunkTagName (old cached tags still contain them). Grouping can't recreate the original
    playlists when they don't differ in sound (it only sees genre/mood/tempo).
  - 13c, split in two:
    - 13c-1: review screen (album-cover cards) + editing: rename, move/remove songs, merge.
      DONE: tested and committed 2026-11-22. `src/ui/GroupReview.tsx`;
      pure edits in `src/organize/editGroups.ts` (+ tests). Covers: ScanTrack.cover/coverSmall
      from album.images ("spotify:image:<id>" -> https://i.scdn.co/image/<id>). Groups are only
      named after tags shared by 2+ artists in the group. Smoke note: when Spotify isn't the
      active window, element.focus()/blur() fire no events; the smoke test sends "focusout".
      Dropdowns are `src/ui/GlassMenu.tsx` (a <select>'s open list is drawn by Windows, can't be
      glass). Its list is a React PORTAL into <body>: Spotify's main view has will-change:
      transform, which makes position:fixed measure from the view (list showed ~300px off).
      Merge is "Combine with another group…" and asks first, saying what will happen.
    - 13c-2: "Start from scratch" builder (pick genres/moods per group, Prism sorts the songs
      into them). DONE: tested and committed 2026-11-22 (group detail's "All groups" button is now
      "Back", developer's request). Layout "B"
      (developer's pick): group list left, name + genre/mood labels (with song counts, genre search,
      moods dashed) right. Pure logic `src/organize/customGroups.ts` (+ tests/customGroups.test.ts):
      a song matches a group by genre tag or main lyrics mood; best fit wins (FOCUS_WEIGHTS),
      overlap uses OVERLAP_SHARE; songs matching nothing go to the closest group by mood + BPM
      (`closestByMoodAndTempo` in grouping.ts). UI `src/ui/GroupBuilder.tsx`; GroupReview keeps
      suggested and custom groups SEPARATELY (switching loses no edits); custom cards show the
      picked labels first.
  - 13d: create the N playlists. write.ts must allow SEVERAL new playlists per session, each still
    guarded (only URIs created in this session); confirm first; save stats records for each.
    COMMITTED 2026-11-22 at the developer's request, BEFORE a real "Create playlists" run (still
    untested with real playlists: do that run next). write.ts needed no
    change (createdThisSession was already a Set). Layout "B" (developer's pick): "Create playlists"
    on the cards screen opens a confirm screen (`src/ui/CreatePlaylists.tsx`) listing each playlist
    (empty groups skipped), a "Prism · " prefix switch (ON by default, developer's wish), then
    creates them ONE AT A TIME (`createAll` in `src/organize/createPlaylists.ts`, pure + tested):
    stops at the first failure and says which exist / weren't tried. Done = rows with Open +
    "Home". flow.ts `createOrganizedPlaylist` writes via createPrismPlaylist, then saves
    `buildOrganizeRecord` (seed null, keptTags = picked labels or top 3 tags,
    `organized.from` = source playlist names; stats page says "Organized from ...").
    The smoke test opens the confirm screen only and NEVER clicks Create.
  - Start page redesign: DONE, committed 2026-11-22 with 13d. Mockup
    "D" flip tiles (`src/ui/FlipTile.tsx`). The front shows a centered whimsical SVG icon and a
    label (`src/ui/HomeIcons.tsx`, the developer's picks after many mockup rounds). Tile 1,
    "Grow a playlist": a see-through matte pink boombox. Its speakers pulse with two ripple
    rings (no centre dot) and it has a small pill in the middle. Notes fly out from behind it
    (hidden by an SVG mask). The ring of rainbow bars was removed at the developer's request.
    Colours follow the Remix tapes, with pink as the main colour (mockup "B5"): a pink body and
    handle (flat ends, so it doesn't poke into the body), mint and sky rings round each pink
    cone, and pink/mint/sky notes. Tile 2, "Remix into moods": three see-through tapes with hearts on a shelf. On
    hover they shuffle places (3.2 s loop; on leave they stop at the next still moment in
    whatever order they reached), and music notes drop into whichever tape is on top
    (1.6 s loop, so the notes land during each pause).
    Icon animations run only while the tile has the class `is-animating`. On mouse leave or
    blur, FlipTile lets each animation finish its current loop (Web Animations API:
    updateTiming iterations = current + 1) before removing the class, so nothing freezes
    mid-move. Hovering again during that wind-down restarts the loops. On hover there's a swirling pastel conic glow, sparkles, the icon
    animates, and a short line appears. Click flips the tile to the old card content plus
    "← Back". The hidden face is visibility:hidden, so Tab skips it. Reduced motion means no
    turn or swirl. Smoke: `flip-prism`/`flip-organize` buttons, `unflip-*` Back.
- 14 (to-do, asked 2026-11-22; not designed yet, so show mockups first):
  - 14a THEMES: the user can switch the page's background away from purple twilight. Options:
    sunset, twilight (current), dusk, and a few more (for example dawn, aurora, ocean). Pick in
    Settings; saved in Spicetify.LocalStorage. The colours should be CSS variables, so a theme
    only swaps the variables.
    PAUSED 2026-11-22 after the first mockup round: 8 themes shown (Twilight, Sunset, Dusk, Dawn,
    Aurora, Ocean, Midnight, Cherry blossom) and 2 pickers (A: theme cards in Settings, B: colour
    dots in the header). The developer hasn't picked yet. Resume from that mockup.
  - 14b PER-PLAYLIST THEME: a theme can be set on one playlist. Opening that playlist in Spotify
    changes the background to its theme. This is a local setting only (LocalStorage keyed by
    playlist URI) and must NEVER write to the playlist itself (hard rule).
    BUILT 2026-11-25 (developer's pick "A, right-click sub-menu"; not committed): right-click one
    playlist > "Prism theme" > one of the 10 themes (the main one says "(default)"; picking it removes the playlist's own theme), each with
    a gradient swatch icon; the current choice's row is tinted lavender (`data-prism-chosen` on its swatch; `src/ui/playlistThemeMenu.ts`, item
    names re-set in shouldAdd -> redraw, like Add with Prism). Saved in `prism:playlistThemes`
    (JSON URI -> theme id; parseThemeOverrides / withThemeOverride / effectiveTheme in
    src/theme/playlistTheme.ts, tested). An entry may be "none" (that playlist keeps Spotify's
    look). The playlist PAGE and the LYRICS (while playing FROM that playlist, Player context uri,
    re-checked on songchange) use it, and so does that playlist's OPEN ROW in the left panel
    (developer's choice 2026-11-25, "row only": libraryTheme.ts sets the row sky's theme and
    background per row; only while a main theme is on). The rest of the left panel, the bars
    ("Quiet night" on/off) and the other pages follow the MAIN theme only.
  - 14c The LYRICS view follows the active theme (the playlist's theme if it has one).
    FIRST PART BUILT 2026-11-22 (not committed): `src/ui/lyricsTheme.ts`, injected by the
    always-on extension, gives Spotify's lyrics views the twilight colours. It overrides the
    CSS variables Spotify writes per song (--cinema-mode-bg-color-from/to,
    --lyrics-color-*) with !important, found with [style*="..."] selectors, not generated
    class names. It also keeps [data-testid="now-playing-bar"] at opacity 1: in the expanded
    lyrics view Spotify fades the controls out after ~4 s idle, and the developer wants them
    always usable. Later, when themes (14a) exist, swap the colours for the active theme.
    Also: the expanded view gets the full twilight sky (gradient, glows, rainbow bands) on
    `.Root__cinema-view > .main-actionBar-ActionBarContainer`, the still box around the
    scrolling part, and Spotify's #121212 backdrop is cleared, so the top and bottom aren't
    black. Spotify's "Full screen" buttons are hidden ([data-testid="fullscreen-mode-button"]
    and the view's "Enter Full screen"): full screen made the view cover the top bar and the
    player bar. IMMERSIVE MODE (Spotify adds Root__cinema-view--controls-hidden BY ITSELF,
    e.g. after idle or a reload; no button needed): its own CSS gives the view negative
    margins and z-index --above-everything, and Spotify's code hides the top bar (opacity 0)
    and pushes the right sidebar (Now Playing) over the view as an empty grey block. Undone
    with margin 0 / height auto / z-index 5, top bar and title row opacity 1, and
    .Root__right-sidebar hidden while that class is on. Verified 2026-11-22 when Spotify
    switched it on by itself. LESSON: a test where the class was present but the margins
    weren't was wrongly taken as proof. Verify against Spotify's real trigger, and use a plain
    full-window screenshot. The developer chose: always keep both bars.
    SETTINGS SWITCH "Prism look for lyrics" (On/Off, On by default): saved as
    `prism:lyricsTheme` ("on"/"off"; only "off" turns it off, isLyricsThemeOn is pure and
    tested). Off removes the whole style tag, so Spotify's own lyrics (cover colours, full
    screen, immersive) come back. The switch sends LYRICS_THEME_CHANGED_EVENT, so it takes
    effect without a reload. startLyricsTheme() in the always-on script applies it.
    FOLLOWS THE PLAYLIST THEME (2026-11-25, developer's pick "D, moving sky + reading veil";
    built, not committed): with a playlist theme on, `syncLyricsSky` (lyricsTheme.ts) puts the
    theme's sky (`buildSky`, exported from ui/playlistTheme.ts) + `.prism-lyrics-veil` into the
    lyrics view's still box; lines use LYRICS_LINE_COLOURS (theme/playlistTheme.ts) via
    html[data-prism-lyrics-sky]. Watches .Root__top-container (children only) for the cinema view.
    No theme = twilight lyrics as before.
  - 14d NEW VIEW: the playlist and its lyrics side by side, so the user can see the playlist
    while singing along. Never store or log lyrics text.
  - 14e DISCOVER in Prism playlists: BUILT 2026-11-23 (not committed; smoke-tested, waiting for
    the developer's test). Similar songs NOT in the user's library ("New finds"), only ever
    added to the NEW playlist.
    Spike (6 seeds, a ~760-song library): Last.fm `track.getSimilar` gave 30 for every seed;
    118/120 found on Spotify by exact title + artist; ~6% already in the library; the top 1-3
    are usually the seed's own artist, so MAX_PER_ARTIST = 2.
    Pipeline (`findNewSongs` in flow.ts, pure parts in `src/discover/discover.ts` + tests):
    track.getSimilar (50; fallback artist.getSimilar 10 x artist.getTopTracks 3) -> drop the
    seed and anything in the WHOLE library (Liked + every playlist, songKey) -> up to 40
    candidates -> Last.fm tags (must share a kept tag, same rule as every Prism song) ->
    Spotify search (`src/spotify/search.ts`, GraphQL `searchModalResults`; other search
    definitions fail) -> BPM/key -> same scoreSong (lyrics mood unknown). Cached per seed + tags
    for the session. ~36 found for one seed in the smoke test.
    UI (developer's picks): layout "A" = one best-first list with library songs; a "New finds"
    chip row Off/5/10/20 (default 10, saved as `prism:growNewCount`) under the songs count;
    rows = mint glass ("S2", .prism-new-find) + "New find" pill with the Prism star (the 3
    sparkles round the score ring were removed 2026-11-24, developer's request). Tooltip says
    Last.fm's similarity. While searching, the status line shows the standard progress bar
    ("Looking for similar songs…" + .prism-progress + "15 of 40").
    PRISM STAR (2026-11-24, look "A", developer's pick): the ✦ character is replaced
    everywhere by `.prism-star-icon` (src/ui/prismStar.ts): the 4-point star filled with the pastel
    rainbow, gently twinkling, 1em. Used in the New finds status, the New find pill and the
    Tone strip title. RankedSong.newFind marks them.
- GROW SONG COUNT (2026-11-23, not committed): preview chips "Songs from your playlists"
  10/20/30/50/All/Custom (1-500), saved as `prism:growCount` (default 30). Choosing a count
  RE-TICKS exactly the best N (hand ticks before it are replaced); "All" = every match, no
  score floor. `picksFor`/`parsePickCount` in rank.ts. (Shift-click range ticking was built
  and then REMOVED at the developer's request, 2026-11-23.)
- GROW PLAYLIST ORDER (2026-11-23, developer's wish): the seed is always first, the rest is
  SHUFFLED, with the new finds spread evenly through it (never bunched at the start).
  `playlistOrder` in `src/scoring/playlistOrder.ts` (pure, tested), used by createFromPreview.
- SIDE-PANEL STATS (built 2026-11-22, not committed): when a playlist Prism made or organized
  (one with a saved record) is open, Spotify's right-hand Now Playing panel shows its stats,
  layout "P2" (developer's pick): a strip with the song playing now, then name + "Grown
  from"/"Organized from" + date, built-from tag chips, fingerprint bubbles, songs/length/avg
  BPM/top mood, top 6 genre bars (+ "N more genres"), tempo split with slowest/fastest, longest/
  shortest song, match to the seed (grown playlists only), mood chips, and a "View full stats"
  button.
  Junk tags in stats (fixed 2026-11-22): record tag counts are built from CACHED song tags, which
  may have been cleaned before a junk word was listed ("my top songs", "saw live" showed in the
  panel). Now summarize() skips isJunkTagName tags, and chartRows / genreCounts / builtFromTags
  filter them at display time too, so OLD records are fixed without re-saving.
  FULL STATS PAGE WIDE (2026-11-22): while the Prism stats page shows, CSS (:has on
  data-prism-view="stats", in styles.ts) stretches .Root__main-view over the right panel's
  grid column (main-view-start / right-sidebar-end), hides .Root__right-sidebar and widens the
  page to 1120px. It switches back by itself on leaving.
  It grows in from the right (clip-path animation, class is-wide-stats on the twilight box). A
  ONE glass button "Back to playlist" (data-prism="stats-open"; the corner icon and "Open
  playlist" were merged, developer's choice). When the side panel can show the playlist (saved
  record, panel setting on) it minimizes; otherwise it just opens the playlist. Minimizing: a still COPY ("ghost", .prism-ghost) is
  laid over the main view (clipped to what was visible, in a fixed frame) and MORPHS into the
  side panel's exact spot (mockup "A2", the developer's pick; target = the 3rd grid column of
  .Root__top-container, or the width panelHost remembers in --prism-side-panel-width, because
  that column is 0px while the stats page is open) using only transform + opacity via
  element.animate(). It ends with a CROSSFADE: the copy waits in the panel's spot until the
  panel's stats are drawn, then fades out as they fade in (the browser
  keeps animating those while Spotify's ~250 ms playlist-page build blocks the page), the real
  page's content is hidden (is-leaving, twilight background stays), and the playlist opens
  underneath. The side panel's host (solid twilight background) is placed at once on a page
  change, and its stats are drawn when the browser is idle, so Spotify's own panel never
  flashes. Checked with a Chrome screencast (frames keep coming every ~10 ms).
- UI STANDARD (developer approved 2026-11-23, built, not committed): one look per element,
  documented in `docs/ui-elements.md` (see "UI elements" below).
- Stats page text sizes (kept consistent): summary values 24px, a panel's headline value 16px,
  counts beside bars 13px, section headings 13px, smaller lines 12px.
- Stats cover ring (.prism-artwork in styles.ts): a MOVING pastel neon ring. A registered
  custom property (`@property --prism-ring-angle`) is animated 0->360deg in 3.5 s and a conic
  gradient starts at it, so the colours travel round the 3px border (with a white glint).
  ::after = the ring, blur(1.5px) so its edges are soft (developer asked); ::before = the
  same colours blurred 12px as a glow. The cover is align-self: center in the title row so its
  middle lines up with the title's. Reduced motion: still.
- Stats page: no Prism header (developer's request), every bar is the same 14px thickness, and
  the playlist's cover (one image or Spotify's 2x2 mosaic, artworkUrls in sidePanel.ts) sits
  left of the title.
- MORE STATS (2026-11-23): Artists (N songs from M artists, top 5), Eras (songs per decade,
  oldest/newest), Key (major vs minor split, most common key). Worked out LIVE and read-only
  from the playlist (artists + release year from PlaylistAPI items, key from the BPM lookup)
  in `src/stats/playlistExtras.ts` (pure, tested), loaded by loadPlaylistExtras in flow.ts
  (cached 5 min), shown by `src/ui/ExtraStats.tsx` on the full page and (compact) side panel.
- GENRE COLOURS: palette is 11 pastels; tagColours(names) gives each tag on one view its own
  colour (next free one on a clash). Stats page and side panel pass it to bars, chips and the
  Fingerprint (colourOf). Genre labels next to bars sit in one grid (fit-content column) and
  long names wrap inside the pill (.prism-tag.wrap).
- GENRE ALLOWLIST (2026-11-22, developer's choice "keep only known genres"): a tag is kept only
  if it's on the MusicBrainz genre list (`src/tags/musicbrainzGenres.ts`, 2,227 genres, CC0,
  GENERATED from https://musicbrainz.org/ws/2/genre/all?fmt=txt), on EXTRA_GENRES (alternative,
  indie, cottagecore, female vocalist, live...) or MOOD_TAGS (chill, sexy, dark, late night...),
  all in `src/tags/knownTags.ts`. Also kept: decades ("80s") and "<nationality> <known genre>"
  ("korean r&b"). Matching ignores spaces, "-" and "_" ("synthpop" = "synth-pop"). It applies in
  cleanTags (new tags) and isJunkTagName (cached tags, saved stats, Organize), so fandom tags
  ("<artist>core") and personal labels vanish everywhere, including old records.
- SIDE PANEL STATS: shown on EVERY playlist since 2026-11-25 (developer's request): Prism-made/organized
  ones from their saved record, the rest as an ESTIMATE (`loadPanelEstimate` in flow.ts): cache estimate at
  once, then the songs missing tags or a mood lookup are scanned like a tone scan (Last.fm + lyrics, shared
  caches) while the panel shows them; the estimate is redone every 3 s; leaving the playlist, the Queue or
  the "Now playing" tab stops the scan. No Last.fm key = cache only. Playlists of only audiobooks/podcasts
  say "No songs here...". TABS (mockup "B", `src/ui/PanelTabs.tsx`): "Prism stats" | "Now playing", ONE
  choice for all playlists, kept as `data-prism-panel-view` on <html> (page + always-on bundles share it;
  resets when Spotify restarts). On "Now playing" a 48px strip with the tabs sits across the top of
  .Root__right-sidebar and Spotify's .main-nowPlayingView-container moves down (both Spotify layouts:
  header in flow, and the video one with headerContainerV2 overlaid). The full stats page's "Back to
  playlist" morphs into the panel for estimates too, unless the tabs are on "Now playing".
  NUMBERS CARD = layout "B" (2026-11-25): tone fit as the standard ScoreRing (now src/ui/ScoreRing.tsx, so
  the always-on bundle doesn't pull in PreviewScreen) left of a 2x2 grid (songs, length, avg BPM, top mood).
  It only covers the panel while it shows Now Playing (never the queue). NOTE: Spotify draws the QUEUE
  inside the same .main-nowPlayingView-container; only the Queue has a [role=tablist], which is the check. Pure parts are in `src/ui/sidePanel.ts` (tested; NOT "panelStats.ts", which
  clashes with PanelStats.tsx on Windows). The view is `src/ui/PanelStats.tsx`, mounted by
  `src/ui/panelHost.tsx` from the always-on script (createRoot into a div placed inside
  .Root__right-sidebar, re-checked every 1.5 s). Settings switch "Prism stats in the side panel"
  (`prism:panelStats`, on by default). Right-click > Prism stats still opens the full page.
- REMIX "TWO DOORS" FLOW (2026-11-23, mockup A, developer's pick; replaces the count-1 shortcut
  and "Start from scratch"/"Use suggestions" switching). Screens: picker (NO settings panel) ->
  scan -> choose (`ChooseMode` in OrganizeFlow.tsx: "Sort them for me" = mode "auto", "I'll pick
  the vibes" = mode "me"; Next shows once one is picked) -> groups (GroupReview, `mode` prop, no
  switching between the two there; Back goes to the doors). Settings now live under "More
  options" on the cards screen (`src/ui/RemixOptions.tsx`: GROUP_COUNTS = Auto,2,3,4,5,6,8 with
  Auto the default; focus; overlap). Changing one regroups AT ONCE (auto: new `suggested` resets
  the groups via an effect; me: sortNow re-sorts), undoing edits (the panel says so). Your own
  groups have no How many. The builder starts with ONE group (= one playlist; "+ Add group" for
  more) and has Back. One playlist: sortIntoGroups leaves non-matching songs OUT; no More
  options; wording "N of M songs match your picks", "Edit my picks", "Create playlist".
  NOT INCLUDED: songs in no group (left out, or removed by hand) show as a dashed card
  (.prism-left-card) after the groups; it opens a list with each song's reason (you took it out /
  no tags or mood / none of your picks), "Add" (one playlist) or an "Add to…" glass menu, and
  "Add all" (one playlist: into it; several: closest group by mood + tempo via
  closestByMoodAndTempo). Pure helper `addSongs` in editGroups.ts (tested). The page title of
  this flow is now "Remix into moods" (the flip tile's back face still says "Organize playlists").
  GROUP CARDS = look "A, door tiles" (developer's pick, 2026-11-23): wide glass tiles (grid
  minmax(280px), so two per row), 84px cover mosaic (TILE_COVER) left, text beside it; hover =
  the standard lavender hover + lift (pink only marks a PICKED door/builder group, see
  docs/ui-elements.md). Not included tile keeps its dashed edge. Counts say "1 song".
- START PAGE WORDING (developer's picks): Grow = "Start with a favourite song and grow a
  playlist of songs that feel like it." Remix = "Shuffle your playlists into fresh ones sorted
  by genre and mood. Make several, or just the one you want."
- PRISM ICONS (2026-11-25, mockup "E" of nine, developer's pick): the page header icon
  (PrismIcon in PrismIcon.tsx) AND the Spotify top-bar icon (src/assets/prism.svg) are the
  Prism star: the 4-point star filled with the pastel rainbow (same shape as
  .prism-star-icon), a white glint, and 3 sparkles that twinkle in turn
  (.prism-head-sparkle / .prism-sparkle). Top-bar hover (mockup "C, colour-matched glow", picked
  2026-11-25): a flowing copy of the star (.prism-flow, SMIL gradient slide) fades in and a
  glow (.prism-glow) breathes behind it with hue-rotate. The star NEVER turns (developer's
  request); the moving neon ring round the top-bar button was REMOVED (purple circle only,
  3px inside the button). prism-active.svg = same picture with "-active" gradient ids.
  SCANNING ICON (2026-11-26, mockup "D, glow + progress ring", developer's pick): the scan
  screen's old faceted diamond + star halo is replaced by `ScanningPrism` = the Prism star
  (breathing, never turns) over a soft glow, in a pastel rainbow ring that FILLS with the scan's
  progress (`progress` prop, done/total; before the count is known a short arc circles).
  Ring = `[data-prism="scan-ring"]`, CSS .prism-scan-* in styles.ts.
- Smoke note: "Cancel stops the scan part-way" can fail as a race when nearly every song is
  cached (the scan finishes before the Cancel click lands); a re-run reports it as SKIPPED.
- MERGE PLAYLISTS (2026-11-23, built on branch feature/merge-playlists, waiting for the
  developer's test). Start page: a wide glass bar under the two flip tiles (mockup "B",
  developer's pick; `.prism-home-bar`). Flow (`src/ui/MergeFlow.tsx`): the shared SourcePicker
  (2+ playlists) -> confirm screen: one row per playlist with its song count, the total and how
  many duplicates are dropped, a name box (default "A + B", `defaultMergeName`), and the switch
  'Rename the originals to "[merged] …"' (ON by default; rows that can't be renamed say why)
  -> Merge -> done (Open + Home). Dedupe (`mergeSongs` in `src/merge/mergePlaylists.ts`,
  pure + tested): the same URI OR the same songKey (title + main artist, so another album's
  copy counts) is a duplicate; the first copy keeps its place, playlists in the order picked.
  If a rename fails, the merged playlist still stands and the done screen lists what wasn't
  renamed. No stats record is saved for merged playlists (they aren't Prism-grown/organized).
  DUPLICATES LIST (2026-11-24, mockup "A", developer's pick): "▾ Show duplicates" after the summary
  opens an in-place glass list; each row = the left-out copy + its playlist, and the copy kept
  ("kept \"<song>\" from <playlist>", or "already in …" for the same URI). Data: `dropped` from mergeSongs.
- PLAYLIST TONE (2026-11-24, mockup "A", developer's pick; tested by the developer in Spotify,
  committed and merged 2026-11-24). Right-click a playlist > "Prism tone" opens the tone editor
  (`?go=tone&playlist=...`, `src/ui/ToneEditor.tsx`; the menu item says "Add Prism tone" when the
  playlist has no tone yet: two registered items, each shown by its shouldAdd check): key genres (search + tag switches,
  PickChip from GroupBuilder), lyrics moods, tempo Any/Slow/Mid/Fast. A new tone starts from
  `suggestTone` (genres/moods shared by a fifth of the songs, a tempo band if 70% are in it).
  Saved ONLY in `prism:tones` (keyed by playlist URI, `src/tone/tone.ts`, pure + tests); the
  playlist is never touched. Score (`scoreAgainstTone`): genres 60 (75% from the song's BEST
  tone genre, 25% from how many it has; exact = 1, word-inside = 0.5, tag strength 0.5+ counts
  fully), mood 15 (cosine), tempo 15 (1 in the band, 0 at 20% outside); key not used. Unknown
  parts are left out; no tags at all in a genre tone = no score ("–").
  Tone view (`src/ui/toneRows.ts`, always-on): a TONE STRIP (mockup "E") right after the
  playlist's action bar row ([data-testid="action-bar-row"]): Toggle (new element `.prism-toggle`,
  for instant on/off only; checkboxes stay for picking), the Prism star + "Tone", the tone's labels and Edit.
  NO summary text (developer removed it): `stripStatus` only says "Scoring songs: 12 of 39…"
  while the rings load, or "Couldn't score the songs". Edit opens the SAME ToneEditor
  (variant "popup": Cancel instead of Back) in a wide pop-up over the playlist
  (`src/ui/tonePopup.tsx`, host inside .Root__main-view, overlay has `prism-cosmos` for Prism's
  colours). Right-click > Prism tone / Add Prism tone opens the SAME pop-up (2026-11-24,
  `openTonePopupOnPlaylist`): from another page it opens the playlist first and shows the pop-up
  once its action bar is drawn (the pop-up closes on any page change). `?go=tone` on the Prism
  page still exists (debug hook openTone). Pure strip/ring helpers
  are in `src/ui/toneView.ts` (toneRows imports React via the pop-up, which tests can't load).
  On = a 32px score ring in every song row (in .main-trackList-rowSectionEnd); songs under 50%
  get a GREY ring (rows are never faded, developer's request 2026-11-24). Songs with no Last.fm tags are scored on mood + tempo only ("partial", a FADED ring at
  half strength; developer's pick); no mood/tempo either = "–".
  "Tone fit" (`loadToneFit` in flow.ts, `toneSummary`) shows as a 5th stat card on the stats page
  and a 5th number cell in the side panel (average of all scores; hover = breakdown; fits/drift
  count full scores only). Reloads on TONES_CHANGED_EVENT (defined in tone.ts). Rows have NO song ID in the HTML:
  the URI is read from React's fiber (memoizedProps.uri, walking up). Spotify reuses rows while
  scrolling, so a MutationObserver on .Root__main-view re-applies them. Songs not scanned yet are
  scanned like a Grow scan (`loadToneSongs` in flow.ts, shares the caches; progress in the
  switch). Spotify's "Recommended" rows under the playlist get no ring.
  Songs added AFTER the scores loaded: a row whose song has no score makes the view re-read the
  playlist (at most every 5 s, rings stay up) and score the new songs; songs still missing after
  that (the Recommended rows) are remembered and never trigger a re-read again.
  Testing note: the CDP "keep the page active" emulation only lasts while THAT debug connection
  is open, so set it in the same connection that runs a check (or timers crawl while hidden).
  GROWN PLAYLISTS START WITH A TONE (2026-11-24, not committed): createFromPreview saves
  `toneFromGrow` (tone.ts, tested): genres = the chips kept ON, moods = the seed's main lyrics
  moods, tempo = a band if 70% of seed + picks share one (`commonTempo`, also used by
  suggestTone), view switched ON. Local only; a failure leaves the playlist fine.
  Not built yet (suggested): drifters first, Grow from a tone, split the drifters into a new
  playlist. Open question: switch Settings' On/Off segmented choices to the Toggle too.
- PLAYLIST THEMES (2026-11-24, developer's picks after mockup rounds D-H; tested by the developer,
  committed 2026-11-24 in PR #10). Spotify's grey sticky bars (top bar + song-list column header)
  become twilight glass and its green accents (play buttons, liked ticks, playing title)
  Prism pastels, on themed playlist pages only. Settings > "Playlist theme": No theme (default) /
  Northern lights / Starry night / Bubble nebula (segmented choice, saved as
  `prism:playlistTheme`, PLAYLIST_THEME_CHANGED_EVENT applies it at once). With a theme on,
  EVERY playlist page (developer's choice) gets: a moving sky behind the page
  (`.prism-pl-sky`, first child of .Root__main-view with z-index -1; the view gets
  `isolation: isolate` and data-prism-theme; Spotify's cover-colour washes are cleared), a
  COLOUR RAIL beside the songs (each song's main genre = its strongest non-junk cached tag,
  colours via tagColours; unscanned = faint lavender; playing song pulses; on the outer
  [role="row"]; only `.main-trackList-indexable` rows, not
  Recommended), and a GENRE MIX bar after `.main-entityHeader-metaData`. READ-ONLY: playlist
  songs + tag cache only, nothing sent to Last.fm. Prism's own page keeps its twilight sky
  (developer's choice). Code: `src/theme/playlistTheme.ts` (pure, tests/playlistTheme.test.ts),
  `src/ui/playlistTheme.ts` (always-on). Densities scale with the window (mockups were 680px).
  MORE THEMES (14a, decided 2026-11-25 after five mockup rounds; built, not committed): 6 more,
  so 9 + No theme (an "Ocean" theme was built and then REMOVED at the developer's request,
  2026-11-25; a saved "ocean" falls back to No theme / the main theme). Ids/labels (Settings order): twilight "Twilight" (Prism's page sky:
  glows + rainbow light bands, NO sparkles), aurora, stars, milkyway "Milky Way" (M2),
  nebula, afterglow "Afterglow" (S2), mist "Misty morning", blossom
  "Blossom canopy" (B2), rain "Window rain" (R1).
  TWEAKS after seeing them in Spotify (2026-11-25, developer's requests): Twilight got the Prism
  page's twinkling sparkles back; Northern lights' curtains drift through other colours
  (hue-rotate on .prism-pl-aurora-hue, 70 s); Milky Way = a detailed band (glow, warm core,
  pink/blue wisps, dark dust lanes, dense stars) + 3 shooting stars that all fly down-left;
  Blossom petals at three depths (far small/faint, near big/blurred) in three petal shapes
  (plain, notched cherry via a CSS mask, oval; a five-petal flower was dropped) and the canopy
  is soft blurred PETALS too (not round blobs) over blurred dark BRANCH shadows (SVG, swaying); Window rain = a few small + many big city
  lights that now and then dim, behind a RAIN-ON-GLASS SIMULATION on one canvas
  (`src/ui/rainGlass.ts`, developer's reference "Raindrops on Window Loop", calmer): lumpy
  drop sprites (never perfect circles), new drops landing and merging, drops >= SLIDE_RADIUS
  sliding (max 3 at once) nearly STRAIGHT down (steering from drop to drop looked odd), swallowing
  drops in its way and wiping small ones from its path; trail look "T3, wiped path" (a clean
  darker channel with faint glossy edges, drawn in chunks so no line shows down the middle;
  drops look "D1"; its top fades in over TRAIL_TAPER px) that dries up over TRAIL_LIFE (12 s). ~30 fps, pauses while
  hidden, stops when the canvas leaves the page, one still frame with reduced motion; the
  canvas carries data-drops/-sliding/-trails counts for checks. Pure parts tested in
  tests/rainGlass.test.ts. (Earlier tries: white drops and falling streaks looked like snow);
  Misty morning = "M8, fogged glass" (pastel glows drifting and dimming behind misted glass,
  no drops). Left-panel colours/rows follow.
  Left-panel open rows: rain = D1-style drops on the glass (.prism-lib-wdrop) with one sliding
  through now and then, leaving a "wiped path" trail (.prism-lib-wtrail, same steps, top faded,
  dries up).
  Skies: `src/ui/themeSkies.ts` (newSkyHtml + NEW_SKY_CSS; drops/petals/ripples move on
  animationiteration via wireSky). Left panel: NEWER_PANELS/NEWER_ROWS + rowSkyHtml branches in
  `src/theme/libraryTheme.ts`. Lyrics: LYRICS_LINE_COLOURS. Afterglow, Misty morning and Window
  rain were made darker/calmer than the mockups so Spotify's grey song text stays readable.
  Prism's own page still keeps its twilight sky. SETTINGS PICKER = "D": `.prism-seg.is-pills`
  (wrapping pills) + `ThemeStrip` (the chosen theme's real sky). BUG FIXED with it: the page
  updater's clear() removed EVERY .prism-pl-sky in the window (lyrics view, preview strip); it
  now only removes the main view's own sky.
- LIBRARY PANEL THEME (2026-11-24, developer's picks after 4 mockup rounds; committed and merged
  2026-11-24 in PR #11):
  with a playlist theme on, Spotify's left panel gets a STILL background (the developer hated a
  frozen copy of the page sky): Northern lights + Bubble nebula = "top glow", Starry night =
  "rising dusk". ONLY the open playlist's row moves (`[role=row][aria-selected=true]`, layer
  `.prism-lib-sky` inside its `[data-encore-id=listRow]` box): Northern lights = "soft veil"
  (streaky curtains/ribbons in a row looked wrong), stars = sparkles, nebula = clouds + bubbles.
  Green -> pink in the panel too. `src/theme/libraryTheme.ts` (pure, tests/libraryTheme.test.ts),
  `src/ui/libraryTheme.ts` (always-on). Panel grey = `.main-yourLibraryX-entryPoints` +
  `.main-yourLibraryX-libraryContainer`.
  RIGHT PANEL (2026-11-25, option 2 "mirror left" of four full-page mockups, developer's
  pick): the right panel gets the SAME still background as the left (panelBackground of the
  main theme, every theme), flipped left-right (::before with scaleX(-1) on
  `.Root__right-sidebar-peek`; aside + .main-nowPlayingView-container cleared). CSS in
  libraryTheme.ts behind `html[data-prism-side-theme]` (outweighs chromeTheme's #151029).
  Friend activity: "listening now" dot = `--spice-notification` (lavender), photo
  placeholder = `--spice-button-disabled` (#3a2d5e), set in chromeTheme.ts.
  HOVER (developer's pick, option 4 "rainbow edge"): with a theme on, EVERY row (Prism or not)
  gets lavender glass + a pastel rainbow bar on the left + a 3px slide. The Prism-only purple
  rays were then removed completely (prismRows.ts deleted); with No theme rows keep Spotify's grey.
  LIKED SONGS: its page is /collection/tracks but its row is a separate pinned
  `spotify:playlist:37i9dQZF1F...` that isn't in the rootlist, so Spotify never sets
  aria-selected on it. FIX: on /collection/tracks the row whose cover is
  `img[src*="/liked-songs/"]` counts as open (`isLikedSongsPage`); the open row's box gets
  `.prism-lib-open`. The Liked Songs PAGE itself still has no playlist theme (not /playlist/).
- THEME AUDIT (2026-11-24): besides Prism's page, playlist pages, lyrics and the left panel,
  Spotify still showed its own black/grey/green on 4 bars/panels (top bar, right panel, player
  bar, "Playing on ..." strip; now DONE, see "Quiet night" below) and ~9 page types (see 16).
- SPOTIFY'S BARS "QUIET NIGHT" (2026-11-24, mockup "C" of four, developer's pick; tested by the
  developer, committed in PR #12): `src/ui/chromeTheme.ts` (always-on). With any playlist theme on, on EVERY page:
  bars and gaps #0b0817, right panel #151029 with #1d1638 cards, pastel instead of green.
  Pure CSS behind `html[data-prism-chrome]`. Spotify's greens there come from Spicetify's
  `--spice-button(-active)` + `--spice-rgb-button(-active)` and `--text-bright-accent` /
  `--essential-bright-accent`, swapped on the three bar roots. Connect strip =
  `.main-connectBar-connectBar` (only there while another device plays; checked with a
  temporary copy). Don't paint `.main-nowPlayingView-section`: "Related music videos" has
  no card in Spotify and turned into a square block.
  Also (2026-11-25): the left panel's "+" (Create) button reads `--background-elevated-*`
  (now the #1d1638 / #251c45 cards), and the playing song's equaliser in song lists is a
  GREEN GIF (`img[src*="equaliser-animated-green"]`; while Spotify's window is unfocused it's
  the still `equaliser-green.svg` instead; no variable reaches either): a CSS filter
  turns it Prism pink and keeps the animation.
  Left panel's round icon buttons (Expand Your Library...) hover/press with Spotify's grey
  --background-highlight / --background-press: swapped for #251c45 / #1d1638 on .Root__nav-bar (2026-11-25).
  TOOLTIPS (mockup "D", 2026-11-25): `[data-tippy-root] .main-contextMenu-tippy:has(> [role=tooltip])` =
  #0b0817, text #e9dcff, 2px pastel rainbow line at the bottom (CSS in chromeTheme.ts). Tooltips open on
  JS pointer events: to test, dispatch pointerover/mouseenter on the button (CDP mouse moves didn't).
  Testing note: Git Bash rewrites a "/search" argument into "C:/Program Files/Git/search";
  use MSYS_NO_PATHCONV=1 when passing Spotify paths to node scripts.
- ADD WITH PRISM (asked 2026-11-24; built, not committed, waiting for the developer's test):
  pick a song, Prism shows the TOP 5 of your playlists that fit it best and adds the song to the
  one(s) you click. Developer's decisions: same song-level signals as everything else (scoreSong:
  tags, lyrics mood, BPM, key); candidates = playlists with rootlist `canAdd` (own AND
  collaborative; skip ones that already have the song by URI or songKey; Liked Songs never);
  add-only (one song, at the end). UI = mockup "C": a right-click SUB-MENU "Add with Prism"
  (`src/ui/addWithPrism.ts`; Spicetify's SubMenu re-draws when an item's text is set, so it opens
  with "Finding playlists…" and fills in), last line "More on the Prism page…" opens
  `?go=addto&song=...` (`src/ui/AddToScreen.tsx`: score rings, shared genres, Add buttons). The
  start page has a second start bar "Add a song to your playlists" (asks for the playing song or
  a link). Now-playing: right-click the player bar's song (same menu).
  Fit (`src/addto/fitPlaylists.ts`, pure + tests): the song is scored against every playlist song
  with cached tags; fit = 0.7 x the average of the best quarter (3-10 songs) + 0.3 x the share of
  songs that share a genre at all (stops "pop" making every playlist alike). Playlists with <3
  tagged songs aren't judged ("unjudged", the page says so). Library side = CACHES only (nothing
  sent to Last.fm, read in ~0.4 s, remembered 2 min, cleared after an add); the song itself is
  looked up on Last.fm if not cached. Write: `addSongToPlaylist` in write.ts (re-reads the playlist
  first so a song is never added twice; refuses non-playlists, !canAdd, already there).
  Debug hook: openAddTo(uri?), getAddWithPrismState(), findPlaylistsForSong(uri) (read-only).
- START BARS (2026-11-25, developer's picks after six mockup rounds; tested by the developer,
  merged in PR #22): the Merge and Add a song
  bars are `src/ui/StartBar.tsx`. Icons in HomeIcons.tsx animate on hover/focus and finish their
  loop on leave (like FlipTile): Merge = "Q1 bubbles" (pink + sky bubbles drift into one mint
  bubble with green notes), Add a song = "S1 compass" (needle settles on the mint playlist of
  sky/mint/pink). Lines: "Stack your playlists together and drop the doubles" / "Let Prism find
  the best home for a song", shown ONLY on hover/focus. Rejected along the way: matte boxes,
  records, prism beams, tapes, jars, ribbons, hearts/home, puzzle pieces (several styles),
  constellations, bouquet, paint drops, and bubble ideas for Add.
- TESTING NOTE (2026-11-25): reloading Spotify over CDP with `Page.reload {ignoreCache: true}`
  left Spotify's own chunks half-loaded (lottie-animation "Cannot access 'f' before
  initialization") and playlist pages showed "Something went wrong". Use a plain Page.reload.
- BUG REPORTS + IDEAS (asked 2026-11-25; relay deployed and tested 2026-11-25): users send a report from
  inside Prism; it becomes a PUBLIC issue on spicetify-prism (developer's choice; may switch to a
  private repo later). Prism calls a relay (`relay/`, Cloudflare Worker, setup in
  relay/README.md) that opens the issue as the GitHub App `prism-reports` (App ID 5928498,
  Issues read/write only, installed on spicetify-prism only). The App's .pem key lives ONLY as
  the Worker secret GITHUB_PRIVATE_KEY: never in Prism, never committed (*.pem is gitignored).
  No replies to users (no contact field). Relay: 3/sender/hour, 50/day, @mentions defused,
  pure parts tested (tests/relayReport.test.ts).
  FORM (mockup "B", developer's pick 2026-11-25): Settings > "Help make Prism better" > "Report a
  bug" / "Suggest an idea" opens `src/ui/ReportScreen.tsx` INSIDE the Settings layer
  (SettingsState.report), so the screen underneath is kept. Pure parts `src/report/report.ts`
  (+ tests/report.test.ts): the same relay parseReport check runs in Prism; details = versions,
  OS, screen, playlist theme, last 5 Prism warnings (`src/report/errorLog.ts` wraps
  console.warn/error for "[Prism]" lines, memory only) scrubbed by scrubText (Last.fm
  key, api_key=, Spotify ids, quoted names, text after " for "). User sees the details and can
  untick them. RELAY LIVE at https://prism-reports.hellovvn-spicetify-prism.workers.dev
  (REPORT_RELAY_URL in `src/report/send.ts`; empty = Send says "Reporting isn't set up yet").
  Cloudflare account = the developer's (workers.dev subdomain hellovvn-spicetify-prism, KV
  LIMITS id in relay/wrangler.toml); redeploy with `npx wrangler deploy` in relay/. Real test
  2026-11-25: issue #33 by the bot, labels idea + from-prism, @mention defused (closed).
  Testing note: never send a real report without the developer's OK (it's a public issue).
  USER COUNT (2026-11-26, developer's request): the relay counts distinct `/lastfm-key` callers per
  UTC day (`relay/src/usage.ts`, tests/relayUsage.test.ts): IP hashed with day + secret STATS_TOKEN,
  hash kept 2 days, only `users:<day>` stays. No STATS_TOKEN = no counting. Read with GET /usage +
  `Authorization: Bearer <STATS_TOKEN>`, easiest `npm run users [days]` (token in
  %USERPROFILE%\.prism\stats-token, never in the repo, never printed). Deployed 2026-11-26. Approximate (shared networks,
  changing IPs, KV races). Mentioned in the README's Privacy line.
- 15 (DONE 2026-11-26, smoke-tested, committed): internal ids renamed from "playlist-prism" /
  "Playlist Prism" to "prism" (see "Name"). The header icon's aria-label was already "Prism"
  (it follows displayName). Each machine needs the Spicetify swap once:
  `spicetify config custom_apps playlist-prism-` then `spicetify config custom_apps prism`,
  build, `spicetify apply`; the old CustomApps\playlist-prism folder can then be deleted.
- 16 (to-do, asked 2026-11-24; NEXT step for theming): give the rest of Spotify's PAGES the
  Prism look, so nothing shows Spotify's plain #121212 / green while a playlist theme is on.
  Already themed: Prism's page, /playlist/ pages (`src/ui/playlistTheme.ts`), lyrics views
  (`lyricsTheme.ts`), the left panel (`libraryTheme.ts`) and the bars (`chromeTheme.ts`,
  "Quiet night", PR #12). Still Spotify's own look (audit 2026-11-24, screenshots of each):
  1. Home (/)                      6. Artist pages (/artist/...): cover-colour header, green play
  2. Search / Browse all (/search): loud category tiles on #121212
  3. Liked Songs (/collection/tracks): Spotify's purple header, green play, grey filter chips
  4. Your Library (/collection)    7. Settings (/preferences): grey, green switches
  5. Album pages (/album/...): cover-colour header, green play   8. Listening history (/history)
  9. Genre / category pages (/genre/...)
  16a (2026-11-24, developer's pick "A, full sky" of four mockups; built, not committed):
  album (/album/), artist (/artist/<id>, not its sub-pages) and Liked Songs (/collection/tracks)
  get the playlist theme's sky, cleared washes, glass bars and pastel play button, but NO colour
  rail or genre mix (developer's decision: those stay PLAYLIST-ONLY) (`themedPageKind` in src/theme/playlistTheme.ts, tested). Artist pages:
  their #121212 block is found by structure (generated class names), and the artist photo sits
  in `.before-scroll-node` (pinned, never scrolls), so it fades out on scroll via
  --prism-banner-fade. Next: Home, Search, Your Library, Settings, history, genre pages.
  16b HOME (2026-11-24, developer's pick "D, sky band" of four; tested, merged in PR #15): with a
  playlist theme on, Home ("/", page kind "band") gets the theme's sky only behind its top part
  (`[data-prism-band]`, --prism-band-height = 42% of the view, 320-560px, masked to fade out),
  Quiet night's #151029 below, and the band fades out on scroll (--prism-band-fade). Spotify's
  `.main-home-homeHeader` wash is cleared, shortcut tiles are lavender glass, cards hover
  lavender, the stuck filter-chip row is top-bar glass. Spotify's filter chips
  (`[data-encore-id="chip"]`, inner `[class*="legacy-chip__inner"]`; the class prefix carries
  Spotify's version) are glass with a gradient chosen chip on every themed page.
  16c SEARCH + GENRE PAGES (2026-11-24, developer's pick "B, full sky + pastel glass tiles" of
  four; tested by the developer, merged in PR #17): page kinds "search" (/search, /search/<words>[/tab]) and "genre"
  (/genre/<id>) get the full sky; `data-prism-page` on .Root__main-view carries the kind.
  Browse tiles are found by STRUCTURE (`.main-gridContainer-gridContainer > * > a >
  div[style*=background-color]:has(> img)`): not all link to /genre/ (Live Events = /concerts,
  Podcast Charts = /podcastcharts). Lavender glass + a pastel glow by grid place (nth-child 5n).
  Results: top-result box = `[class*="legacy-box--tinted"]` -> lavender glass; the sticky chip
  row has generated classes, so JS marks the chips' nearest sticky ancestor
  (`data-prism-chip-row`). Genre pages: the colour header is a pinned picture in
  .before-scroll-node (hidden) and the #121212 block is the parent of
  .main-actionBarBackground-background (cleared).
  16d SETTINGS (2026-11-24, developer's pick "C, quiet night + cards" of four; checked in
  Spotify, merged in PR #21): page kind "settings" (/preferences) gets NO sky:
  #151029 with each `.x-settings-section` on a #1d1638 card, Spotify's switches
  (`.x-toggle-input:checked + .x-toggle-indicatorWrapper`) in the Prism Toggle's colours, glass
  dropdowns (`.main-dropDown-dropDown`) and buttons, lavender zoom picker (selected radio =
  the circle with a 2nd generated class), equalizer canvas hue-shifted, Beta tag gradient.
  LISTENING HISTORY needs no page theme: in this Spotify /history is NOT a page, it opens the
  right panel's Queue > "Recently played" tab (and sends the main view to /), which Quiet night
  already themes.
  16e RIGHT-CLICK MENUS (2026-11-25, developer's pick "D, clear frost" of four; built, not
  committed): with a playlist theme on, every Spotify menu/sub-menu is frosted glass with pastel
  icons and the standard lavender hover (CSS in chromeTheme.ts). Hooks: [data-encore-id="menu"],
  [data-encore-id="menuRow"] (hover = data-hovered/data-focused/data-open), "Add to playlist"
  = [data-encore-id="popover"][data-trigger="ContextMenuSubmenu"] (search box + clear inner
  menu); Spotify's scroll fades are the menu's ::before/::after gradients in #242424.
  16f PROFILE (2026-11-25, developer's pick "A, full sky" + the avatar ring from "D"; built, not
  committed): page kind "profile" = /user/<id> and its Show all pages (followers, following,
  top/artists, top/tracks, playlists). Full sky (shared cleared washes), each
  `section.main-shelf-shelf` on lavender glass, the photo (`.main-entityHeader-imageContainer`)
  in the round Cover ring (colours shared via `src/ui/ringColours.ts`; @property is registered
  in the always-on CSS too). Spotify's #333 square + square shadow behind round card photos
  (`.main-cardImage-imageWrapper`) are cleared, the shadow moved onto the img.
  16g PODCASTS (2026-11-25, developer's pick "A, full sky"; built, not committed): page kind
  "podcast" = /show/<id> and /episode/<id>. Shared sky + cleared washes; the episode page's
  #121212 block = `[data-testid="episode"] div:has(> .playlist-playlist-actionBarBackground-background)`;
  Spotify's blue "not played" dot reads `--spice-notification` (set to lavender on the page);
  `[data-testid="trailer-component"]` = lavender glass. SEARCH RESULTS were checked 2026-11-25:
  already themed by 16c (podcast results tab included).
  Spicetify's own Marketplace page (/marketplace) is still plain #121212 (not Spotify's; ask).
  16h DIALOGS (2026-11-25, developer's pick "A, Prism pop-up"; built, not committed): CSS in
  chromeTheme.ts. Two kinds: `.GenericModal__overlay [role=dialog] > *` (Edit details) and
  native `dialog[open]` (Keyboard shortcuts = the dialog itself, Credits = its only child
  `.main-trackCreditsModalV2-container`), backdrop = `dialog::backdrop`. Glass card + Text box +
  Main button looks. The page also holds a hidden [role=dialog] language list: find dialogs by
  content. Test openers: playlist title (Edit details, close with Escape), Ctrl+/ (shortcuts),
  song row right-click > View credits.
  YOUR LIBRARY has no page in this Spotify: /collection, /collection/playlists etc. all
  redirect to /collection/tracks (Liked Songs), and "Expand Your Library" only widens the left
  panel, which libraryTheme.ts already themes.
  Step 16 pages are all done (2026-11-25); left: Marketplace (Spicetify's, ask).
  Re-checked 2026-11-25 (profile, search results, show, episode, Edit details, shortcuts):
  all themed; the one miss was green PRIMARY buttons outside the action bar (episode
  "Comment"), now `[data-prism-theme] [data-encore-id="buttonPrimary"]` = the gradient.
  Colour sweep 2026-11-25 (script: every visible element whose bg/fill/text is Spotify's
  green, #121212-#535353 grey or blue; TEST it with a planted green box first, a quoting
  bug once made every page look clean). Fixed: an artist's Show all pages
  (/artist/<id>/discography[/...], related, appears-on, featuring, discovered-on, playlists)
  = page kind "sky"; Discography's per-release `.artist-artistDiscography-headerContainer`
  cleared; the round-photo card fix now covers "sky" pages too; folder tiles + cover
  placeholders in the bars read `--image-placeholder-bg-color` (= #1d1638).
  16i BROWSE PAGES (2026-11-25, developer's pick "A, full sky + glass" of three, because
  full sky = pages you browse/listen from, band = Home, quiet night = tools/settings):
  page kind "browse" = What's New (/content-feed), Live Events (/concerts), Podcast Charts
  (/podcastcharts[/...]). The shared sky + cleared washes remove Spotify's purple/blue
  banners; chart tiles (`[data-testid="chart-category-card"] > a`) = lavender glass;
  concert date labels (`time[datetime]:has(> [data-encore-id="text"])`) = purple glass.
  Podcast Charts' tile pictures are Spotify's own art (blue/magenta), left as they are.
  MARKETPLACE (Spicetify's own page, developer's request 2026-11-25): also kind "browse".
  Spicetify's stable classes: tabs `.marketplace-tabBar-headerItemLink` (glass; active =
  gradient), `.marketplace-header` cleared, its Dropdown/search/icon button = glass, cards
  `.main-card-card[class*="marketplace-card"]` (classes are --extension/--theme/...) =
  lavender glass, `.marketplace-installButton` = the pastel gradient. README pages
  (/marketplace/readme, 2026-11-26): `.marketplace-readme__container` (--spice-main #121212)
  = lavender glass; `#marketplace-readme` gets Prism values for Marketplace's water.css
  variables (--background(-body/-alt), --border, --text-main, --links, --code...) and
  --spice-button-disabled (its table lines). Opening /marketplace/readme by History.push with a
  hand-made state crashed the main view: open it by clicking the card in the Apps tab.
  With this, every Spotify page in the sweep shows no Spotify green/grey/blue.
  SIDEWAYS SHELVES (developer spotted on Home, 2026-11-25): the edge "black shadow" is
  `.search-searchCategory-contentArea::before/::after` (#121212 at 70%) -> deep purple
  fade; the arrows `.search-searchCategory-carouselButton` -> purple glass; the card
  picture fix (`.main-cardImage-imageWrapper`, grey square behind round photos) now
  applies on EVERY themed page. The sweep can't see these (pseudo-element gradients and
  hover-only buttons), so check shelves by eye.
  SHARED SPOTIFY INSTALL: another checkout's `npm run build` (main folder, an old commit)
  silently replaced this branch's build mid-check (2026-11-25). If the theme suddenly
  looks gone everywhere, check the CustomApps file times and grep a new string first.
  Facts found: every page above has `.Root__main-view` at #121212 and no data-prism-theme;
  album/artist/Liked headers use the same `.main-entityHeader-*` + action bar +
  `.main-trackList-*` song list as playlists, and `.main-topBar-background` takes the cover
  colour. So the cheapest route is probably to reuse the playlist theme's parts (sky behind the
  view, cleared cover washes, glass top bar + column header, pastel play button) on those
  pages; Home/Search/Settings/history/genre have no song list. The colour rail and genre mix
  are playlist-only today; whether they belong on albums/Liked Songs is a design question.
  Spicetify's greens: `--spice-button(-active)` and their rgb twins (see Quiet night below).
  HOW (developer's rules): show 3-4 mockup options first (e.g. the full sky on every page vs. a
  quieter still twilight background vs. Quiet night's dark purple only), let the developer
  pick, possibly page by page; respect "UI elements" rules (new looks go in
  docs/ui-elements.md). Easiest first chunk: Liked Songs + album + artist (same layout as
  playlists).
- NEW VERSION NOTICE (2026-11-26, mockup "A" of four, developer's pick; built, not committed):
  the start page shows "Prism X is out. You have Y." (the standard Notice, `src/ui/UpdateNotice.tsx`)
  when GitHub's latest RELEASE (api.github.com/repos/hellovvn/spicetify-prism/releases/latest,
  no sign-in; drafts/pre-releases ignored) is newer than package.json's "version". Checked at most
  once a day (`prism:updateCheck`; a 404 = no release yet, also remembered). "What's new" opens the
  release page; "Not now" hides it until Spotify restarts (`prism:updateDismissed` in sessionStorage).
  Pure parts `src/update/version.ts` (+ tests/version.test.ts), fetch in `src/update/check.ts`.
  "How to update" (2026-11-26, option "B" of four, developer's pick) opens the steps in place:
  Windows = the install line (UPDATE_COMMAND in version.ts) in a Command box (.prism-command) with
  Copy; macOS/Linux = only the link to the README's Install section. "Not now" lasts only until Spotify
  restarts (sessionStorage, developer's request), so the notice shows on every Spotify start until they update.
  TO RELEASE: bump package.json "version", then publish a GitHub release tagged vX.Y.Z.
- 11: Cleanup: remove the debug hook, README, release (after 12).
  RELEASE BUILD (2026-11-26): `src/buildFlags.ts` has DEV_TOOLS (always true in git). Dev builds
  keep the `window.__prism` hook + demo screens; `npm run release` (scripts/release.mjs) flips it to
  false while it builds into release/prism (never CustomApps), always restores it, checks prism.js
  has no `.__prism` hook, and zips with Windows' tar ("/" paths; Compress-Archive's "\" paths break
  macOS/Linux unzip). The page bundle keeps the demo code, switched off.
  MARKETPLACE (2026-11-26, developer's request): listed via repo topic `spicetify-apps` +
  root `manifest.json` (name, description, preview docs/media/preview.png = mockup
  "B, collage", developer's pick of five: star + "Prism" + tagline over three glass screens (Grow,
  stats page, Northern lights playlist), frames from the docs/media clips, 1200x900,
  readme). The Marketplace can't install custom apps: it shows the README, whose Install section
  says: download the release zip, unzip into CustomApps, `spicetify config custom_apps prism`,
  apply. So every user-facing change needs a NEW GitHub Release (bump package.json version, run
  `npm run release`, attach the zip) or users never get it.
  GUIDE SITE (2026-11-26, developer's pick "E1, sidebar guide" + banner across the top of every
  page): the README was cut to ~95 lines (banner, hero clip, feature table, install, Last.fm key,
  support); the full docs live at https://hellovvn.github.io/spicetify-prism/. Pages are Markdown
  in `site/pages/` (first line `<!-- description: ... -->`), sidebar order = NAV in
  `scripts/site.mjs` (a page missing from NAV fails the build), look = `site/template.html` +
  `site/style.css` (twilight glass; on phones the sidebar is one swipeable pill row). Clips come
  from docs/media. `.github/workflows/site.yml` builds it on PRs and deploys on main (Pages source
  must be "GitHub Actions"). The Marketplace shows README.md (manifest "readme"), NOT the site, so
  the README keeps install steps. README FEATURE CARDS (2026-11-26, developer's pick): each feature in the README is a twilight SVG
  card (docs/media/cards/<id>.svg, made by `node scripts/readme-cards.mjs`) linking to its guide page,
  its clip, and ONE line + "Read the guide". No steps in the README; the Last.fm key guide lives only
  on the site (LASTFM_KEY_GUIDE_URL = lastfm-key.html). Feature changes: update the site page too.
  INSTALL SCRIPT (2026-11-26): `install.ps1` (repo root, README's one-liner `iwr -useb
  https://raw.githubusercontent.com/hellovvn/spicetify-prism/main/install.ps1 | iex`) downloads the
  LATEST release's prism-*.zip, replaces only CustomApps\prism (folder found via `spicetify -c`),
  adds prism to custom_apps if missing, runs `spicetify apply`. Re-running = update. Never run it on
  the dev machine: it would replace the dev build with the release.

## Dev loop (Claude runs this, not the developer)
- If Spotify is restarted normally (not by the watch tab), the debug port 9222 is closed and the
  smoke test can't connect: run `spicetify watch -a` again (it restarts Spotify with the debugger).
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
- BUILDING FROM A WORKTREE under `.claude\worktrees\...`: spicetify-creator puts a temp entry
  in %TEMP%, so esbuild's common folder becomes C:\Users\<you> and the always-on bundle lands
  under a `.claude` folder that its copy step (glob "*") skips: prism.js silently stays OLD.
  Build with a temp folder inside the worktree instead (bash):
  `TMP="$PWD/build-tmp" TEMP="$PWD/build-tmp" npm run build` (build-tmp is git-excluded), then
  `spicetify refresh -a` and reload. Check: grep a new CSS class in CustomApps\prism\prism.js.
- Type check: `npx -y -p typescript@5.6.3 tsc --noEmit -p .` (TypeScript isn't a local dependency;
  plain `npx tsc` fetches an unrelated package).
- TESTING SCOPE (developer's rule, 2026-11-24): while developing, test only the AFFECTED AREA:
  the unit tests for the changed code (`npx vitest run tests/<file>.test.ts`) and the smoke checks
  or a quick in-Spotify check for the screens touched. Report results either way, and say which
  parts were not tested.
  CI (2026-11-25, `.github/workflows/checks.yml`, GitHub Actions): every push to a PR and to main
  runs the type check, the FULL `npm test` (incl. writeGuard) and `npm run build-local` (into
  `dist/`, gitignored). So these no longer run by hand before a commit: after pushing, check the
  PR's CI result and push a fix if it's red. Never call a PR ready / mergeable while CI is red.
  The SMOKE TEST can't run in CI (needs Spotify on the developer's PC): the full `npm run smoke`
  still runs locally before the PR is merged (at the latest when the developer asks to merge).
  Smoke test is READ-ONLY (uses `window.__prism` debug hook in src/extensions/prism.tsx); it never
  prints the API key. Screenshots go to `smoke-output/` (gitignored; they show the user's library).
- Test fixtures in `tests/fixtures/` are real recorded Last.fm data: don't "fix" them.
- SMOKE TEST PLAYLIST (developer's rule, 2026-11-24): playlist names change all the time during
  development (e.g. Merge adds "[merged] "), so tests must NEVER find a playlist by its name or
  assume its song count. The smoke test's playlist is pinned by its Spotify ID in
  `scripts/smoke.local.json` (gitignored: `{ "playlistUri": "spotify:playlist:..." }`; now a
  39-song playlist on 2026-11-24, after the old pinned one left the library); its name and song count
  are read live. Picker rows carry `data-uri` so tests can click them by ID.
- BUILDING: never run `npm run build` while `spicetify watch -a` is running: both touch the
  CustomApps folder, the build crashes half-way (Node error after "Moving files out of folders")
  and Spotify then shows "not found" for every custom app. Stop the watcher, build, then
  `spicetify refresh -a` and reload. Check the build's last line says "Build succeeded."
- CLOSE THE WATCHER WHEN DONE (developer's rule, 2026-11-24): once the change is committed and
  pushed (merged into main), stop `spicetify watch -a` / `spicetify watch -e` (and any
  `npm run watch`) that this chat started, so no stray watcher blocks the next chat's build.
- `window.__prism` debug hook is dev-only (src/buildFlags.ts); release zips never include it.

## UI elements (developer's rule, 2026-11-23)
`docs/ui-elements.md` is the catalogue of every UI element: how to make it, how it looks, how it
behaves. The goal is a consistent app. Rules:
1. REUSE: whenever an element already exists (button, checkbox, chip, row, panel, input, menu,
   pop-up...), use it exactly as the catalogue says (same class or component). No one-off
   inline restyles.
2. NEW ELEMENT: before adding any UI element that isn't in the catalogue, STOP and tell the
   developer. Show mockup options and get their OK on the design. Then build it, add it to
   the catalogue, and use that same design every time it appears after that.
3. CHANGING AN ELEMENT: if a request would change how an existing element looks or behaves
   (even as a side effect, even on one screen), STOP before building and say so. Name the
   element, what would change, and every place that uses it. The developer then picks:
   (a) change the element everywhere (update the catalogue and add a History line), (b) add a
   new documented variant/version of the element, or (c) don't change it.
4. Keep `docs/ui-elements.md` up to date in the same change as the code.
5. BRANCHES MAY EXPERIMENT: a feature branch can try designs that differ from the catalogue
   (a better look may turn up during development). Mark them in the catalogue as OPEN with
   what they differ from. BEFORE merging into main, every OPEN difference must be shown to the
   developer and decided (keep the standard, adopt the new design everywhere, or keep both as
   documented variants). main only ever has one decided design per element.

## Working style
- Keep explanations short: a few lines on what changed and why. No need to teach basic
  concepts unless asked.
- Do one step of the build plan at a time, then stop so the developer can test it.
- Prefer simple, readable code over clever code. Add unit tests for pure logic.
- For visual/UI changes: show 3-4 clearly different mockup options first (an interactive widget,
  animated if motion matters), let the developer pick, then build it and check it with zoomed
  real-pixel screenshots. Their taste: purple "twilight" theme, frosted/liquid glass, soft pastel
  rainbow accents, subtle motion, consistent sizes across screens, no faces/mascots.
- Claude reloads Spotify itself before handing over; never ask the developer to press Ctrl+Shift+R.
- Say clearly what was verified and what wasn't.

## Git
- "Commit" means commit AND push to the chat's own branch (its PR), not to `main`.
- No `Co-Authored-By` or other AI attribution lines in commit messages or PR descriptions.
- On Windows PowerShell 5.1, write the message to a file and use `git commit -F <file>`:
  double quotes inside `-m "..."` get mangled and the commit can fail silently.
  Afterwards check that `git rev-parse HEAD` matches the pushed branch on `origin`.

## One PR per chat
- Every chat that changes files works on its own branch and has exactly ONE pull request.
  Open it as a draft with the first commit (`gh pr create --draft`), then link it to the chat
  (ccd_pr `bind_pr`) so the app shows its number, title and status (draft / open / merged /
  closed).
- Name the chat after its PR: `#<number> <PR title>` (e.g. "#12 Themes picker in Settings").
- The PR title says in plain words what the chat is doing. If the task changes while
  developing (new scope, different fix, a step dropped), rename the PR right away
  (`gh pr edit <number> --title "..."`) and rename the chat to match. Update the PR
  description too if it no longer fits.
- Mark the PR ready for review once the developer has tested it. Only merge when the
  developer asks.
