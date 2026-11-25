// THEME PREVIEW STRIP (picker "D", developer's pick 2026-11-25): a wide strip
// under the theme pills showing the chosen theme's REAL moving sky (the same
// buildSky the playlist pages use), so you see what you pick. "No theme" shows
// Spotify's plain dark grey with a short line saying so.

import React from "react";
import { buildSky } from "./playlistTheme";
import { PLAYLIST_THEMES, type PlaylistThemeId } from "../theme/playlistTheme";

export function ThemeStrip({ theme }: { theme: PlaylistThemeId }) {
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.querySelectorAll(".prism-pl-sky").forEach((sky) => sky.remove());
    if (theme !== "none") el.prepend(buildSky(theme, el, false));
  }, [theme]);
  const label = PLAYLIST_THEMES.find((t) => t.id === theme)?.label ?? "";
  return (
    <div ref={box} className="prism-theme-strip" data-prism="theme-strip" data-theme={theme} aria-label={`Preview: ${label}`} role="img">
      {theme === "none" && <span className="prism-theme-strip-none">Spotify's own look</span>}
    </div>
  );
}
