# Demo clip shot list

The README's demo clips live here. They're recorded from Spotify with
`scripts/record-demos.mjs` on the public playlist **Today's Top Hits** (no personal playlists in
frame), cropped to Prism's part of the screen.

| Clip | File | Notes |
| --- | --- | --- |
| Hero | `home.webp` | The start page, uncropped; each tile and start bar comes alive on hover |
| Grow | `grow.webp` | Ranked matches with score rings and New finds |
| Remix | `remix.webp` | Picking "Sort them for me", then the group cards |
| Merge | `merge.svg` | Animated drawing (no second public playlist to merge with) |
| Add with Prism | `add-with-prism.webp` | The 5 best-fitting playlists (from the library) |
| Tone | `tone.webp` | Switching the tone on: score rings appear |
| Stats | `stats.webp` | The full stats page, popping a fingerprint bubble |
| Side panel | `side-panel.webp` | The playlist's songs with the stats panel beside them |
| Themes | `themes.webp` | One playlist page going through four themes |
| Lyrics | none | Left out on purpose: a lyrics clip would publish song lyrics |

Every feature clip is cropped to the same 5:4 shape (`SHAPE` in the script) and recorded at double
density (`DPR = 2`), so the README rows line up and small text stays sharp. Animated WebP, under
~5 MB each.

## Re-recording

```powershell
node scripts/record-demos.mjs grow          # writes docs/media/grow.webp
node scripts/record-demos.mjs home          # the hero
```

Needs ffmpeg (`winget install --id Gyan.FFmpeg -e`; set `FFMPEG` to its path if it isn't on PATH)
and Spotify running with the debug port (`spicetify watch -a`). The script sets a theme and a demo
tone while it records and puts your own settings back afterwards. It never clicks Create, Merge or
Add. Close the Prism page's Settings first.

## Rules for every clip

- **Demo library only.** Use demo playlists made for recording (no personal playlist names,
  profile picture or private songs). Hide the profile name in the top bar.
- **Size:** 800 px wide at 5:4 (README rows show them at ~420 px); the hero is 960 px wide.
- **Length:** hero ~15 s, feature clips 4–8 s. Start at the top of the page (no scrolling).
- **Frame rate:** 15 fps.
- **Theme:** Northern lights (the themes clip starts from No theme).
- **No text you need to read in under a second.** If a step needs explaining, it goes in the README.
