# Demo GIF shot list

Each slot in the README points at a placeholder: `docs/media/<name>.svg`, or for now an older
screenshot from `docs/images/` (hero, grow, remix, stats). When a recording is
ready, save it as `docs/media/<name>.gif` (or `.webp`) and change that one `src` in README.md.

## Rules for every clip

- **Demo library only.** Use demo playlists made for recording (no personal playlist names,
  profile picture or private songs). Hide the profile name in the top bar.
- **Size:** hero 1200 px wide, gallery clips 800 px wide (they show at about 280 px, so zoom in
  on the part that matters rather than recording the whole window).
- **Length:** hero 10–15 s, gallery clips 3–6 s, looping cleanly (end where it started, or fade).
- **File size:** under 5 MB each (hero under 8 MB). Animated WebP is usually much smaller.
- **Frame rate:** 20–25 fps. Slow, deliberate mouse moves; pause ~0.5 s before each click.
- **Theme:** Northern lights on (except the "No theme" before/after in `themes`).
- **No text you need to read in under a second.** If a step needs explaining, it goes in the README.

## Slots

| File | Length | What happens |
| --- | --- | --- |
| `hero` | 12 s | Right-click a song > Start a Prism playlist. Tag chips appear, one is switched off. Scan diamond spins briefly (cut). Ranked list with score rings fills in, a New find row is visible. Click Create. Cut to the new playlist page with its themed sky and colour rail. |
| `grow` | 5 s | Ranked list: score rings fill, hover one row to show the "why it matched" tags, switch the count chips 10 → 30. |
| `remix` | 5 s | Choose "Sort them for me". The group cards appear with their album mosaics; open one and move a song. |
| `merge` | 4 s | Confirm screen: two playlists, the total, "▾ Show duplicates" opens the list. |
| `add-with-prism` | 4 s | Right-click a song > Add with Prism. "Finding playlists…" turns into the top 5; click one. |
| `tone` | 5 s | On a playlist page, flip the Tone toggle: score rings appear down the song list, scroll a little. |
| `themes` | 6 s | Same playlist page: No theme → Northern lights → Blossom canopy → Window rain → Milky Way (crossfades), ending on right-click > Prism theme. |
| `stats` | 5 s | Stats page: the cover ring turns, genre bars grow, pop one fingerprint bubble. |
| `side-panel` | 4 s | Open a Prism playlist; the side panel fills in with its stats. Recorded tall and narrow (about 400 x 600). |
| `lyrics` | 4 s | Lyrics view with the twilight sky while a song plays, lines scrolling. |

## How to record

The plan is to record through Spotify's debug port (the same connection `npm run smoke` uses):
Chrome DevTools Protocol `Page.startScreencast` gives frames, which ffmpeg turns into a GIF or
WebP. That way each clip is repeatable after UI changes. A script for this doesn't exist yet.

Manual fallback: ScreenToGif (Windows) or ShareX, cropped to the area above.

ffmpeg from a folder of frames:

```powershell
ffmpeg -framerate 25 -i frames/%04d.png -vf "scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a" -loop 0 grow.gif
ffmpeg -framerate 25 -i frames/%04d.png -vf "scale=800:-1" -c:v libwebp -lossless 0 -q:v 70 -loop 0 grow.webp
```
