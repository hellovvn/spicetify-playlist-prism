// Last.fm API key problems: missing, invalid or suspended. Pure, so the
// messages are unit-tested (tests/keyErrors.test.ts).
import { LastfmError } from "./client";
import type { KeySource } from "./keyChoice";

// The step-by-step guide on the guide site (lastfm-key.html; no longer in the README).
export const LASTFM_KEY_GUIDE_URL = "https://hellovvn.github.io/spicetify-prism/lastfm-key.html";

// Our own code for "no key at all": no own key, and Prism's shared key couldn't be
// fetched yet (offline or relay down on the first start). Last.fm's codes are all positive.
export const NO_KEY = -1;
export const INVALID_KEY = 10;
export const SUSPENDED_KEY = 26;

export const noKeyError = () => new LastfmError(NO_KEY, "No Last.fm key saved");

export const isKeyProblem = (error: unknown): boolean =>
  error instanceof LastfmError && (error.code === NO_KEY || error.code === INVALID_KEY || error.code === SUSPENDED_KEY);

// Where users find the settings, worded to work on the Prism page AND in
// Spotify's right-click menus / toasts.
const WHERE = "Prism settings (Settings on the Prism page, or Spotify's profile menu > Prism settings)";

// A message the user can act on, or null when it isn't a key problem.
// source = whose key was in use (storage.getLastfmKeySource): the user's own, or
// Prism's shared one. Only the user's own key is theirs to fix.
export function keyProblemMessage(error: unknown, source: KeySource | null = "own"): string | null {
  if (!(error instanceof LastfmError)) return null;
  if (error.code === NO_KEY) {
    return `Couldn't get Prism's shared Last.fm access (are you online?). Try again, or add your own free Last.fm API key in ${WHERE}.`;
  }
  if (!isKeyProblem(error)) return null;
  if (source === "prism") {
    return `Prism's shared Last.fm access isn't working right now. Try again later, or add your own free Last.fm API key in ${WHERE}.`;
  }
  if (error.code === INVALID_KEY) {
    return `Last.fm doesn't accept your API key. Paste it again in ${WHERE}, and make sure it's the "API key", not the "Shared secret".`;
  }
  if (error.code === SUSPENDED_KEY) {
    return `Last.fm has suspended your API key. Make a new one (the guide in ${WHERE} shows how) and save it there.`;
  }
  return null;
}
