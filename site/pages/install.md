<!-- description: Install Prism, the Spicetify app for Spotify: one PowerShell line on Windows, or three steps by hand. -->
# Install

<p class="lead">You need the Spotify desktop app and <a href="https://spicetify.app/docs/getting-started">Spicetify</a>. No Last.fm account needed.</p>

Tested on Windows (Spicetify 2.46). macOS and Linux should work but haven't been tried yet:
please [report](https://github.com/hellovvn/spicetify-prism/issues) anything that breaks.

## Windows, one step

Paste this into PowerShell:

```powershell
iwr -useb https://raw.githubusercontent.com/hellovvn/spicetify-prism/main/install.ps1 | iex
```

It downloads the latest release into Spicetify's `CustomApps` folder and turns Prism on
([read the script](https://github.com/hellovvn/spicetify-prism/blob/main/install.ps1) first if you
like). Run it again any time to update.

## By hand, any system

Prism is a Spicetify **custom app**. You'll find it in the Spicetify Marketplace, but the
Marketplace can't install custom apps itself, so it takes three steps:

1. Download `prism-<version>.zip` from the [latest release](https://github.com/hellovvn/spicetify-prism/releases/latest).
2. Unzip it into Spicetify's `CustomApps` folder, so you end up with `CustomApps/prism`.
   - Windows: `%APPDATA%\spicetify\CustomApps`
   - macOS / Linux: `~/.config/spicetify/CustomApps`

   Not sure? `spicetify -c` shows Spicetify's config file; `CustomApps` is next to it.
3. Turn it on:

   ```powershell
   spicetify config custom_apps prism
   spicetify apply
   ```

Then open Spotify and click the Prism star in the top bar. That's it: Prism comes with a shared
Last.fm key. Adding [your own key](lastfm-key.html) is optional.

## Updating

Run the PowerShell line again, or download the new zip, replace the `prism` folder, and run
`spicetify apply`. Your settings, tones and stats stay: they're saved in Spotify, not in the folder.

## After a Spotify update

Spotify updates can switch Spicetify off. Run this and Prism comes back:

```powershell
spicetify restore backup apply
```

## From source

Needs [Node.js](https://nodejs.org) too. This build includes the developer tools (a debug hook for
the smoke test); `npm run release` makes the same clean zip as the releases.

```powershell
git clone https://github.com/hellovvn/spicetify-prism.git
cd spicetify-prism
npm install
npm run build
spicetify config custom_apps prism
spicetify apply
```
