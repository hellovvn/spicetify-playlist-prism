# Prism (Spicetify extension)
Repo: github.com/hellovvn/spicetify-prism, folder Documents\Projects\spicetify-prism.

## Goal
Prism is a Spotify companion that helps people get more out of the music they already
have: grow a fresh playlist from a favourite song, remix messy playlists into tidy ones
by genre and mood, and see what each playlist is made of, all inside a page that feels
nicer than plain Spotify. It works from the user's own library (never touching existing
playlists) and judges songs on **song-level** signals (see "Scoring signals"), not
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
  was in Liked Songs, and the user wanted their own songs. (Later the developer asked for
  new songs too: that is 14e DISCOVER, via Last.fm similar songs, NOT Song Radio.)

## Hard rule: never modify existing playlists
- Never add to, remove from, reorder, rename, or delete any existing playlist or Liked Songs.
- The only write allowed is: create a new playlist, then add tracks to **that new playlist's URI**.
- All write calls live in one module (`src/spotify/write.ts`). Every function there
  asserts that the target URI equals the playlist created in the same session.
- Code review checklist item: grep for any other write call before merging.
- ONE EXCEPTION (developer's decision, 2026-11-23): MERGE PLAYLISTS may RENAME the playlists
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
  `PlaylistAPI.add` targeting the URI we just created, plus Merge's `[merged] ` rename
  (`PlaylistAPI.updateDetails(uri, { name })`, see the hard rule's one exception).
- Never call: `PlaylistAPI.remove/move/setAttributes/clearAttributes/uploadImage`
  (or `updateDetails` for anything but Merge's rename),
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

## Name
The app is called "Prism" everywhere users see it (src/settings.json displayName, page
title, Settings title, profile-menu item, messages). For now, internal ids stay
"playlist-prism" (custom app nameId, storage keys "prism:*", data-prism attributes, the
`[Playlist Prism]` console prefix), so saved settings and playlists keep working.
The start page has no "What would you like to do?" heading any more (Prism will start
changing playlist contents in the future, so its "never changed" line no longer holds).

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
    tags of 4+ words. Real data (Liked Songs + Dark Romance, 250 songs): grouping ~0.15 s, Auto
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
  - 14d NEW VIEW: the playlist and its lyrics side by side, so the user can see the playlist
    while singing along. Never store or log lyrics text.
  - 14e DISCOVER in Prism playlists: BUILT 2026-11-23 (not committed; smoke-tested, waiting for
    the developer's test). Similar songs NOT in the user's library ("New finds"), only ever
    added to the NEW playlist.
    Spike (6 seeds, 763-song library): Last.fm `track.getSimilar` gave 30 for every seed;
    118/120 found on Spotify by exact title + artist; ~6% already in the library; the top 1-3
    are usually the seed's own artist, so MAX_PER_ARTIST = 2.
    Pipeline (`findNewSongs` in flow.ts, pure parts in `src/discover/discover.ts` + tests):
    track.getSimilar (50; fallback artist.getSimilar 10 x artist.getTopTracks 3) -> drop the
    seed and anything in the WHOLE library (Liked + every playlist, songKey) -> up to 40
    candidates -> Last.fm tags (must share a kept tag, same rule as every Prism song) ->
    Spotify search (`src/spotify/search.ts`, GraphQL `searchModalResults`; other search
    definitions fail) -> BPM/key -> same scoreSong (lyrics mood unknown). Cached per seed + tags
    for the session. ~36 found for "Often" in the smoke test.
    UI (developer's picks): layout "A" = one best-first list with library songs; a "New finds"
    chip row Off/5/10/20 (default 10, saved as `prism:growNewCount`) under the songs count;
    rows = mint glass ("S2", .prism-new-find) + "✦ New find" pill + 3 twinkling sparkles round
    the score ring ("S1", .prism-sparkle, still with reduced motion). Tooltip says Last.fm's
    similarity. RankedSong.newFind marks them.
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
  ("lestappencore") and personal labels vanish everywhere, including old records.
- SIDE PANEL STATS: shown for Prism-made/organized playlists. It only covers the panel while it shows Now Playing
  (never the queue). Pure parts are in `src/ui/sidePanel.ts` (tested; NOT "panelStats.ts", which
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
- PAGE HEADER ICON (PrismIcon in PrismIcon.tsx, mockup "H2 + sparkles"): glass diamond with a
  pastel rainbow edge + facet lines, and 3 sparkles that twinkle in turn
  (.prism-head-sparkle). The Spotify top-bar icon (src/assets/prism.svg) is unchanged.
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
  ("kept \"Snooze\" from Dark Romance", or "already in …" for the same URI). Data: `dropped` from mergeSongs.
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
  for instant on/off only; checkboxes stay for picking), "✦ Tone", the tone's labels and Edit.
  NO summary text (developer removed it): `stripStatus` only says "Scoring songs: 12 of 39…"
  while the rings load, or "Couldn't score the songs". Edit opens the SAME ToneEditor
  (variant "popup": Cancel instead of Back) in a wide pop-up over the playlist
  (`src/ui/tonePopup.tsx`, host inside .Root__main-view, overlay has `prism-cosmos` for Prism's
  colours); right-click > Prism tone still opens it on the Prism page. Pure strip/ring helpers
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
- PLAYLIST THEMES (2026-11-24, developer's picks after mockup rounds D-H; not committed yet,
  waiting for the developer's test). Settings > "Playlist theme": No theme (default) /
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
  This covers part of 14a (themes); 14a's per-page theme picker is still open.
- 15 (to-do): rename the internal ids from "playlist-prism" / "Playlist Prism" to just "prism"
  (custom app nameId and folder, `window.__playlistPrism` hook, `[Playlist Prism]` console
  prefix, "playlist-prism:*" window events, the header icon's aria-label). Storage keys are
  already "prism:*". The nameId change needs a `spicetify config custom_apps` swap + apply,
  and the smoke test's selectors must follow.
- 11: Cleanup: remove the debug hook, README, release (after 12).

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
  `spicetify refresh -a` and reload. Check: grep a new CSS class in CustomApps\playlist-prism\prism.js.
- Type check: `npx -y -p typescript@5.6.3 tsc --noEmit -p .` (TypeScript isn't a local dependency;
  plain `npx tsc` fetches an unrelated package).
- TESTING SCOPE (developer's rule, 2026-11-24): while developing, test only the AFFECTED AREA:
  the unit tests for the changed code (`npx vitest run tests/<file>.test.ts`) and the smoke checks
  or a quick in-Spotify check for the screens touched. The FULL run (`npm test` + `npm run smoke`)
  happens only when the developer confirms a commit, before committing. Report results either way,
  and say which parts were not tested.
  Smoke test is READ-ONLY (uses `window.__playlistPrism` debug hook in src/extensions/prism.tsx); it never
  prints the API key. Screenshots go to `smoke-output/` (gitignored; they show the user's library).
- Test fixtures in `tests/fixtures/` are real recorded Last.fm data: don't "fix" them.
- SMOKE TEST PLAYLIST (developer's rule, 2026-11-24): playlist names change all the time during
  development (e.g. Merge adds "[merged] "), so tests must NEVER find a playlist by its name or
  assume its song count. The smoke test's playlist is pinned by its Spotify ID in
  `scripts/smoke.local.json` (gitignored: `{ "playlistUri": "spotify:playlist:..." }`; now the
  "Dark Romance", 39 songs on 2026-11-24, after the old pinned one left the library); its name and song count
  are read live. Picker rows carry `data-uri` so tests can click them by ID.
- BUILDING: never run `npm run build` while `spicetify watch -a` is running: both touch the
  CustomApps folder, the build crashes half-way (Node error after "Moving files out of folders")
  and Spotify then shows "not found" for every custom app. Stop the watcher, build, then
  `spicetify refresh -a` and reload. Check the build's last line says "Build succeeded."
- CLOSE THE WATCHER WHEN DONE (developer's rule, 2026-11-24): once the change is committed and
  pushed (merged into main), stop `spicetify watch -a` / `spicetify watch -e` (and any
  `npm run watch`) that this chat started, so no stray watcher blocks the next chat's build.
- `window.__playlistPrism` debug hook must be removed or dev-only before any public release.

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
