// The tone editor as a POP-UP over Spotify's playlist page: "Edit" in the
// tone strip (src/ui/toneRows.ts) opens it, so editing a tone doesn't leave
// the playlist. Same editor as the Prism page's (src/ui/ToneEditor.tsx), in
// the standard Prism pop-up (.prism-overlay + .prism-glass-card, wide).
//
// It sits inside Spotify's main view (like the Prism page's own pop-ups sit
// inside the page) and has the class "prism-cosmos" so Prism's colours and
// button styles apply; .prism-overlay's own background (the dim) wins.
// Closes on Cancel, Save, Remove tone, Escape, a click on the dim area, or
// when another page opens. Saving only writes LocalStorage (prism:tones);
// the playlist itself is never changed.

import React from "react";
import { friendlyError, loadTones, loadToneSongs, saveTone } from "../flow";
import { getPlaylistName } from "../spotify/read";
import { ToneEditor } from "./ToneEditor";

const HOST_ID = "playlist-prism-tone-popup";

export function openTonePopup(playlist: string): void {
  const view = document.querySelector(".Root__main-view");
  if (!view || document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  // Covers the main view (the playlist), not Spotify's sidebar or player bar.
  host.style.cssText = "position:absolute;inset:0;z-index:20;";
  if (getComputedStyle(view).position === "static") (view as HTMLElement).style.position = "relative";
  view.appendChild(host);
  const root = (Spicetify.ReactDOM as any).createRoot(host);
  const before = document.activeElement as HTMLElement | null;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    stopListening?.();
    root.unmount();
    host.remove();
    before?.focus?.(); // back to the Edit button
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  const stopListening = Spicetify.Platform.History.listen(() => close()); // another page opened

  root.render(
    <div
      className="prism-cosmos prism-overlay"
      onClick={(event) => event.target === event.currentTarget && close()}
      data-prism="tone-popup"
    >
      <div
        className="prism-glass-card is-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prism-tone-title"
        tabIndex={-1}
        ref={(card) => card?.focus()}
      >
        <ToneEditor
          variant="popup"
          playlist={playlist}
          loadName={getPlaylistName}
          loadSongs={loadToneSongs}
          saved={loadTones()[playlist] ?? null}
          describeError={friendlyError}
          onBack={close}
          onSave={(tone) => {
            saveTone(playlist, tone); // the strip and rings update by themselves
            close();
          }}
          onRemove={() => {
            saveTone(playlist, null);
            close();
          }}
        />
      </div>
    </div>
  );
}
