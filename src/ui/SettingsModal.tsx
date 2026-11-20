// Settings popup: lets the user paste, test, and save their Last.fm API key.
//
// This is our first React component. A component is a function that returns
// what to show (JSX, the HTML-like syntax below). When its "state" changes,
// React calls the function again and updates the screen to match.

import React from "react"; // Spicetify Creator maps this to Spotify's own React
import { getLastfmKey, setLastfmKey, clearLastfmKey } from "../storage";
import { testApiKey } from "../lastfm/client";

function SettingsModal() {
  // useState(initial) returns [currentValue, functionToChangeIt].
  // Changing state makes React re-render this component.
  const [key, setKey] = React.useState<string>(getLastfmKey() ?? "");
  const [status, setStatus] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);

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
    Spicetify.showNotification("Playlist Prism: Last.fm key saved");
  }

  function onClear() {
    clearLastfmKey();
    setKey("");
    setStatus("Key removed.");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p>
        Playlist Prism uses Last.fm to get song-level genre and mood tags. Get a free API key at{" "}
        <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">
          last.fm/api/account/create
        </a>
        , then paste the "API key" (not the "shared secret") below.
      </p>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        The key is stored only in Spotify on this computer. It is never added to the code or git.
      </p>
      <input
        type="password" // hides the key on screen, like a password field
        value={key}
        placeholder="Last.fm API key"
        // onChange runs on every keystroke; we copy the input's text into state.
        onChange={(event) => setKey(event.target.value)}
        style={{ padding: 8, borderRadius: 4, border: "1px solid #555", background: "#222", color: "#fff" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={busy}>
          {busy ? "Testing..." : "Test & save"}
        </button>
        <button onClick={onClear} disabled={busy}>
          Remove key
        </button>
      </div>
      {/* Only show the status line when there is something to say. */}
      {status && <p>{status}</p>}
    </div>
  );
}

// Opens the popup. Called from the profile menu and when the key is missing.
export function openSettings() {
  Spicetify.PopupModal.display({
    title: "Playlist Prism settings",
    content: <SettingsModal />,
  });
}
