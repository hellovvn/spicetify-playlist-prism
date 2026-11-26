// Settings: playlist theme, lyrics and side-panel switches, the optional Last.fm key,
// feedback and About, split into sections with a side rail (layout "B", 2026-11-26).
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
import { LASTFM_KEY_GUIDE_URL } from "../lastfm/keyErrors";
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

// Small outline icons for the side rail (follow the text colour, 16px).
function RailIcon({ d }: { d: string[] }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

// The Settings sections, in rail order (layout "B, side rail", developer's pick 2026-11-26).
export type SettingsSection = "theme" | "look" | "lastfm" | "feedback" | "about";
const SECTIONS: { id: SettingsSection; label: string; icon: string[] }[] = [
  { id: "theme", label: "Theme", icon: ["M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1 3.7A1.5 1.5 0 0 1 12 21z", "M7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01"] },
  { id: "look", label: "Lyrics and panel", icon: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"] },
  { id: "lastfm", label: "Last.fm", icon: ["M3 12V4h8l9 9-8 8z", "M7.5 8h.01"] },
  { id: "feedback", label: "Feedback", icon: ["M4 5h16v11H9l-5 4z"] },
  { id: "about", label: "About", icon: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5M12 8h.01"] },
];
// Remembered while Spotify runs, so coming back from the report form (or
// reopening Settings) lands on the same section.
let lastSection: SettingsSection = "theme";

export interface SettingsPanelProps {
  // Shown above the form.
  notice?: string;
  // Opens "Report a bug" / "Suggest an idea" (ReportScreen.tsx).
  onReport?: (kind: "bug" | "idea") => void;
}

export function SettingsPanel({ notice, onReport }: SettingsPanelProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent;

  // Which section shows. A notice is about the Last.fm key, so it opens that one.
  const [section, setSectionState] = React.useState<SettingsSection>(notice ? "lastfm" : lastSection);
  function setSection(id: SettingsSection) {
    lastSection = id;
    setSectionState(id);
  }
  const railRef = React.useRef<HTMLDivElement>(null);
  // Up/Down (and Home/End) move between sections, like any tab list.
  function onRailKey(event: React.KeyboardEvent) {
    const i = SECTIONS.findIndex((s) => s.id === section);
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight" ? (i + 1) % SECTIONS.length
      : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (i - 1 + SECTIONS.length) % SECTIONS.length
      : event.key === "Home" ? 0
      : event.key === "End" ? SECTIONS.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    setSection(SECTIONS[next].id);
    railRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }

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


  const sub = { color: "var(--spice-subtext)", fontSize: 13, margin: 0 } as const;
  const link = { color: "inherit", textDecoration: "underline" } as const;

  return (
    <div className="prism-fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }} data-prism="settings">
      <h2 className="prism-screen-title">Prism settings</h2>
      {notice && (
        <p role="status" data-prism="settings-notice" className="prism-notice">
          {notice}
        </p>
      )}
      {/* Side rail (left) + the chosen section (right). Narrow: the rail becomes a row on top. */}
      <div className="prism-settings-wrap">
      <div className="prism-settings">
        <div className="prism-glass-panel prism-rail-nav" role="tablist" aria-orientation="vertical" aria-label="Settings sections" ref={railRef} onKeyDown={onRailKey}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`prism-settings-tab-${s.id}`}
              aria-selected={section === s.id}
              aria-controls="prism-settings-section"
              tabIndex={section === s.id ? 0 : -1}
              className={section === s.id ? "on" : ""}
              onClick={() => setSection(s.id)}
              data-prism={`settings-tab-${s.id}`}
            >
              <RailIcon d={s.icon} />
              {s.label}
            </button>
          ))}
        </div>
        <div
          className="prism-glass-panel prism-settings-section"
          role="tabpanel"
          id="prism-settings-section"
          aria-labelledby={`prism-settings-tab-${section}`}
          data-prism={`settings-section-${section}`}
          key={section}
        >
          {section === "theme" && (
            <>
              <h3 className="prism-heading">Playlist theme</h3>
              <span style={{ fontSize: 13, fontWeight: 600 }} id="prism-playlist-theme-label">
                Background for playlists
              </span>
              {/* Picker "D" (developer's pick 2026-11-25): wrapping pills + a strip with the chosen sky. */}
              <div className="prism-seg is-pills" role="group" aria-labelledby="prism-playlist-theme-label">
                {PLAYLIST_THEMES.map((t) => (
                  <button key={t.id} type="button" className={playlistTheme === t.id ? "on" : ""} aria-pressed={playlistTheme === t.id} onClick={() => chooseTheme(t.id)} data-prism={`playlist-theme-${t.id}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <ThemeStrip theme={playlistTheme} />
              <p style={sub}>
                A theme gives every playlist page a moving background, a colour rail beside the songs (each song in its main
                genre's colour) and a genre mix under the title. Genres come from songs Prism has already scanned. No theme:
                playlists look as Spotify makes them. Playlists themselves are never changed.
              </p>
            </>
          )}

          {section === "look" && (
            <>
              <h3 className="prism-heading">Lyrics</h3>
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
              <p style={sub}>
                On: Spotify's lyrics get your playlist theme's sky (Prism's twilight sky with No theme), and the top and bottom
                bars always stay (no full screen or immersive mode). Off: Spotify's own lyrics, exactly as Spotify makes them.
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
              <p style={sub}>
                On: when a playlist is open, the right-hand Now Playing panel shows its stats (with the song playing now at the
                top). Off: the panel stays as Spotify makes it. Right-click a playlist &gt; Prism stats always opens the full
                stats page.
              </p>
            </>
          )}

          {section === "lastfm" && (
            <>
              <h3 className="prism-heading">Last.fm key</h3>
              <p style={{ margin: 0 }}>
                Prism uses Last.fm for song-level genre and mood tags. It works straight away with Prism's shared Last.fm key,
                so you don't need to do anything.
              </p>
              <p style={sub} data-prism="lastfm-key-source">
                {hasOwnKey ? "Using your own Last.fm key." : "Using Prism's shared Last.fm key."} You can add your own
                (optional, for example if the shared one is busy). It is stored only in Spotify on this computer.
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
              {/* How to get a key: short steps instead of one long sentence. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ margin: 0 }}>
                  1. Get a free API key at{" "}
                  <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer" style={link}>
                    last.fm/api/account/create
                  </a>
                </p>
                <p style={{ margin: 0 }}>2. Paste the "API key" (not the "Shared secret") in the box above</p>
                <p style={{ margin: 0 }}>3. Click Test & save</p>
                <p style={{ ...sub, margin: "4px 0 0" }}>
                  Want your own key? Here's a{" "}
                  <a href={LASTFM_KEY_GUIDE_URL} target="_blank" rel="noreferrer" data-prism="lastfm-key-guide" style={link}>
                    step-by-step guide
                  </a>
                  .
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {/* Spotify's own buttons, so they match the rest of the app. */}
                <ButtonPrimary buttonSize="sm" onClick={onSave} disabled={busy}>
                  {busy ? "Testing..." : "Test & save"}
                </ButtonPrimary>
                <ButtonSecondary buttonSize="sm" onClick={onClear} disabled={busy}>
                  Remove key
                </ButtonSecondary>
              </div>
              {/* Only show the status line when there is something to say. */}
              {status && <p style={{ margin: 0 }}>{status}</p>}
            </>
          )}

          {section === "feedback" && (
            <>
              <h3 className="prism-heading">Help make Prism better</h3>
              <p style={sub}>
                Found something broken, or wish Prism did something? Tell us. Reports are posted publicly on Prism's GitHub.
              </p>
              {onReport && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ButtonSecondary buttonSize="sm" onClick={() => onReport("bug")} data-prism="report-bug">
                    Report a bug
                  </ButtonSecondary>
                  <ButtonSecondary buttonSize="sm" onClick={() => onReport("idea")} data-prism="report-idea">
                    Suggest an idea
                  </ButtonSecondary>
                </div>
              )}
            </>
          )}

          {section === "about" && (
            <>
              {/* Credit required by Last.fm's API terms ("credit Last.fm and include links"). Text only:
                  their logo needs written approval. Developer's pick "A" (2026-11-25). */}
              <h3 className="prism-heading">About</h3>
              <p style={sub} data-prism="lastfm-credit">
                Genre and mood tags and similar songs come from{" "}
                <a href="https://www.last.fm/" target="_blank" rel="noreferrer" style={link}>
                  Last.fm
                </a>
                . Tempo, key and lyrics come from Spotify. Prism isn't made by or connected to Last.fm or Spotify.
              </p>
              {/* Support button (developer's pick "A", 2026-11-25): the standard glass button as a plain
                  link to Ko-fi (opens in the browser). Hidden until KOFI_USERNAME is set in src/support.ts. */}
              {supportUrl && (
                <>
                  <p style={{ ...sub, margin: "4px 0 0" }}>Prism is free. If it makes your playlists nicer, you can buy me a coffee.</p>
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
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
