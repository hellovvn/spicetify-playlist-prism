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
| Icon button | `.prism-icon-button` | 28px glass circle, e.g. × | Standard hover/press |
| Action row | `.prism-actions`, right-aligned, at the bottom of a screen | Secondary buttons first, main button last | Always in the same place on a screen |

## Choosing things

| Element | How to make it | Look | Behaviour |
|---|---|---|---|
| Checkbox (approved 2026-11-23) | `<input type="checkbox" className="prism-check">` | 18px glass square, 5px corners. On: lavender, dark tick, glow. Some: dash. Locked: `<span className="prism-check is-locked">`, dimmed tick | Standard hover. The whole row (`<label>`) toggles it |
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
| Panel / box | `.prism-glass-panel` | Glass, 16px corners | Static |
| Clickable card | `.prism-glass-panel` + `.prism-group-card` (or `.prism-builder-group`) | Glass card; chosen builder group has a lavender edge | Standard hover + 2px lift |
| Album-cover mosaic | `CoverMosaic` | 2x2 album art | Static |
| Stat card | `StatCard` in StatsScreen | Glass panel, 12px label, 24px value | Static |
| Bar (stats) | `.prism-bar-track` + `.prism-bar-fill` with `--tag` | 14px glass track, glossy bar in the genre colour | Bars grow in one after another |
| Progress bar | `.prism-progress` + `.prism-progress-fill` | 10px glass track, pastel rainbow fill | Width animates 300 ms |
| Fingerprint bubbles | `Fingerprint` | See-through bubbles in the genre colour | Float + wobble; click pops (droplets), back after 3 s |
| Cover ring | `.prism-artwork` | Cover inside a moving pastel neon ring | Ring turns (3.5 s) |
| Notice | `.prism-notice` | Glass box, 12px corners, rainbow bar on the left | Used for tips, warnings and errors (`role="status"` / `alert`) |
| Error line | inline text in `--prism-error` pink | Small pink text | |
| Inline confirm bar | Text + two secondary buttons in a dark purple strip (leave scan, combine groups) | Says what will happen | Asks before anything destructive |
| Pop-up | `.prism-overlay` + `.prism-glass-card` (`role="dialog"`) | Dimmed, blurred page with a glass card (20px corners) | Rises in |
| Screen title | `.prism-screen-title` | 22px light Segoe UI Variable Display, white | |
| Section heading | `.prism-heading` | 13px bold, light lavender | |

## Page-level pieces

| Element | Where | Notes |
|---|---|---|
| Twilight background | `.prism-cosmos` (PrismPage, side panel) | Gradient, drifting glows, rainbow light waves, sparkles |
| Header | `.prism-header` + `PrismIcon` | Glass bar, diamond icon with twinkling sparkles, title, 32px secondary buttons |
| Start tiles | `FlipTile` + `HomeIcons` | The ONLY place with the rainbow-swirl hover. Click flips to details, which have a quiet "← Back" |
| Loading | `.prism-spinner` (small), `ScanningPrism` (scan) | Spinner ring; big diamond with a star halo while scanning |
| Side-panel stats | `PanelStats` | Same elements as the stats page, compact |
| Top-bar icon | `src/assets/prism.svg` + `headerIcon.ts` | Spotify's top bar; spins on hover with a star halo and rainbow ring |

## History

- 2026-11-23: v1 of every element above (UI standardization). Before this, buttons,
  checkboxes, hover, inputs, corners and titles came in several styles.
