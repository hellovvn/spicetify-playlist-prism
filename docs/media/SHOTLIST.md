# Demo clip shot list

The README's demo clips live here. They're recorded from Spotify with
`scripts/record-demos.mjs` on the public playlist **Today's Top Hits** (no personal playlists in
frame), cropped to Prism's part of the screen.

| Clip | File | Status |
| --- | --- | --- |
| Hero tour | `hero.webp` | Stitched from grow + remix + stats (see below) |
| Grow | `grow.webp` | Recorded |
| Remix | `remix.webp` | Recorded |
| Merge | `merge.svg` | Placeholder: needs a second public playlist to merge with |
| Add with Prism | `add-with-prism.webp` | Recorded (shows the 5 best-fitting playlists from the library) |
| Tone | `tone.gif` | Recorded |
| Themes | `themes.gif` | Recorded |
| Stats | `stats.webp` | Recorded |
| Side panel | `side-panel.gif` | Recorded (top line = the song playing at the time) |
| Lyrics | none | Left out on purpose: a lyrics clip would publish song lyrics |

Format: animated WebP for clips with Prism's moving background (about a third of the GIF size),
GIF for mostly-still clips (GIF is smaller there). Keep each file under ~5 MB.

## Re-recording

```powershell
node scripts/record-demos.mjs grow          # writes docs/media/grow.webp
node scripts/record-demos.mjs tone --gif    # writes docs/media/tone.gif
```

Needs ffmpeg (`winget install --id Gyan.FFmpeg -e`; set `FFMPEG` to its path if it isn't on PATH)
and Spotify running with the debug port (`spicetify watch -a`). The script sets a theme and a demo
tone while it records and puts your own settings back afterwards. It never clicks Create, Merge or
Add. Close the Prism page's Settings first.

The hero is stitched from three finished clips:

```powershell
ffmpeg -i grow.webp -i remix.webp -i stats.webp -filter_complex "[0:v]trim=0.4:4.2,setpts=PTS-STARTPTS,fps=15,scale=720:-2,crop=720:520:0:0,setsar=1[v0];[1:v]trim=0.6:5.2,setpts=PTS-STARTPTS,fps=15,scale=720:-2,crop=720:520:0:0,setsar=1[v1];[2:v]trim=0.3:4.6,setpts=PTS-STARTPTS,fps=15,scale=-2:520,crop=720:520:(iw-720)/2:0,setsar=1[v2];[v0][v1][v2]concat=n=3:v=1:a=0[out]" -map "[out]" -c:v libwebp -quality 70 -loop 0 hero.webp
```

## Rules for every clip

- **Demo library only.** Use demo playlists made for recording (no personal playlist names,
  profile picture or private songs). Hide the profile name in the top bar.
- **Size:** 640-720 px wide, cropped to the part that matters (gallery cells show them at ~280 px).
- **Length:** hero ~12 s, gallery clips 4–8 s. Start at the top of the page (no scrolling).
- **Frame rate:** 15 fps.
- **Theme:** Northern lights (the themes clip starts from No theme).
- **No text you need to read in under a second.** If a step needs explaining, it goes in the README.
