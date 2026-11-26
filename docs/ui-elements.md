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
| Glass button (outside Spotify's buttons) | `.prism-glass-button` | Same as the 32px secondary button | Same. Also works on an `<a>` that leaves for the browser (add inline-flex + no underline): Settings' "Support Prism" (Ko-fi) with a 15px outline cup icon |
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
| Segmented choice, PILLS variant (approved 2026-11-25, picker "D") | `.prism-seg.is-pills` (same buttons) | Each option is its own glass pill (6px gaps), wrapping onto more lines; the chosen one is lavender with dark text | Same as the segmented choice. For long lists: the playlist themes in Settings |
| Theme preview strip (approved 2026-11-25, picker "D") | `ThemeStrip` (`src/ui/ThemeStrip.tsx`), `.prism-theme-strip` | A wide 72px strip (12px corners, faint rim) under the theme pills, showing the chosen theme's REAL moving sky (`buildSky`). No theme: Spotify's grey with "Spotify's own look" | Swaps at once when a pill is picked |
| Tag switch (pick MANY) | `.prism-tag.prism-tag-pick` (+ `.shared` when on, + `.mood` for moods) | Frosted pill with a colour dot. On: bright lavender. Off: faint with a dim dot. Seed screen adds `.prism-tag-big` (13px) | Standard hover. `role="checkbox"`+`aria-checked`, or `aria-pressed` |
| Drop-down menu | `GlassMenu` component (`src/ui/GlassMenu.tsx`) | Small glass pill with ▾. Its list is a dark glass card | Standard hover. The list is a portal in `<body>`. Never use a native `<select>` |
| Text box | `.prism-glass-input` | Glass, 12px corners, faint placeholder. As a number box (`type="number"`) it has NO up/down arrows | Focus: lavender rim + 3px lavender halo. Number box: type, or arrow keys / scroll wheel |
| Multi-line text box (approved 2026-11-25 with the report form, mockup "B") | `<textarea className="prism-glass-input is-multiline">` | The text box's glass, 14px text, 1.45 line height, min 44px; `rows` sets the start height | Same focus as the text box. Can be made taller by dragging its bottom edge (never wider). Used by: the report form |

## Showing things

| Element | How to make it | Look | Behaviour |
|---|---|---|---|
| Tag label (read-only) | `.prism-tag` (+ `.shared` for tags the seed shares, `.wrap` next to bars, `.mood` dashed) via `TagLabels` | Frosted pill, colour dot from `tagColour`/`tagColours` (genre) or `moodColour` (mood) | Not clickable |
| List row | `.prism-row` (+ `.is-clickable`, `.is-glass` for the seed, `.is-head` for "Select all") | 8px corners, thin line between rows | Clickable rows: faint white hover |
| New find row | `.prism-row` + `.prism-new-find`, `.prism-new-pill` (Prism star + "New find") | Mint glass | The pill's star twinkles. No sparkles round the score ring (removed 2026-11-24) |
| Score ring | `ScoreRing` (`src/ui/ScoreRing.tsx`, re-exported by PreviewScreen) | 52px ring, lavender-to-pink arc, % in the middle | Static. Used by: Grow preview rows, Add with Prism page, the side panel's tone fit |
| Tone ring (approved 2026-11-24, mockup "A") | `ringSvg` in `src/ui/toneRows.ts`, a `.prism-tone-ring` span put into Spotify's own track rows (before the duration) | The score ring at 32px: lavender-to-pink arc, % (no sign) in the middle. Rough guess (no Last.fm tags, mood + tempo only): the same ring at half strength ("faded ring", developer's pick). Not scored: dashed ring with "–" | Tooltip says the % and what fits / is off ("~58% … a rough guess" for faded ones). Songs under 50% get a GREY ring (grey arc and %); the song's row is never faded |
| Tone strip (approved 2026-11-24, mockup "E") | `[data-prism-tone-strip]` div put right after Spotify's playlist action bar row (`src/ui/toneRows.ts`, own CSS: outside the Prism page) | Slim glass band (12px corners, faint lavender glass): Toggle, "✦ Tone", the tone's labels as read-only tag labels (4 max, then "+N", then "slow tempo"), quiet "Edit" button at the right end (opens the tone editor in a wide pop-up over the playlist) | Toggle (or clicking "✦ Tone") shows/hides the rings. Only while they load: "Scoring songs: 12 of 39…" before Edit (or "Couldn't score the songs"). No summary text (removed at the developer's request; the overall fit is the stats page's "Tone fit"). Edit opens the tone editor. Only on playlists with a tone |
| Colour rail (approved 2026-11-24, mockups H1-H3) | `.prism-rail` span put into each of Spotify's playlist rows (on the outer `[role="row"]`), `src/ui/playlistTheme.ts` | 6px bar at the row's left edge in the song's main genre colour (`genreColours` = `tagColours`, most common genre first) with a soft glow; the parts touch, so it reads as one rail; rounded ends on the first/last song. Not scanned yet: faint lavender, no glow | The playing song's part pulses (2 s). Tooltip = the genre. Only with a playlist theme on; the playlist's own songs only (not "Recommended") |
| Library panel theme (approved 2026-11-24, mockup rounds 1-4) | `src/ui/libraryTheme.ts` (always-on; pure colours/HTML in `src/theme/libraryTheme.ts`) | With a playlist theme on, Spotify's left panel ("Your Library") gets a STILL background: Northern lights and Bubble nebula = "top glow" (deep twilight, soft theme-colour glow at the top), Starry night = "rising dusk" (dark top, lighter purple bottom). Spotify's green there becomes Prism pink | Only the OPEN playlist's row (`aria-selected="true"`) moves: a `.prism-lib-sky` layer behind its text with a lavender rim. Northern lights = two soft mint/lavender veils drifting; Starry night = twinkling sparkle stars; Bubble nebula = drifting clouds + rising bubbles. Reduced motion: still |
| Library row hover, "rainbow edge" (approved 2026-11-24, mockup option 4) | CSS in `src/ui/libraryTheme.ts` (on Spotify's `[data-encore-id="listRow"]`: glass on its `::after`, bar on its `::before`) | Light lavender glass, a 3px pastel rainbow bar (pink, lavender, mint) with a soft glow at the row's left | With a playlist theme on, EVERY row in Your Library (Prism-made or not) gets it on hover and slides 3px right (no slide with reduced motion). With No theme, every row keeps Spotify's grey hover (the old Prism-only purple hover was removed) |
| "Add with Prism" flyout (approved 2026-11-24, mockup "C") | Spicetify `ContextMenu.SubMenu` "Add with Prism" (Prism diamond icon) on a song's right-click menu, `src/ui/addWithPrism.ts` (own small CSS) | Spotify's own sub-menu: up to 5 playlist lines (name, then the fit % in a small lavender pill `.prism-menu-fit-pill`), last line "More on the Prism page…" | Opens at once with "Finding playlists…" and fills in when the scores are in (or says "No genre tags for this song yet"). Click a playlist = add the song to its end; Spotify notification "Added …"; the pill turns mint "Added ✓" |
| Genre mix bar (approved 2026-11-24) | `[data-prism-genre-mix]` after Spotify's header metadata row (`src/ui/playlistTheme.ts`) | 260px x 12px glass pill split by the top 5 main genres (+ lavender "other"), 12px caption "jazz 21% · pop 14% … (from 28 of 39 songs)" | Static. Nothing scanned: caption only. Only with a playlist theme on |
| Panel / box | `.prism-glass-panel` | Glass, 16px corners | Static |
| Clickable card | `.prism-glass-panel` + `.prism-builder-group` | Glass card | Standard hover + 2px lift. Chosen group (`.on`): `--prism-picked` pink edge + inner glow |
| Group card (Remix, "door tile" look) | `.prism-glass-panel.prism-group-card` | Wide glass tile with album covers | Standard hover + 2px lift |
| "Not included" card | `.prism-group-card.prism-left-card` | Dashed edge, less fill | Hover: lavender edge + 2px lift |
| Album-cover mosaic | `CoverMosaic` | 2x2 album art | Static |
| Stat card | `StatCard` in StatsScreen | Glass panel, 12px label, 24px value | Static. "Tone fit" (a playlist with a tone) is a 5th card in the same row, breakdown on hover; in the side panel it's the Score ring beside the numbers (layout "B") |
| Bar (stats) | `.prism-bar-track` + `.prism-bar-fill` with `--tag` | 14px glass track, glossy bar in the genre colour | Bars grow in one after another |
| Progress bar | `.prism-progress` + `.prism-progress-fill` | 10px glass track, pastel rainbow fill | Width animates 300 ms |
| Prism star | `.prism-star-icon` span (`src/ui/prismStar.ts`: `PRISM_STAR_CSS`, `PRISM_STAR_HTML`), never the ✦ character | 4-point star filled with the pastel rainbow, 1em (follows the text size) | Gentle twinkle (2.4 s); still with reduced motion. Used in the New finds status lines, the New find pill and the Tone strip title |
| Inline progress | Text + `.prism-progress` (140px) + muted count (tabular numbers), in one row | The standard progress bar, sized for a status line | Used by the New finds status ("Looking for similar songs…") |
| Fingerprint bubbles | `Fingerprint` | See-through bubbles in the genre colour | Float + wobble; click pops (droplets), back after 3 s |
| Cover ring | `.prism-artwork` (stats page cover); colours shared in `src/ui/ringColours.ts` | Cover inside a moving pastel neon ring. ROUND variant (2026-11-25): the profile photo on themed profile pages (`[data-prism-page="profile"] .main-entityHeader-imageContainer`, CSS in `src/ui/playlistTheme.ts`), the same ring and glow drawn just outside the round photo | Ring turns (3.5 s). Reduced motion: still |
| Notice | `.prism-notice` | Glass box, 12px corners, rainbow bar on the left | Used for tips, warnings and errors (`role="status"` / `alert`) |
| New version notice (approved 2026-11-26, mockup "A" of four) | `UpdateNotice` (src/ui/UpdateNotice.tsx) at the top of the start page | The standard Notice: "**Prism 0.2.0 is out.** You have 0.1.0." + two 32px secondary buttons "What's new" (opens the GitHub release page in the browser) and "Not now" | Only when GitHub's latest release is newer (checked once a day). "Not now" hides it until a later version comes out |
| Error line | inline text in `--prism-error` pink | Small pink text | |
| Inline confirm bar | Text + two secondary buttons in a dark purple strip (leave scan, combine groups) | Says what will happen | Asks before anything destructive |
| Pop-up | `.prism-overlay` + `.prism-glass-card` (`role="dialog"`) | Dimmed, blurred page with a glass card (20px corners) | Rises in |
| Wide pop-up (variant, 2026-11-24) | `.prism-glass-card.is-wide` (up to 760px, at most the view's height). Outside the Prism page the overlay also gets `prism-cosmos` so Prism's colours apply (`src/ui/tonePopup.tsx`) | Same as the pop-up, wider: for a whole editor, not a quick question | Rises in. Escape, a click on the dim area, Cancel or opening another page closes it. Used by: the tone editor from the tone strip's Edit |
| Spotify dialogs (variant, approved 2026-11-25, mockup "A" of four) | CSS in `src/ui/chromeTheme.ts` on `.GenericModal__overlay` (Edit details...) and native `dialog[open]` (Keyboard shortcuts, Credits) | With a playlist theme on, Spotify's own pop-ups take the Pop-up look: dimmed, blurred page (also `dialog::backdrop`), the glass card (20px corners) over a faint purple tint so it stays readable. Text boxes = the Text box look, the main button = the Main button look (solid lavender), character counters lavender, selected text lavender | Spotify's own open/close. Off with "No theme" |
| Report form (approved 2026-11-25, mockup "B") | `ReportScreen` (src/ui/ReportScreen.tsx), opened from Settings > "Help make Prism better" (two 32px secondary buttons), shown inside the Settings layer | Screen title, labelled text boxes / multi-line boxes (headings = section headings), "How often?" segmented choice (bugs), a checkbox "Send details about my setup" + show/hide list of the details, a line that reports are public, action row Cancel + Send. Sent: a big Prism star (44px), "Thanks, it's sent", the issue number, "View on GitHub" + Done | Header Back / Cancel / Done return to Settings; the Prism screen under Settings is kept. Missing answers show as an error line |
| Screen title | `.prism-screen-title` | 22px light Segoe UI Variable Display, white | |
| Section heading | `.prism-heading` | 13px bold, light lavender | |

## Page-level pieces

| Element | Where | Notes |
|---|---|---|
| Twilight background | `.prism-cosmos` (PrismPage, side panel) | Gradient, drifting glows, rainbow light waves, sparkles |
| Header | `.prism-header` + `PrismIcon` | Glass bar, Prism star icon (rainbow 4-point star, white glint) with twinkling sparkles, title, 32px secondary buttons |
| Start tiles | `FlipTile` + `HomeIcons` | The ONLY place with the rainbow-swirl hover. Click flips to details, which have a quiet "← Back" |
| Start bar (approved 2026-11-23, mockup "B"; icons 2026-11-24) | `StartBar` (StartBar.tsx, `button.prism-home-bar`) + an icon from HomeIcons, under the start tiles | Wide glass card (tile glass, 16px corners, min 64px tall): 64x40 pastel see-through icon, 15px label, one 13px line (`.prism-home-bar-text`) that shows ONLY on hover/focus: fades in with a 6px slide from the left in 250ms, space kept so nothing moves. Standard hover + 2px lift, press 0.97, NO flip and NO rainbow swirl. The icon animates while hovered/focused (`is-animating`, parts with `.prism-bar-ic`) and finishes its loop on leave; still with reduced motion. Merge playlists = `MergeIcon` ("Q1 bubbles": pink and sky bubbles drift into one mint-green bubble with green notes); Add a song to your playlists = `AddSongIcon` ("S1 compass": the needle swings and settles on the mint playlist, which lights up with a sparkle) |
| Loading | `.prism-spinner` (small), `ScanningPrism` (scan) | Spinner ring; big diamond with a star halo while scanning |
| Side-panel stats | `PanelStats` | Same elements as the stats page, compact. On ANY playlist (2026-11-25): Prism-made ones from their saved record, others as an estimate ("130 songs · stats from 89 scanned") with an Inline progress line "Scanning songs… 25 of 116" while missing songs are looked up. Numbers card = layout "B" (2026-11-25): the tone fit as the Score ring on the left with "tone fit" under it (only with a tone; hover = breakdown), songs / length / avg BPM / top mood in a 2x2 grid beside it (columns as wide as their numbers, 28px apart; ring and grid spread evenly across the card; no tone = the grid centred) |
| Settings side rail (approved 2026-11-26, layout "B" of four) | `SettingsPanel` (`src/ui/SettingsPanel.tsx`): `.prism-settings` grid = `.prism-glass-panel.prism-rail-nav` (`role="tablist"`, vertical) + one `.prism-glass-panel.prism-settings-section` (`role="tabpanel"`); CSS in styles.ts | A 176px glass column of section buttons (16px outline icon + 13px bold label, 10px corners): Theme, Lyrics and panel, Last.fm, Feedback, About. Chosen: soft lavender fill + a 3px lavender bar on the left edge, lavender icon. The chosen section sits in one glass box beside it. When the page is under 540px wide, the rail becomes a wrapping row above the box | Click, or Up/Down/Home/End, switches at once (the box fades in, 200 ms; none with reduced motion). Standard hover rim, press 0.97. Remembers the last section while Spotify runs (coming back from the report form lands on Feedback); a Settings notice opens Last.fm. Used by: Settings only |
| Side-panel tabs (approved 2026-11-25, mockup "B" of four) | `PanelTabs` (`src/ui/PanelTabs.tsx`): the standard Segmented choice "Prism stats" \| "Now playing" | At the top of the Prism panel; with "Now playing" picked, the same tabs sit in a 48px strip across the top of Spotify's own Now Playing panel (Spotify's view moves down by 48px) | One choice for every playlist, kept until switched back or Spotify restarts. Never on the Queue or Friend activity |
| Playlist themes (approved 2026-11-24, mockups H1/H2/H3) | `.prism-pl-sky` behind Spotify's playlist pages (`src/ui/playlistTheme.ts`), picked in Settings with a segmented choice | "Northern lights": soft blurred aurora streaks (mint edge, violet/pink tops) swaying over a night sky. "Starry night": four-point sparkle stars at random spots, each moving somewhere new after it fades. "Bubble nebula": slow pastel clouds, tiny stars and rising glass bubbles. Spotify's cover-colour washes are cleared; while scrolling, the top bar and the song list's sticky column header are the same nearly solid twilight glass (Spotify paints the header grey). Before it sticks, the column header is fully see-through (just its thin lavender line), so the sky shows behind it. Spotify's green turns Prism: play buttons get the pink-to-lavender gradient with a dark purple triangle; liked ticks, the playing title and toggled icons turn pink; the playing equaliser is hue-shifted to pink. Densities scale with the window size. Reduced motion: still |
| Playlist themes (approved 2026-11-24, mockups H1/H2/H3; album/artist/Liked Songs added with option "A, full sky") | `.prism-pl-sky` behind Spotify's playlist, album, artist and Liked Songs pages (`src/ui/playlistTheme.ts`, pages chosen by `themedPageKind`), picked in Settings with a segmented choice | "Northern lights": soft blurred aurora streaks (mint edge, violet/pink tops) swaying over a night sky. "Starry night": four-point sparkle stars at random spots, each moving somewhere new after it fades. "Bubble nebula": slow pastel clouds, tiny stars and rising glass bubbles. Spotify's cover-colour washes are cleared; while scrolling, the top bar and the song list's sticky column header are the same nearly solid twilight glass (Spotify paints the header grey). Spotify's green turns Prism: play buttons get the pink-to-lavender gradient with a dark purple triangle; liked ticks, the playing title and toggled icons turn pink; the playing equaliser is hue-shifted to pink. Densities scale with the window size. Album, artist and Liked Songs pages get the same sky, washes cleared, glass bars and pastel play button, but NO colour rail or genre mix (developer's decision: playlist-only). Artist pages: the artist photo (pinned by Spotify) fades out as you scroll, over its own height. Reduced motion: still |
| Home sky band (approved 2026-11-24, mockup "D" of four) | `[data-prism-band]` on `.Root__main-view` (`src/ui/playlistTheme.ts`, page kind "band" from `themedPageKind`) | With a playlist theme on, Home gets the theme's moving sky only behind its top part (42% of the view, 320-560px), fading downwards into Quiet night's #151029. Spotify's grey header wash is cleared. Shortcut tiles: lavender glass with the standard lavender hover. Cards in the rows: lavender hover instead of grey. The filter-chip row, once stuck under the top bar, is the same twilight glass as the top bar | The band fades out as you scroll, over its own height. Reduced motion: still |
| Search + genre pages, "pastel glass tiles" (approved 2026-11-24, mockup "B" of four) | `[data-prism-page="search"]` / `"genre"` on `.Root__main-view` (`src/ui/playlistTheme.ts`, page kinds from `themedPageKind`) | With a playlist theme on, Search (Browse all and the results) and genre pages get the theme's full moving sky. Browse tiles (Spotify's colour boxes in `.main-gridContainer-gridContainer`) are lavender glass (rim + top shine) with a Prism pastel glowing from the cover's corner, going round pink, lavender, mint, peach, sky by grid place; the cover image stays. Results: the grey top-result box is lavender glass, the sticky filter-chip row is the top bar's twilight glass, cards hover lavender, the play button is the themed pastel one. Genre pages: Spotify's colour header and the #121212 block under it are gone, so the title sits on the sky | Tiles and the top-result box: standard lavender hover; tiles also lift 2px (none with reduced motion). Reduced motion: still sky |
| Spotify profile, "full sky + avatar ring" (approved 2026-11-25, mockup "A" + "D"'s ring) | `[data-prism-page="profile"]` on `.Root__main-view` (`src/ui/playlistTheme.ts`, page kind "profile" from `themedPageKind`: /user/<id> and its Show all pages) | With a playlist theme on, a profile gets the theme's full moving sky (Spotify's avatar-colour washes cleared, like album pages). Each section (Top artists, Followers, Following...: `section.main-shelf-shelf`) sits on lavender glass (12px corners, like Home's shortcut tiles). The photo wears the round Cover ring. Spotify's grey square behind round card photos is cleared (the drop shadow follows the photo's shape); a card with no photo gets a faint lavender square | Cards: lavender hover instead of grey. The ring turns; reduced motion: still |
| Spotify podcast show + episode, "full sky" (approved 2026-11-25, mockup "A" of four) | `[data-prism-page="podcast"]` on `.Root__main-view` (`src/ui/playlistTheme.ts`, page kind "podcast": /show/<id>, /episode/<id>) | With a playlist theme on: the theme's full moving sky like album pages (cover-colour washes and the episode page's #121212 block cleared), the pastel play button. Episode rows stay Spotify's lines; the "not played yet" dot is lavender (`--spice-notification`). The show's trailer card is lavender glass, its "Trailer" tag lavender | Trailer card: lavender hover. The sky moves; reduced motion: still |
| Lyrics view with a playlist theme (approved 2026-11-25, mockup "D" of four) | `.prism-lyrics-sky` (the playlist page's sky, `buildSky`) + `.prism-lyrics-veil`, placed in `.Root__cinema-view > .main-actionBar-ActionBarContainer` by `syncLyricsSky` (`src/ui/lyricsTheme.ts`); line colours per theme from `LYRICS_LINE_COLOURS` via `html[data-prism-lyrics-sky]` | With a playlist theme on (and "Prism look for lyrics" on), the expanded lyrics show that theme's moving sky instead of twilight, with a soft dark veil from the left behind the lyric column. The sung line stays white; other lines take the theme's tint (Northern lights mint, Starry night pale gold, Bubble nebula pink). No theme: the twilight lyrics as before | The sky moves like on playlist pages; changes at once when the theme changes. Reduced motion: still |
| Spotify Settings, "quiet night + cards" (approved 2026-11-24, mockup "C" of four) | `[data-prism-page="settings"]` on `.Root__main-view` (`src/ui/playlistTheme.ts`, page kind "settings" from `themedPageKind`) | With a playlist theme on, Spotify's Settings (/preferences) gets NO sky: Quiet night's still #151029, every section (`.x-settings-section`) on a #1d1638 card (12px corners, faint lavender rim, Spotify's divider lines hidden); the zoom, equalizer and output boxes are faint lavender glass. Spotify's switches (`.x-toggle-*`) take the Toggle's look (clear glass off, lavender on, white knob) at Spotify's own 42x24 size. Dropdowns are glass pills, Edit / Import library the glass secondary button. Green turns Prism: the chosen zoom picture and radio lavender, the equalizer canvas hue-shifted to pink, the Beta tag the pink-to-lavender gradient | Switches, dropdowns and buttons: standard lavender hover rim + glow. Still (no motion). The dropdowns' open lists are drawn by Windows (native `<select>`), so they stay Spotify's |
| Spotify filter chip (approved 2026-11-24 with the Home sky band) | CSS on Spotify's `[data-encore-id="chip"]` (its inner `legacy-chip__inner` span), `src/ui/playlistTheme.ts` | Glass pill (faint white fill, thin white rim); the chosen chip gets the pink-to-lavender gradient (same as the themed play button) with dark purple text | Standard lavender hover on unchosen chips. On every page with a playlist theme (Home's All / Music / Podcasts, artist pages) and in the themed left panel (Playlists / Albums) |
| Spotify's bars, "Quiet night" (approved 2026-11-24, mockup "C") | `src/ui/chromeTheme.ts`, CSS on while `<html data-prism-chrome>` (any playlist theme on), on EVERY page | Top bar, player bar and the gaps between panels #0b0817; right-hand panel #151029 with #1d1638 cards; top-bar buttons and search box #1d1638. Spotify's green there turns Prism: play/pause gets the pink-to-lavender gradient (dark purple icon), progress and volume fills the same gradient, toggled icons and the liked tick pink. "Playing on iPhone" = no green band: a 3px pastel rainbow line along its bottom with lavender text | Still (no motion). Off with "No theme" |
| Spotify right-click menu, "clear frost" (approved 2026-11-25, mockup "D" of four) | CSS in `src/ui/chromeTheme.ts` on Spotify's `[data-encore-id="menu"]` / `[data-encore-id="menuRow"]`; a sub-menu with a search box ("Add to playlist") is `[data-encore-id="popover"][data-trigger="ContextMenuSubmenu"]` | With a playlist theme on, every Spotify menu and sub-menu (right-click, "Add to playlist", Share, "Add with Prism"...) is see-through frosted glass over a deep purple tint: 16px corners, white rim and top shine, blur 22px. Icons take Prism pastels in turn (pink, lavender, mint, sky); dividers are faint white. "Add to playlist": ONE glass card (the menu inside it is clear), its search box is a glass text box. Spotify's grey scroll fades are removed | Rows: the standard lavender hover (rim + glow), also on keyboard focus and while a row's sub-menu is open (Spotify's `data-hovered` / `data-focused` / `data-open`). Still. Off with "No theme" |
| Spotify tooltip, "night + rainbow line" (approved 2026-11-25, mockup "D" of four) | CSS in `src/ui/chromeTheme.ts` on Spotify's `[data-tippy-root] .main-contextMenu-tippy` boxes that hold a `[role="tooltip"]` (menus can use the same box, so only tooltips) | With a playlist theme on, every Spotify tooltip (Expand Your Library, player buttons...) is the bars' near-black #0b0817 with light lavender text #e9dcff, 6px corners, a faint white rim, and a 2px pastel rainbow line along its bottom (the same line as "Playing on…") | Spotify's own show/hide. Still. Off with "No theme" |
| Spotify toast, "night + rainbow line" (approved 2026-11-25, look "A" of four) | CSS in `src/ui/chromeTheme.ts` on `.notistack-Snackbar [role="alert"] > [data-encore-id="box"]` (Spotify's own toasts, "Removed from ...") and `.notistack-Snackbar .notistack-MuiContent` (`Spicetify.showNotification`) | With a playlist theme on, every toast is the tooltip look: near-black #0b0817, light lavender text (#e9dcff), 8px corners, 2px pastel rainbow line at the bottom; buttons/links in it lavender. Error toasts (`-error`) keep the night box with a pink line and pink icon instead of Spotify's red. |
| "Prism theme" sub-menu (approved 2026-11-25, mockup "A" of three) | `src/ui/playlistThemeMenu.ts`: Spicetify `ContextMenu.SubMenu` on one playlist, items with a 16px rounded gradient swatch (SVG icon) per theme | Spotify's menu (themed "clear frost" when a theme is on): the 10 choices in Settings order; the main theme from Settings ends with " (default)"; the one this playlist shows has its row softly tinted lavender (rgba(183,148,255,0.22), look "D": the swatch SVG carries `data-prism-chosen` and CSS tints the row that :has it; own style tag, so it shows with No theme too) | Click = that playlist's theme at once (page + lyrics), saved locally only; clicking the "(default)" one removes the playlist's own theme |
| Top-bar icon | `src/assets/prism.svg` + `headerIcon.ts` | Spotify's top bar; spins on hover with a star halo and rainbow ring |

## History
- 2026-11-26: NEW "New version notice" on the start page (the standard Notice, mockup "A").
- 2026-11-25: NEW Spotify toast look "night + rainbow line" (look "A"), same as the tooltips; error toasts pink instead of red.
- 2026-11-25: Side panel numbers card = layout "B" (tone fit as the Score ring beside a 2x2 grid); before, a centred 2x2 grid with the tone fit as a 5th cell spanning the row.
- 2026-11-25: NEW Spotify tooltip look "night + rainbow line" (mockup "D"). Left panel's round icon buttons (Expand Your Library) hover in Quiet night purple instead of Spotify's grey.
- 2026-11-26: NEW Settings side rail (layout "B"); Settings is split into Theme / Lyrics and panel / Last.fm / Feedback / About (Theme got its own section so no section is taller than the other screens and the header never moves).
- 2026-11-25: NEW side-panel tabs (mockup "B"); side-panel stats now show on every playlist (estimate + background scan for playlists Prism didn't make).
- 2026-11-25: Settings got an "About" section (option "A" of four): the Last.fm credit and link required by Last.fm's API terms, built from the existing section heading + body/small text (no new element). Under it, a "Support Prism" glass button linking to Ko-fi (option "A" of four; existing glass button, no new element).
- 2026-11-25: Theme preview strip: the edge was ragged (the sky's moving layers slipped past the rounded corners). Now clipped with clip-path and the rim drawn on top (::after), so it's one even line. Same look otherwise.
- 2026-11-25: The Ocean playlist theme was removed (developer's request); 9 themes + No theme remain.
- 2026-11-25: Theme skies tweaked after testing in Spotify: Twilight sparkles back, Northern lights colour drift, Milky Way band detail + one-way shooting stars, Blossom petal depths, petal shapes and a petal canopy, Window rain city lights + a rain-on-glass simulation (src/ui/rainGlass.ts), Misty morning = fogged glass, Ocean = underwater (`src/ui/themeSkies.ts`).
- 2026-11-25: NEW "Prism theme" right-click sub-menu (14b): a theme for one playlist.
- 2026-11-25: "Prism theme" sub-menu: the "Use my default" line was replaced by a "(default)" mark on the main theme, and the " ✓" by a lavender tint on the chosen row (look "D" of four); sub-menus with their own scroll box (the inner [data-encore-id="menu"] of a popover) got 4px padding so the first/last row's hover rim isn't cut off.
- 2026-11-25: Playlist themes went from 3 to 10 (+ No theme): Twilight (Prism's page sky, no sparkles), Milky Way, Afterglow, Misty morning, Ocean, Blossom canopy, Window rain (skies in `src/ui/themeSkies.ts`). Settings' theme choice became the PILLS variant of the segmented choice with a NEW theme preview strip (picker "D").
- 2026-11-25: NEW lyrics view look per playlist theme "moving sky + reading veil" (14c).
- 2026-11-25: Pop-up got a SPOTIFY DIALOGS variant (step 16h): Spotify's pop-ups use the Prism pop-up look while a playlist theme is on.
- 2026-11-25: NEW Spotify podcast show + episode look "full sky" (step 16g).
- 2026-11-25: NEW Spotify profile look "full sky + avatar ring" (step 16f). The Cover ring got a ROUND variant
  for the profile photo; its colours moved to `src/ui/ringColours.ts` so both bundles share them.
- 2026-11-25: NEW Spotify right-click menu "clear frost" (step 16e, mockup "D" of four). Listening
  history (/history) needed nothing: it is the right panel's Recently played tab, already Quiet night.

- 2026-11-24: Text box as a number box (Grow's Custom song count) hides the browser's grey
  up/down spinner (mockup "A" of four, developer's pick).

- 2026-11-24: NEW Spotify Settings "quiet night + cards" (step 16d, mockup "C" of four). The Toggle's
  look is also used on Spotify's own Settings switches (at Spotify's size).
- 2026-11-25: The page header icon and Spotify's top-bar icon switched from the glass diamond to the Prism star (mockup "E", developer's pick). Top-bar hover (mockup "C, colour-matched glow"): the star's rainbow flows along while a soft glow breathes behind it, cycling through the rainbow; the star never turns (was a coin spin). The top-bar button's moving neon ring was removed (developer's request). The scanning diamond is unchanged.
- 2026-11-24: NEW Prism star (look "A" of four) replaces the ✦ character everywhere (New finds status, New find pill, Tone strip). The 3 sparkles round a New find's score ring were removed (developer's request). The New finds status line got the standard progress bar.
- 2026-11-24: NEW Search + genre pages "pastel glass tiles" (step 16c, mockup "B" of four).
- 2026-11-24: NEW Home sky band (step 16, mockup "D" of four) and the themed Spotify filter chip.
- 2026-11-24: Library panel theme: its Playlists / Albums chips now use the themed filter chip (developer's OK).
- 2026-11-24: New "Add with Prism" flyout (mockup "C"). The Add page uses existing elements only
  (list rows, score ring, tag labels, secondary buttons, notice); the start bar got a second use.

- 2026-11-24: Playlist theme column header (# / Title / Album) is see-through until it sticks
  to the top; only then does it turn to twilight glass (developer asked: the solid band looked odd).
  Same change: Spotify's dark top-bar layers are hidden, and on Spotify's own playlists with a big
  photo header the photo scrolls away with the page instead of staying behind the songs.
- 2026-11-24: Playlist themes now also paint album, artist and Liked Songs pages (step 16,
  developer's pick "A, full sky" of four). No rail or genre mix there; artist photo fades on scroll.

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

- 2026-11-25: Start bar line shows only on hover/focus (developer's choice: change the element
  everywhere). Before: always visible. Merge's joined bubble + notes are mint green and the
  compass's third playlist is pink (both were lavender).

- 2026-11-24: Start bar icons redrawn and animated (developer's picks after five mockup rounds):
  Merge = "Q1 bubbles", Add a song = "S1 compass". Before: still matte boxes joined by lines.
  The bars are now the `StartBar` component. New lines: "Stack your playlists together and
  drop the doubles" / "Let Prism find the best home for a song".

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
