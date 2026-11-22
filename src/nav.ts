// How the rest of Spotify talks to the Playlist Prism page.
//
// The page lives at /playlist-prism (a Spicetify "custom app"). The right-click
// menu, the profile menu and the smoke test are in a DIFFERENT script (they
// run all the time, the page only when it's open), so they can't call the
// page's code directly. Instead they NAVIGATE to the page with a request in
// the address, like a link with a search query:
//
//   /playlist-prism?go=start&seed=spotify:track:abc&r=17
//
// `r` is a request number: the page handles each request once, so going Back
// in Spotify's history doesn't restart a Prism.
// The pure parts are unit-tested in tests/nav.test.ts.

export const PAGE_PATH = "/playlist-prism";

export type PageRequest =
  | { go: "start"; seed: string } // start a Prism for this song
  | { go: "settings" } // show the settings (Last.fm key)
  | { go: "home" } // the start screen
  | { go: "stats"; playlist: string } // the stats page for a Prism playlist
  | { go: "demo-scan" } // DEV/TEST: scan screen with a fake scan (smoke test)
  | { go: "demo-stats" }; // DEV/TEST: stats page with sample numbers (smoke test)

export function pageUrl(request: PageRequest, requestId: string): string {
  const params = new URLSearchParams({ go: request.go });
  if (request.go === "start") params.set("seed", request.seed);
  if (request.go === "stats") params.set("playlist", request.playlist);
  params.set("r", requestId);
  return `${PAGE_PATH}?${params.toString()}`;
}

// Reads a request back from the address's "?..." part. null = no (valid) request.
export function parsePageRequest(search: string): { request: PageRequest; requestId: string } | null {
  const params = new URLSearchParams(search);
  const requestId = params.get("r");
  const go = params.get("go");
  if (!requestId || !go) return null;
  if (go === "start") {
    const seed = params.get("seed");
    return seed && isTrackUri(seed) ? { request: { go, seed }, requestId } : null;
  }
  if (go === "stats") {
    const playlist = params.get("playlist");
    return playlist && isPlaylistUri(playlist) ? { request: { go, playlist }, requestId } : null;
  }
  if (go === "settings" || go === "home" || go === "demo-scan" || go === "demo-stats") return { request: { go }, requestId };
  return null;
}

const TRACK_ID = /^[A-Za-z0-9]{22}$/;

function isTrackUri(text: string): boolean {
  const [scheme, type, id] = text.split(":");
  return scheme === "spotify" && type === "track" && TRACK_ID.test(id ?? "");
}

// "spotify:playlist:" + a 22-character ID (same ID shape as songs).
export function isPlaylistUri(text: string): boolean {
  const parts = text.split(":");
  return parts.length === 3 && parts[0] === "spotify" && parts[1] === "playlist" && TRACK_ID.test(parts[2]);
}

// A pasted song link -> "spotify:track:ID", or null if it isn't a song link.
// Accepts: spotify:track:ID, https://open.spotify.com/track/ID?si=...,
// and links with a language part like open.spotify.com/intl-de/track/ID.
export function parseTrackLink(text: string): string | null {
  const trimmed = text.trim();
  if (isTrackUri(trimmed)) return trimmed;
  const match = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})(?:[?#/].*)?$/i.exec(trimmed);
  return match ? `spotify:track:${match[1]}` : null;
}

// Opens the page with a request (just navigation, like clicking a link).
let requestCounter = 0;
export function openPage(request: PageRequest): void {
  const requestId = `${Date.now()}-${++requestCounter}`;
  Spicetify.Platform.History.push(pageUrl(request, requestId));
}
