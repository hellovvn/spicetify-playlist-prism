# Prism UI elements

The approved look and behaviour of every UI element in Prism. **Use this file as the
source of truth.** Reuse an element exactly as described here. Don't restyle one copy of
it. The rules for changing or adding elements are in CLAUDE.md under "UI elements".

- CSS lives in `src/ui/styles.ts`. Colours, glass and hover are CSS variables
  (`--prism-*`) on `.prism-cosmos`, so a theme only swaps the variables.
- "Approved" is the date the developer agreed to the design. "v2" and later mark changes
  they approved later. The older version is kept in the History section at the bottom.

## Shared basics (apply to every element)

| Basic | Value |
|---|---|
| Accent | `--prism-accent` #b794ff (main buttons, ticked boxes, chosen option); hover #c6a8ff |
| Soft accent | `--prism-accent-soft` #cdb8ff (rims, focus rings, quiet buttons) |
| Text on accent | `--prism-on-accent` #1b0b33 |
| Error text | `--prism-error` #ffb3d1 |
| Picked big tile | `--prism-picked` #f4c0d1 + `--prism-picked-glow` (pink edge, soft inner pink glow). Pink means ONLY "you picked this tile" |
| New finds | `--prism-new` #9fe1cb (mint) |
| Glass | control `--prism-glass-control`, box `--prism-glass-panel`, rim `--prism-rim`, top shine `--prism-shine` |
| **Hover (one look for everything clickable)** | rim `--prism-hover-rim` + glow `--prism-hover-glow`, 150 ms (`--prism-ease`). Press: scale 0.97 |
| Lift | only clickable CARDS also move up 2px on hover |
| Focus (keyboard) | 2px #cdb8ff outline, 2px offset |
| Corners | pop-up 20, box/card/tile/header 16, input 12, notice 12, list row 8, album art 4, pills 999 |
| Text sizes | screen title 22 light, section heading 13 bold, body 13-14, small 12; stats: summary values 24, panel headline 16, bar counts 13 |
| Disabled | opacity 0.45-0.5, no hover |
| Reduced motion | every looping or entrance animation stops; things stay usable |

## Buttons (approved 2026-11-23)

| Element | How to make it | Look | Behaviour |
|---|---|---|---|
| Main button | Spotify `ButtonPrimary` inside the page | Solid lavender pill, dark text, 48px | Hover: lighter lavender + soft glow, NO growing. Press 0.97. One per screen |
| Secondary button | Spotify `ButtonSecondary` | Glass pill, white text. 48px in an action row (`.prism-actions`), 32px elsewhere | Standard hover/press |
| Glass button (outside Spotify's buttons) | `.prism-glass-button` | Same as the 32px secondary button | Same |
| Quiet button | `.prism-quiet-button` | Lavender text, no box | Hover: text turns white |
| Show/hide list (approved 2026-11-24, mockup "A") | A quiet button "▾ Show …" / "▴ Hide …" (`aria-expanded`, `aria-controls`) right after the line it explains; the list opens IN PLACE below it as a `.prism-glass-panel` of `.prism-row`s, max ~190px then scrolls inside | Same as the quiet button; the list is a still glass box | Click toggles; content below moves down. Starts closed. Used for Merge's duplicates |
| Icon button | `.prism-icon-button` | 28px glass circle, e.g. × | Standard hover/press |
| Action row | `.prism-actions`, right-aligned, at the bottom of a screen | Secondary buttons first, main button last | Always in the same place on a screen |

## Choosing things

| Element | How to make it | Look | Behaviour |
|---|---|---|---|
| Toggle (approved 2026-11-24, tone strip "E") | `<button type="button" className="prism-toggle" role="switch" aria-checked>` (CSS in styles.ts) | 34x20 pill track with a 14px white knob. Off: clear glass track, knob left. On: lavender track, knob right | Takes effect AT ONCE. Standard hover rim + glow; knob slides 150 ms (none with reduced motion); press stretches the knob. Use ONLY for instant on/off; picking things and yes/no on a confirm screen stay the checkbox. Used by: the tone strip (Settings' On/Off still use the segmented choice) |
| Checkbox (v2, approved 2026-11-23) | `<input type="checkbox" className="prism-checkbox">` inside a `<label>` | 18px glass square, 5px corners. On: lavender with a WHITE tick and a glow. Some: white dash. Locked: `<span className="prism-checkbox is-locked">`, dimmed | Standard hover. The whole `<label>` toggles it. The ONLY checkbox in the app (lists and single yes/no settings alike) |
| Door tile (pick ONE big path) | `.prism-glass-panel.prism-door` (+ `.on`), Remix's "Sort them for me" / "I'll pick the vibes" | Big glass tile | Hover: standard + 2px lift. Picked: `--prism-picked` pink edge + inner glow |
| Segmented choice (pick ONE) | `.prism-seg` holding `<button className="on">` with `aria-pressed` | Glass pill split into parts; the chosen one is lavender | Hover on unchosen parts: faint white. Used for counts, On/Off settings, "Group mostly by" |
| Tag switch (pick MANY) | `.prism-tag.prism-tag-pick` (+ `.shared` when on, + `.mood` for moods) | Frosted pill with a colour dot. On: bright lavender. Off: faint with a dim dot. Seed screen adds `.prism-tag-big` (13px) | Standard hover. `role="checkbox"`+`aria-checked`, or `aria-pressed` |
| Drop-down menu | `GlassMenu` component (`src/ui/GlassMenu.tsx`) | Small glass pill with ▾. Its list is a dark glass card | Standard hover. The list is a portal in `<body>`. Never use a native `<select>` |
| Text box | `.prism-glass-input` | Glass, 12px corners, faint placeholder | Focus: lavender rim + 3px lavender halo |

## Showing things

| Element | How to make it | Look | Behaviour |
|---|---|---|---|
| Tag label (read-only) | `.prism-tag` (+ `.shared` for tags the seed shares, `.wrap` next to bars, `.mood` dashed) via `TagLabels` | Frosted pill, colour dot from `tagColour`/`tagColours` (genre) or `moodColour` (mood) | Not clickable |
| List row | `.prism-row` (+ `.is-clickable`, `.is-glass` for the seed, `.is-head` for "Select all") | 8px corners, thin line between rows | Clickable rows: faint white hover |
| New find row | `.prism-row` + `.prism-new-find`, `.prism-new-pill` "✦ New find", `.prism-sparkle` round the score ring | Mint glass | Sparkles twinkle (they stay visible but still with reduced motion) |
| Score ring | `ScoreRing` in PreviewScreen | 52px ring, lavender-to-pink arc, % in the middle | Static |
| Tone ring (approved 2026-11-24, mockup "A") | `ringSvg` in `src/ui/toneRows.ts`, a `.prism-tone-ring` span put into Spotify's own track rows (before the duration) | The score ring at 32px: lavender-to-pink arc, % (no sign) in the middle. Rough guess (no Last.fm tags, mood + tempo only): the same ring at half strength ("faded ring", developer's pick). Not scored: dashed ring with "–" | Tooltip says the % and what fits / is off ("~58% … a rough guess" for faded ones). Songs under 50% get a GREY ring (grey arc and %); the song's row is never faded |
| Tone strip (approved 2026-11-24, mockup "E") | `[data-prism-tone-strip]` div put right after Spotify's playlist action bar row (`src/ui/toneRows.ts`, own CSS: outside the Prism page) | Slim glass band (12px corners, faint lavender glass): Toggle, "✦ Tone", the tone's labels as read-only tag labels (4 max, then "+N", then "slow tempo"), quiet "Edit" button at the right end (opens the tone editor in a wide pop-up over the playlist) | Toggle (or clicking "✦ Tone") shows/hides the rings. Only while they load: "Scoring songs: 12 of 39…" before Edit (or "Couldn't score the songs"). No summary text (removed at the developer's request; the overall fit is the stats page's "Tone fit"). Edit opens the tone editor. Only on playlists with a tone |
| Colour rail (approved 2026-11-24, mockups H1-H3) | `.prism-rail` span put into each of Spotify's playlist rows (on the outer `[role="row"]`), `src/ui/playlistTheme.ts` | 6px bar at the row's left edge in the song's main genre colour (`genreColours` = `tagColours`, most common genre first) with a soft glow; the parts touch, so it reads as one rail; rounded ends on the first/last song. Not scanned yet: faint lavender, no glow | The playing song's part pulses (2 s). Tooltip = the genre. Only with a playlist theme on; the playlist's own songs only (not "Recommended") |
| Library panel theme (approved 2026-11-24, mockup rounds 1-4) | `src/ui/libraryTheme.ts` (always-on; pure colours/HTML in `src/theme/libraryTheme.ts`) | With a playlist theme on, Spotify's left panel ("Your Library") gets a STILL background: Northern lights and Bubble nebula = "top glow" (deep twilight, soft theme-colour glow at the top), Starry night = "rising dusk" (dark top, lighter purple bottom). Spotify's green there becomes Prism pink | Only the OPEN playlist's row (`aria-selected="true"`) moves: a `.prism-lib-sky` layer behind its text with a lavender rim. Northern lights = two soft mint/lavender veils drifting; Starry night = twinkling sparkle stars; Bubble nebula = drifting clouds + rising bubbles. Reduced motion: still |
| Library row hover, "rainbow edge" (approved 2026-11-24, mockup option 4) | CSS in `src/ui/libraryTheme.ts` (on Spotify's `[data-encore-id="listRow"]`: glass on its `::after`, bar on its `::before`) | Light lavender glass, a 3px pastel rainbow bar (pink, lavender, mint) with a soft glow at the row's left | With a playlist theme on, EVERY row in Your Library (Prism-made or not) gets it on hover and slides 3px right (no slide with reduced motion). With No theme, every row keeps Spotify's grey hover (the old Prism-only purple hover was removed) |
| Genre mix bar (approved 2026-11-24) | `[data-prism-genre-mix]` after Spotify's header metadata row (`src/ui/playlistTheme.ts`) | 260px x 12px glass pill split by the top 5 main genres (+ lavender "other"), 12px caption "jazz 21% · pop 14% … (from 28 of 39 songs)" | Static. Nothing scanned: caption only. Only with a playlist theme on |
| Panel / box | `.prism-glass-panel` | Glass, 16px corners | Static |
| Clickable card | `.prism-glass-panel` + `.prism-builder-group` | Glass card | Standard hover + 2px lift. Chosen group (`.on`): `--prism-picked` pink edge + inner glow |
| Group card (Remix, "door tile" look) | `.prism-glass-panel.prism-group-card` | Wide glass tile with album covers | Standard hover + 2px lift |
| "Not included" card | `.prism-group-card.prism-left-card` | Dashed edge, less fill | Hover: lavender edge + 2px lift |
| Album-cover mosaic | `CoverMosaic` | 2x2 album art | Static |
| Stat card | `StatCard` in StatsScreen | Glass panel, 12px label, 24px value | Static. "Tone fit" (a playlist with a tone) is a 5th card in the same row, breakdown on hover; in the side panel it's a 5th number cell spanning the row |
| Bar (stats) | `.prism-bar-track` + `.prism-bar-fill` with `--tag` | 14px glass track, glossy bar in the genre colour | Bars grow in one after another |
| Progress bar | `.prism-progress` + `.prism-progress-fill` | 10px glass track, pastel rainbow fill | Width animates 300 ms |
| Fingerprint bubbles | `Fingerprint` | See-through bubbles in the genre colour | Float + wobble; click pops (droplets), back after 3 s |
| Cover ring | `.prism-artwork` | Cover inside a moving pastel neon ring | Ring turns (3.5 s) |
| Notice | `.prism-notice` | Glass box, 12px corners, rainbow bar on the left | Used for tips, warnings and errors (`role="status"` / `alert`) |
| Error line | inline text in `--prism-error` pink | Small pink text | |
| Inline confirm bar | Text + two secondary buttons in a dark purple strip (leave scan, combine groups) | Says what will happen | Asks before anything destructive |
| Pop-up | `.prism-overlay` + `.prism-glass-card` (`role="dialog"`) | Dimmed, blurred page with a glass card (20px corners) | Rises in |
| Wide pop-up (variant, 2026-11-24) | `.prism-glass-card.is-wide` (up to 760px, at most the view's height). Outside the Prism page the overlay also gets `prism-cosmos` so Prism's colours apply (`src/ui/tonePopup.tsx`) | Same as the pop-up, wider: for a whole editor, not a quick question | Rises in. Escape, a click on the dim area, Cancel or opening another page closes it. Used by: the tone editor from the tone strip's Edit |
| Screen title | `.prism-screen-title` | 22px light Segoe UI Variable Display, white | |
| Section heading | `.prism-heading` | 13px bold, light lavender | |

## Page-level pieces

| Element | Where | Notes |
|---|---|---|
| Twilight background | `.prism-cosmos` (PrismPage, side panel) | Gradient, drifting glows, rainbow light waves, sparkles |
| Header | `.prism-header` + `PrismIcon` | Glass bar, diamond icon with twinkling sparkles, title, 32px secondary buttons |
| Start tiles | `FlipTile` + `HomeIcons` | The ONLY place with the rainbow-swirl hover. Click flips to details, which have a quiet "← Back" |
| Start bar (approved 2026-11-23, mockup "B") | `button.prism-home-bar` + `MergeIcon` (HomeIcons), under the start tiles | Wide glass card (tile glass, 16px corners, min 64px tall): still matte icon, 15px label, one 13px line. Standard hover + 2px lift, press 0.97, NO flip and NO rainbow swirl. Used for Merge playlists |
| Loading | `.prism-spinner` (small), `ScanningPrism` (scan) | Spinner ring; big diamond with a star halo while scanning |
| Side-panel stats | `PanelStats` | Same elements as the stats page, compact |
| Playlist themes (approved 2026-11-24, mockups H1/H2/H3) | `.prism-pl-sky` behind Spotify's playlist pages (`src/ui/playlistTheme.ts`), picked in Settings with a segmented choice | "Northern lights": soft blurred aurora streaks (mint edge, violet/pink tops) swaying over a night sky. "Starry night": four-point sparkle stars at random spots, each moving somewhere new after it fades. "Bubble nebula": slow pastel clouds, tiny stars and rising glass bubbles. Spotify's cover-colour washes are cleared; while scrolling, the top bar and the song list's sticky column header are the same nearly solid twilight glass (Spotify paints the header grey). Spotify's green turns Prism: play buttons get the pink-to-lavender gradient with a dark purple triangle; liked ticks, the playing title and toggled icons turn pink; the playing equaliser is hue-shifted to pink. Densities scale with the window size. Reduced motion: still |
| Spotify's bars, "Quiet night" (approved 2026-11-24, mockup "C") | `src/ui/chromeTheme.ts`, CSS on while `<html data-prism-chrome>` (any playlist theme on), on EVERY page | Top bar, player bar and the gaps between panels #0b0817; right-hand panel #151029 with #1d1638 cards; top-bar buttons and search box #1d1638. Spotify's green there turns Prism: play/pause gets the pink-to-lavender gradient (dark purple icon), progress and volume fills the same gradient, toggled icons and the liked tick pink. "Playing on iPhone" = no green band: a 3px pastel rainbow line along its bottom with lavender text | Still (no motion). Off with "No theme" |
| Top-bar icon | `src/assets/prism.svg` + `headerIcon.ts` | Spotify's top bar; spins on hover with a star halo and rainbow ring |

## History

- 2026-11-24: NEW "Quiet night" look for Spotify's bars (top bar, right-hand panel, player bar,
  "Playing on ..." strip), mockup "C" of four. Follows the playlist theme switch.

- 2026-11-24: NEW Library panel theme (still background, moving open-playlist row, Liked Songs
  included) and Library row hover "rainbow edge" for every row while a theme is on. REMOVED the
  purple-with-rainbow-rays hover on Prism playlists in the sidebar (developer's request).

- 2026-11-24: NEW playlist themes (sky behind Spotify's playlist pages), Colour rail and Genre
  mix bar (mockups H1/H2/H3). Settings' segmented choice now also has a 4-option use
  ("No theme / Northern lights / Starry night / Bubble nebula").

- 2026-11-24: Tone ring: songs under 50% no longer fade their whole row; the ring turns grey
  instead (developer's request).
- 2026-11-24: Pop-up got a WIDE variant (`.is-wide`) for the tone editor opened from the tone
  strip's Edit (it used to open the Prism page).
- 2026-11-24: NEW Toggle (instant on/off, `.prism-toggle`) and Tone strip (mockup "E"), which
  replaced the first "✦ Tone" pill switch. Tone ring got the faded "rough guess" look. Stat
  card: "Tone fit" as a 5th card. Later the same day the strip's summary line ("59% tone fit ·
  19 of 28 songs fit · 9 drift · 9 rough guesses") was removed (developer's request).
- 2026-11-24: NEW Tone switch and Tone ring (playlist tones, mockup "A").

- 2026-11-24: NEW Show/hide list (quiet button + in-place glass list) for Merge's duplicates.

- 2026-11-23: NEW Start bar (`.prism-home-bar`) for Merge playlists. The playlist picker
  (`SourcePicker`) got an optional `minPicked` (default 1, so Grow and Remix are unchanged;
  Merge needs 2).

- 2026-11-23 (v2, developer's decisions): ONE checkbox, the square, now with a WHITE tick
  (the Remix round bubble is gone; "Start names with Prism" uses the square). Cards: standard
  lavender hover; PINK only for a picked big tile (Remix doors, chosen builder group). Before:
  dark tick; group cards had a pink hover; the chosen builder group was lavender.
- 2026-11-23: merged with the Remix "two doors" work, which added a round check bubble,
  door tiles and a pink hover on group cards. These differ from v1 and are marked OPEN until
  the developer decides. The v1 checkbox class was renamed `.prism-check` -> `.prism-checkbox`
  because the bubble already uses `.prism-check`.
- 2026-11-23: v1 of every element above (UI standardization). Before this, buttons,
  checkboxes, hover, inputs, corners and titles came in several styles.
