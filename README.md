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
  <a href="#getting-a-lastfm-api-key">Last.fm key</a> ·
  <a href="#support">Support</a>
</p>

<p align="center">
  <img src="docs/media/home.webp" alt="Prism's start page: Grow a playlist, Remix into moods, Merge playlists and Add a song" width="720">
</p>

## Features

| Feature | What it does |
| --- | --- |
| **[Grow a playlist](https://hellovvn.github.io/spicetify-prism/grow.html)** | Start with one song you love and get a playlist of songs that feel like it. |
| **[Remix into moods](https://hellovvn.github.io/spicetify-prism/remix.html)** | Shuffle your playlists into fresh ones sorted by genre and mood. |
| **[Merge playlists](https://hellovvn.github.io/spicetify-prism/merge.html)** | Stack your playlists together and drop the doubles. |
| **[Add with Prism](https://hellovvn.github.io/spicetify-prism/add-with-prism.html)** | Let Prism find the best home for a song. |
| **[Playlist tone](https://hellovvn.github.io/spicetify-prism/tone.html)** | Give a playlist a vibe and see which songs fit it and which drift. |
| **[Playlist stats](https://hellovvn.github.io/spicetify-prism/stats.html)** | See what any playlist is made of: genres, moods, tempo, artists, eras. |
| **[Stats beside your music](https://hellovvn.github.io/spicetify-prism/side-panel.html)** | A playlist's stats in Spotify's side panel while you listen. |
| **[Playlist themes](https://hellovvn.github.io/spicetify-prism/themes.html)** | Nine moving skies across Spotify, and a different one per playlist. |

Prism judges every song on its own Last.fm tags, lyrics mood, tempo and key
([how songs are matched](https://hellovvn.github.io/spicetify-prism/how-it-works.html)). It only
writes to Spotify when you click a button that says so, and never deletes playlists or removes songs
([what Prism changes](https://hellovvn.github.io/spicetify-prism/what-prism-changes.html)).

**Every feature, step by step, with clips: [the Prism guide](https://hellovvn.github.io/spicetify-prism/).**

## Install

You need the Spotify desktop app and [Spicetify](https://spicetify.app/docs/getting-started).
No Last.fm account needed. Tested on Windows; macOS and Linux should work
([report](https://github.com/hellovvn/spicetify-prism/issues) anything that breaks).

**Windows, one step:** paste this into PowerShell. Run it again any time to update.

```powershell
iwr -useb https://raw.githubusercontent.com/hellovvn/spicetify-prism/main/install.ps1 | iex
```

**By hand (any system):** the Marketplace can't install custom apps itself, so:

1. Download `prism-<version>.zip` from the [latest release](https://github.com/hellovvn/spicetify-prism/releases/latest).
2. Unzip it into Spicetify's `CustomApps` folder, so you end up with `CustomApps/prism`
   (Windows: `%APPDATA%\spicetify\CustomApps`, macOS / Linux: `~/.config/spicetify/CustomApps`).
3. Turn it on:

   ```powershell
   spicetify config custom_apps prism
   spicetify apply
   ```

Then click the Prism star in Spotify's top bar. Updating, Spotify updates and building from source:
[full install guide](https://hellovvn.github.io/spicetify-prism/install.html).

### Getting a Last.fm API key

Optional: Prism comes with a shared Last.fm key. To use your own free key, make one at
[last.fm/api/account/create](https://www.last.fm/api/account/create), then paste the **API key**
(not the Shared secret) into Prism's **Settings** and click **Test & save**.
[Step by step, and what Prism's key messages mean](https://hellovvn.github.io/spicetify-prism/lastfm-key.html).

## Support

Prism is free. If it makes your playlists nicer, you can buy me a coffee (also from
**Settings > About > Support Prism** inside the app).

<a href="https://ko-fi.com/hellovvn"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support Prism on Ko-fi" height="36"></a>

## Credits and license

Genre and mood tags and similar songs come from [Last.fm](https://www.last.fm/) (powered by
AudioScrobbler). Tempo, key and lyrics come from Spotify. Prism isn't made by or connected to
Last.fm or Spotify. Developing Prism: [development guide](https://hellovvn.github.io/spicetify-prism/development.html).

[MIT](LICENSE)
