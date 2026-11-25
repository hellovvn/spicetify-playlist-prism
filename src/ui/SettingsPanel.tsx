// Settings: lets the user paste, test, and save their Last.fm API key.
// Shown on the Playlist Prism page (it was a popup before step 12a).
//
// This is our first React component. A component is a function that returns
// what to show (JSX, the HTML-like syntax below). When its "state" changes,
// React calls the function again and updates the screen to match.

import React from "react"; // Spicetify Creator maps this to Spotify's own React
import { getLastfmKey, setLastfmKey, clearLastfmKey, loadLyricsThemeSetting, saveLyricsThemeSetting, loadPanelStatsSetting, savePanelStatsSetting, loadPlaylistThemeSetting, savePlaylistThemeSetting } from "../storage";
import { parsePlaylistTheme, PLAYLIST_THEMES, PLAYLIST_THEME_CHANGED_EVENT, type PlaylistThemeId } from "../theme/playlistTheme";
import { isPanelStatsOn, PANEL_STATS_CHANGED_EVENT } from "./sidePanel";
import { isLyricsThemeOn, LYRICS_THEME_CHANGED_EVENT } from "./lyricsTheme";
import { testApiKey } from "../lastfm/client";
import { ThemeStrip } from "./ThemeStrip";

export interface SettingsPanelProps {
  // Shown above the form, e.g. "Add your Last.fm key first".
  notice?: string;
  // Called after a key was tested and saved (e.g. to continue a Prism).
  onSaved?: () => void;
}

export function SettingsPanel({ notice, onSaved }: SettingsPanelProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent;

  // useState(initial) returns [currentValue, functionToChangeIt].
  // Changing state makes React re-render this component.
  const [key, setKey] = React.useState<string>(getLastfmKey() ?? "");
  const [status, setStatus] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);
  // The lyrics switch: saved straight away, and an event tells the always-on
  // script (src/ui/lyricsTheme.ts) to add or remove the Prism lyrics look.
  const [lyricsOn, setLyricsOn] = React.useState<boolean>(isLyricsThemeOn(loadLyricsThemeSetting()));
  function chooseLyrics(on: boolean) {
    setLyricsOn(on);
    saveLyricsThemeSetting(on);
    window.dispatchEvent(new Event(LYRICS_THEME_CHANGED_EVENT));
  }
  // The side-panel stats switch works the same way (src/ui/panelHost.tsx listens).
  const [panelOn, setPanelOn] = React.useState<boolean>(isPanelStatsOn(loadPanelStatsSetting()));
  function choosePanel(on: boolean) {
    setPanelOn(on);
    savePanelStatsSetting(on);
    window.dispatchEvent(new Event(PANEL_STATS_CHANGED_EVENT));
  }

  // The playlist theme (src/ui/playlistTheme.ts listens for the event).
  const [playlistTheme, setPlaylistTheme] = React.useState<PlaylistThemeId>(parsePlaylistTheme(loadPlaylistThemeSetting()));
  function chooseTheme(id: PlaylistThemeId) {
    setPlaylistTheme(id);
    savePlaylistThemeSetting(id);
    window.dispatchEvent(new Event(PLAYLIST_THEME_CHANGED_EVENT));
  }

  async function onSave() {
    const trimmed = key.trim();
    if (!trimmed) {
      setStatus("Please paste an API key first.");
      return;
    }
    // Test the key BEFORE saving, so a typo is caught right away instead of
    // causing a confusing error later.
    setBusy(true);
    setStatus("Testing key with Last.fm...");
    const problem = await testApiKey(trimmed);
    setBusy(false);

    if (problem) {
      setStatus(`Not saved. ${problem}`);
      return;
    }
    setLastfmKey(trimmed);
    setStatus("Key works and is saved.");
    Spicetify.showNotification("Prism: Last.fm key saved");
    onSaved?.();
  }

  function onClear() {
    clearLastfmKey();
    setKey("");
    setStatus("Key removed.");
  }

  return (
    <div className="prism-fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }} data-prism="settings">
      <h2 className="prism-screen-title">Prism settings</h2>
      {notice && (
        <p role="status" data-prism="settings-notice" className="prism-notice">
          {notice}
        </p>
      )}
      <p>
        Playlist Prism uses Last.fm to get song-level genre and mood tags. Get a free API key at{" "}
        <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">
          last.fm/api/account/create
        </a>
        , then paste the "API key" (not the "shared secret") below.
      </p>
      <p style={{ color: "var(--spice-subtext)", fontSize: 13 }}>
        The key is stored only in Spotify on this computer. It is never added to the code or git.
      </p>
      <input
        type="password" // hides the key on screen, like a password field
        value={key}
        placeholder="Last.fm API key"
        // onChange runs on every keystroke; we copy the input's text into state.
        onChange={(event) => setKey(event.target.value)}
        className="prism-glass-input"
        style={{ fontSize: 14 }}
      />
      <div className="prism-actions" style={{ display: "flex", gap: 8 }}>
        {/* Spotify's own buttons, so they match the rest of the app. */}
        <ButtonPrimary buttonSize="sm" onClick={onSave} disabled={busy}>
          {busy ? "Testing..." : "Test & save"}
        </ButtonPrimary>
        <ButtonSecondary buttonSize="sm" onClick={onClear} disabled={busy}>
          Remove key
        </ButtonSecondary>
      </div>
      {/* Only show the status line when there is something to say. */}
      {status && <p>{status}</p>}

      <h3 className="prism-heading" style={{ margin: "12px 0 0" }}>Playlist theme</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }} id="prism-playlist-theme-label">
          Background for playlists
        </span>
      </div>
      {/* Picker "D" (developer's pick 2026-11-25): wrapping pills + a strip with the chosen sky. */}
      <div className="prism-seg is-pills" role="group" aria-labelledby="prism-playlist-theme-label">
        {PLAYLIST_THEMES.map((t) => (
          <button key={t.id} type="button" className={playlistTheme === t.id ? "on" : ""} aria-pressed={playlistTheme === t.id} onClick={() => chooseTheme(t.id)} data-prism={`playlist-theme-${t.id}`}>
            {t.label}
          </button>
        ))}
      </div>
      <ThemeStrip theme={playlistTheme} />
      <p style={{ color: "var(--spice-subtext)", fontSize: 13, margin: 0 }}>
        A theme gives every playlist page a moving background, a colour rail beside the songs (each song in its main
        genre's colour) and a genre mix under the title. Genres come from songs Prism has already scanned. No theme:
        playlists look as Spotify makes them. Playlists themselves are never changed.
      </p>

      <h3 className="prism-heading" style={{ margin: "12px 0 0" }}>Lyrics</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }} id="prism-lyrics-label">
          Prism look for lyrics
        </span>
        <div className="prism-seg" role="group" aria-labelledby="prism-lyrics-label">
          <button type="button" className={lyricsOn ? "on" : ""} aria-pressed={lyricsOn} onClick={() => chooseLyrics(true)} data-prism="lyrics-theme-on">
            On
          </button>
          <button type="button" className={!lyricsOn ? "on" : ""} aria-pressed={!lyricsOn} onClick={() => chooseLyrics(false)} data-prism="lyrics-theme-off">
            Off
          </button>
        </div>
      </div>
      <p style={{ color: "var(--spice-subtext)", fontSize: 13, margin: 0 }}>
        On: Spotify's lyrics get your playlist theme's sky (Prism's twilight sky with No theme), and the top and bottom bars always stay (no full screen or
        immersive mode). Off: Spotify's own lyrics, exactly as Spotify makes them.
      </p>

      <h3 className="prism-heading" style={{ margin: "12px 0 0" }}>Side panel</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }} id="prism-panel-label">
          Prism stats in the side panel
        </span>
        <div className="prism-seg" role="group" aria-labelledby="prism-panel-label">
          <button type="button" className={panelOn ? "on" : ""} aria-pressed={panelOn} onClick={() => choosePanel(true)} data-prism="panel-stats-on">
            On
          </button>
          <button type="button" className={!panelOn ? "on" : ""} aria-pressed={!panelOn} onClick={() => choosePanel(false)} data-prism="panel-stats-off">
            Off
          </button>
        </div>
      </div>
      <p style={{ color: "var(--spice-subtext)", fontSize: 13, margin: 0 }}>
        On: when a playlist Prism made or organized is open, the right-hand Now Playing panel shows its stats (with the
        song playing now at the top). Off: the panel stays as Spotify makes it. Right-click a playlist &gt; Prism stats
        always opens the full stats page.
      </p>
    </div>
  );
}
