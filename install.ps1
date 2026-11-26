# Installs (or updates) Prism, a Spicetify custom app.
#
#   iwr -useb https://raw.githubusercontent.com/hellovvn/spicetify-prism/main/install.ps1 | iex
#
# What it does, and nothing else:
#   1. checks that Spicetify is installed
#   2. downloads prism-<version>.zip from the latest GitHub release
#   3. puts it in Spicetify's CustomApps\prism folder (replacing an older Prism)
#   4. turns it on: spicetify config custom_apps prism, then spicetify apply
# Run it again any time to update. Your Prism settings are kept (they live in Spotify).

& {
  $ErrorActionPreference = "Stop"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  function Say($text) { Write-Host "Prism: $text" -ForegroundColor Magenta }

  # 1. Spicetify
  if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    Say "Spicetify isn't installed. Install it first: https://spicetify.app/docs/getting-started"
    return
  }
  $configFile = (spicetify -c | Select-Object -Last 1).Trim()
  $customApps = Join-Path (Split-Path $configFile -Parent) "CustomApps"
  New-Item -ItemType Directory -Force -Path $customApps | Out-Null

  # 2. Latest release
  Say "Looking for the latest version..."
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/hellovvn/spicetify-prism/releases/latest" -Headers @{ "User-Agent" = "prism-installer" }
  $asset = $release.assets | Where-Object { $_.name -like "prism-*.zip" } | Select-Object -First 1
  if (-not $asset) {
    Say "The latest release ($($release.tag_name)) has no prism zip. Please report this on GitHub."
    return
  }

  $work = Join-Path ([IO.Path]::GetTempPath()) ("prism-install-" + [Guid]::NewGuid())
  New-Item -ItemType Directory -Path $work | Out-Null
  try {
    $zip = Join-Path $work $asset.name
    Say "Downloading $($asset.name)..."
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $work -Force

    $newApp = Join-Path $work "prism"
    if (-not (Test-Path (Join-Path $newApp "manifest.json"))) {
      Say "The download doesn't look right (no prism\manifest.json). Nothing was changed."
      return
    }

    # 3. Replace only the prism folder
    $target = Join-Path $customApps "prism"
    if (Test-Path $target) { Remove-Item -Recurse -Force $target }
    Move-Item $newApp $target
    Say "Installed $($release.tag_name) in $target"
  } finally {
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
  }

  # 4. Turn it on (only add it to the list if it isn't there yet)
  $apps = (spicetify config custom_apps | Out-String)
  if ($apps -notmatch "(^|\s|\|)prism(\s|\||$)") { spicetify config custom_apps prism | Out-Null }
  spicetify apply

  Say "Done. Open Spotify and click the Prism star in the top bar."
}
