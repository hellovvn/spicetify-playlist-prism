<p align="center">
  <img src="docs/media/banner.svg" alt="Prism: grow, remix and theme your Spotify playlists" width="100%">
</p>

<p align="center">
  <b>A Spotify companion that helps you get more out of the music you already have.</b><br>
  Grow a playlist from a favourite song, remix messy playlists into tidy ones,<br>
  see what each playlist is made of, and give Spotify a softer, twilight look.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Spicetify-custom%20app-b9a6ff?style=flat-square" alt="Spicetify custom app">
  <img src="https://img.shields.io/badge/Spotify-desktop-ffb8d9?style=flat-square" alt="Spotify desktop">
  <img src="https://img.shields.io/badge/license-MIT-a9cdff?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <a href="https://hellovvn.github.io/spicetify-prism/"><b>Read the guide</b></a> ·
  <a href="#install">Install</a> ·
  <a href="#support">Support</a>
</p>

<p align="center">
  <img src="docs/media/home.webp" alt="Prism's start page: Grow a playlist, Remix into moods, Merge playlists and Add a song" width="720">
</p>

## Features

Click a card for the full guide to that feature.

<a href="https://hellovvn.github.io/spicetify-prism/grow.html"><img src="docs/media/cards/grow.svg" alt="Grow a playlist: read the guide" width="100%"></a>

<p align="center"><img src="docs/media/grow.webp" alt="Growing a playlist from one song: ranked matches with score rings and New finds" width="640"></p>

Right-click a song, pick the tags that fit, and Prism ranks songs from your own playlists, plus a few marked new finds. [Read the guide →](https://hellovvn.github.io/spicetify-prism/grow.html)

<a href="https://hellovvn.github.io/spicetify-prism/remix.html"><img src="docs/media/cards/remix.svg" alt="Remix into moods: read the guide" width="100%"></a>

<p align="center"><img src="docs/media/remix.webp" alt="Remixing a playlist into groups by genre and mood" width="640"></p>

Pick playlists and Prism sorts their songs into new ones by genre and mood, or by vibes you choose. [Read the guide →](https://hellovvn.github.io/spicetify-prism/remix.html)

<a href="https://hellovvn.github.io/spicetify-prism/merge.html"><img src="docs/media/cards/merge.svg" alt="Merge playlists: read the guide" width="100%"></a>

<p align="center"><img src="docs/media/merge.svg" alt="Two playlist bubbles drifting into one, with the doubles dropped" width="640"></p>

Pick two or more playlists and get one new playlist without the duplicates. [Read the guide →](https://hellovvn.github.io/spicetify-prism/merge.html)

<a href="https://hellovvn.github.io/spicetify-prism/add-with-prism.html"><img src="docs/media/cards/add-with-prism.svg" alt="Add with Prism: read the guide" width="100%"></a>

<p align="center"><img src="docs/media/add-with-prism.webp" alt="Add with Prism showing the five best-fitting playlists for a song" width="640"></p>

Right-click a song and see the five playlists of yours it fits best. [Read the guide →](https://hellovvn.github.io/spicetify-prism/add-with-prism.html)

<a href="https://hellovvn.github.io/spicetify-prism/tone.html"><img src="docs/media/cards/tone.svg" alt="Playlist tone: read the guide" width="100%"></a>

<p align="center"><img src="docs/media/tone.webp" alt="Score rings showing how well each song fits a playlist's tone" width="640"></p>

A score ring on every song shows how well it fits the playlist's vibe. [Read the guide →](https://hellovvn.github.io/spicetify-prism/tone.html)

<a href="https://hellovvn.github.io/spicetify-prism/stats.html"><img src="docs/media/cards/stats.svg" alt="Playlist stats: read the guide" width="100%"></a>

<p align="center"><img src="docs/media/stats.webp" alt="Playlist stats page with stat cards, genre bars and fingerprint bubbles" width="640"></p>

Genres, moods, tempo, artists, eras and key for any playlist. [Read the guide →](https://hellovvn.github.io/spicetify-prism/stats.html)

<a href="https://hellovvn.github.io/spicetify-prism/side-panel.html"><img src="docs/media/cards/side-panel.svg" alt="Stats beside your music: read the guide" width="100%"></a>

<p align="center"><img src="docs/media/side-panel.webp" alt="Prism stats in Spotify's side panel next to a playlist" width="640"></p>

The open playlist's stats in Spotify's right-hand panel while you listen. [Read the guide →](https://hellovvn.github.io/spicetify-prism/side-panel.html)

<a href="https://hellovvn.github.io/spicetify-prism/themes.html"><img src="docs/media/cards/themes.svg" alt="Playlist themes: read the guide" width="100%"></a>

<p align="center"><img src="docs/media/themes.webp" alt="A playlist page switching between Prism themes" width="640"></p>

Moving skies for Spotify, and a different one per playlist if you like. [Read the guide →](https://hellovvn.github.io/spicetify-prism/themes.html)

Prism judges every song on its own Last.fm tags, lyrics mood, tempo and key
([how songs are matched](https://hellovvn.github.io/spicetify-prism/how-it-works.html)). It only
writes to Spotify when you click a button that says so, and never deletes playlists or removes songs
([what Prism changes](https://hellovvn.github.io/spicetify-prism/what-prism-changes.html)).
Once a day it sends anonymous usage counts (which features were used, never your songs or names);
switch that off in Settings > Feedback ([privacy](https://hellovvn.github.io/spicetify-prism/what-prism-changes.html#privacy)).

**Every feature, step by step, with clips: [the Prism guide](https://hellovvn.github.io/spicetify-prism/).**

## Install

You need the Spotify desktop app and [Spicetify](https://spicetify.app/docs/getting-started).
No Last.fm account or key needed ([use your own key](https://hellovvn.github.io/spicetify-prism/lastfm-key.html) if you like). Tested on Windows; macOS and Linux should work
([report](https://github.com/hellovvn/spicetify-prism/issues) anything that breaks).

There are **two ways** to install Prism. Pick one:

### Option 1: one command (Windows)

Paste this into PowerShell. Run it again any time to update.

```powershell
iwr -useb https://raw.githubusercontent.com/hellovvn/spicetify-prism/main/install.ps1 | iex
```

### Option 2: by hand (any system)

The Marketplace can't install custom apps itself, so:

1. Download `prism-<version>.zip` from the [latest release](https://github.com/hellovvn/spicetify-prism/releases/latest).
2. Unzip it into Spicetify's `CustomApps` folder, so you end up with `CustomApps/prism`
   (Windows: `%APPDATA%\spicetify\CustomApps`, macOS / Linux: `~/.config/spicetify/CustomApps`).
3. Turn it on:

   ```powershell
   spicetify config custom_apps prism
   spicetify apply
   ```

Need more help? The [full install guide](https://hellovvn.github.io/spicetify-prism/install.html) explains:

- how to update Prism to a new version
- what to do if Prism disappears after Spotify updates itself
- how to build Prism from its code (for developers)

## Support

Prism is free. If it makes your playlists nicer, you can buy me a coffee (also from
**Settings > About > Support Prism** inside the app).

<a href="https://ko-fi.com/hellovvn"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support Prism on Ko-fi" height="36"></a>

## Credits and license

Genre and mood tags and similar songs come from [Last.fm](https://www.last.fm/) (powered by
AudioScrobbler). Tempo, key and lyrics come from Spotify. Prism isn't made by or connected to
Last.fm or Spotify. Developing Prism: [development guide](https://hellovvn.github.io/spicetify-prism/development.html).

[MIT](LICENSE)
