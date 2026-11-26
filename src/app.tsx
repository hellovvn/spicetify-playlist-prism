// Playlist Prism: the PAGE (a Spicetify "custom app", since step 12a).
//
// Spicetify shows this when you open /playlist-prism, e.g. by clicking the
// Prism icon in Spotify's header (Spicetify adds that icon for custom apps;
// its picture is src/assets/prism.svg, set in src/settings.json).
// The always-on part (right-click menu etc.) is in src/extensions/prism.tsx.

import React from "react";
import { PrismPage } from "./ui/PrismPage";
import { startErrorLog } from "./report/errorLog";

// Remember Prism's last few warnings, so a bug report can include them (memory only).
startErrorLog();

export default function App() {
  return <PrismPage />;
}
