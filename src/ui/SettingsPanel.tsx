// Settings: lets the user paste, test, and save their Last.fm API key.
// Shown on the Prism page (it was a popup before step 12a).
//
// This is our first React component. A component is a function that returns
// what to show (JSX, the HTML-like syntax below). When its "state" changes,
// React calls the function again and updates the screen to match.

import React from "react"; // Spicetify Creator maps this to Spotify's own React
import { getOwnLastfmKey, setLastfmKey, clearLastfmKey, loadLyricsThemeSetting, saveLyricsThemeSetting, loadPanelStatsSetting, savePanelStatsSetting, loadPlaylistThemeSetting, savePlaylistThemeSetting } from "../storage";
import { parsePlaylistTheme, PLAYLIST_THEMES, PLAYLIST_THEME_CHANGED_EVENT, type PlaylistThemeId } from "../theme/playlistTheme";
import { isPanelStatsOn, PANEL_STATS_CHANGED_EVENT } from "./sidePanel";
import { isLyricsThemeOn, LYRICS_THEME_CHANGED_EVENT } from "./lyricsTheme";
import { testApiKey } from "../lastfm/client";
import { ThemeStrip } from "./ThemeStrip";
import { kofiUrl } from "../support";

const supportUrl = kofiUrl();

// A small outline coffee cup for the Support button (follows the text colour).
function CoffeeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 3c0 1 1 1.5 1 2.5M12 3c0 1 1 1.5 1 2.5" />
    </svg>
  );
}

export interface SettingsPanelProps {
  // Shown above the form.
  notice?: string;
  // Opens "Report a bug" / "Suggest an idea" (ReportScreen.tsx).
  onReport?: (kind: "bug" | "idea") => void;
}

export function SettingsPanel({ notice, onReport }: SettingsPanelProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent;

  // useState(initial) returns [currentValue, functionToChangeIt].
  // Changing state makes React re-render this component.
  const [key, setKey] = React.useState<string>(getOwnLastfmKey() ?? "");
  // Whether the user's own key is saved (else Prism's shared key is used).
  const [hasOwnKey, setHasOwnKey] = React.useState<boolean>(getOwnLastfmKey() !== null);
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
    setHasOwnKey(true);
    setStatus("Key works and is saved.");
    Spicetify.showNotification("Prism: Last.fm key saved");
  }

  function onClear() {
    clearLastfmKey();
    setKey("");
    setHasOwnKey(false);
    setStatus("Key removed. Prism's shared key is used again.");
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
        Prism uses Last.fm to get song-level genre and mood tags. It works straight away with Prism's
        shared Last.fm key, so you don't need to do anything.
      </p>
      <p style={{ color: "var(--spice-subtext)", fontSize: 13 }} data-prism="lastfm-key-source">
        {hasOwnKey ? "Using your own Last.fm key." : "Using Prism's shared Last.fm key."} Want your own (for example
        if the shared one is busy)? Get a free API key at{" "}
        <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">
          last.fm/api/account/create
        </a>
        , paste the "API key" (not the "shared secret") below and choose Test &amp; save. It is stored only in
        Spotify on this computer.
      </p>
      <input
        type="password" // hides the key on screen, like a password field
        value={key}
        placeholder="Your own Last.fm API key (optional)"
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

      {onReport && (
        <>
          <h3 className="prism-heading" style={{ margin: "12px 0 0" }}>Help make Prism better</h3>
          <p style={{ color: "var(--spice-subtext)", fontSize: 13, margin: 0 }}>
            Found something broken, or wish Prism did something? Tell us. Reports are posted publicly on Prism's GitHub.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ButtonSecondary buttonSize="sm" onClick={() => onReport("bug")} data-prism="report-bug">
              Report a bug
            </ButtonSecondary>
            <ButtonSecondary buttonSize="sm" onClick={() => onReport("idea")} data-prism="report-idea">
              Suggest an idea
            </ButtonSecondary>
          </div>
        </>
      )}

      {/* Credit required by Last.fm's API terms ("credit Last.fm and include links"). Text only:
          their logo needs written approval. Developer's pick "A" (2026-11-25). */}
      <h3 className="prism-heading" style={{ margin: "12px 0 0" }}>About</h3>
      <p style={{ color: "var(--spice-subtext)", fontSize: 13, margin: 0 }} data-prism="lastfm-credit">
        Genre and mood tags and similar songs come from{" "}
        <a href="https://www.last.fm/" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
          Last.fm
        </a>
        . Tempo, key and lyrics come from Spotify. Prism isn't made by or connected to Last.fm or Spotify.
      </p>
      {/* Support button (developer's pick "A", 2026-11-25): the standard glass button as a plain
          link to Ko-fi (opens in the browser). Hidden until KOFI_USERNAME is set in src/support.ts. */}
      {supportUrl && (
        <>
          <p style={{ color: "var(--spice-subtext)", fontSize: 13, margin: "4px 0 0" }}>
            Prism is free. If it makes your playlists nicer, you can buy me a coffee.
          </p>
          <a
            href={supportUrl}
            target="_blank"
            rel="noreferrer"
            className="prism-glass-button"
            data-prism="support-prism"
            style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
          >
            <CoffeeIcon />
            Support Prism
          </a>
        </>
      )}
    </div>
  );
}
