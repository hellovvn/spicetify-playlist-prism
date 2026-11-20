# Playlist Prism (Spicetify extension)

## Goal
Build a NEW Spotify playlist around the vibe of 1–2 "seed" songs, using
**song-level** genre/mood tags (Last.fm `track.getTopTags`), not Spotify's
artist-level genres.

## User flow
1. Right-click a song, then choose **Start a Prism playlist** (option to add a second seed).
2. Fetch and clean the seed songs' tags, then show them as toggleable chips.
3. The user turns off any tags they don't want.
4. The user picks source playlists and/or Liked Songs.
5. Scan the sources, score each candidate against the selected tags, and show a preview
   with each song's score and the tags it matched.
6. The user confirms, and the extension creates a **new** playlist with those songs.

## Hard rule: never modify existing playlists
- Never add to, remove from, reorder, rename, or delete any existing playlist or Liked Songs.
- The only write allowed is: create a new playlist, then add tracks to **that new playlist's URI**.
- All write calls live in one module (`src/spotify/write.ts`). Every function there
  asserts that the target URI equals the playlist created in the same session.
- Code review checklist item: grep for any other write call before merging.

## Stack
- Spicetify Creator (`npx create-spicetify-app`), TypeScript, React
- Data: Last.fm API (`track.getTopTags`, fallback `artist.getTopTags`)
- Spotify access: `Spicetify.Platform.*` / `Spicetify.CosmosAsync` (Spotify client's own auth)
- Tests: Vitest for pure functions (tag cleanup, scoring, title normalization)

## Commands
```powershell
npm install            # first time
npm run watch          # rebuild on save (keep running while developing)
spicetify watch -e     # in a 2nd terminal: reload Spotify when the extension changes
npm run build          # one-off build, copies to the Spicetify Extensions folder
spicetify apply        # apply after first build or config changes
npm test               # unit tests (once Vitest is added)
```
First-time registration: `spicetify config extensions playlist-prism.js` and then `spicetify apply`.

## Secrets
- The Last.fm API key is entered by the user in a settings field and stored in
  `Spicetify.LocalStorage` (key `prism:lastfmKey`). Never hardcode it or commit it.

## Code layout (planned)
- `src/lastfm/`: API client, throttle, cache
- `src/tags/`: cleanup and normalization (pure, unit-tested)
- `src/scoring/`: match scoring (pure, unit-tested)
- `src/spotify/`: read helpers and the single write module
- `src/ui/`: React components (chips, playlist picker, preview)

## Working style
- **Explain what you change and why**,
  including any new concepts (APIs, React patterns, TypeScript features).
- Work in **small steps**. Do one step of the build plan at a time, then **stop** so the
  developer can test it before moving on.
- Prefer simple, readable code over clever code. Add unit tests for pure logic.
- Say clearly what was verified and what wasn't.
