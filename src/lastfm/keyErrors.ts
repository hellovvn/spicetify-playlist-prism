// Last.fm API key problems: missing, invalid or suspended. Pure, so the
// messages are unit-tested (tests/keyErrors.test.ts).
import { LastfmError } from "./client";

// The step-by-step guide in the README ("Getting a Last.fm API key").
export const LASTFM_KEY_GUIDE_URL = "https://github.com/hellovvn/spicetify-prism#getting-a-lastfm-api-key";

// Our own code for "no key saved" (Last.fm's codes are all positive).
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
export function keyProblemMessage(error: unknown): string | null {
  if (!(error instanceof LastfmError)) return null;
  if (error.code === NO_KEY) {
    return `This needs a free Last.fm API key. Add one in ${WHERE}: there's a short guide there on how to get one.`;
  }
  if (error.code === INVALID_KEY) {
    return `Last.fm doesn't accept your API key. Paste it again in ${WHERE}, and make sure it's the "API key", not the "Shared secret".`;
  }
  if (error.code === SUSPENDED_KEY) {
    return `Last.fm has suspended your API key. Make a new one (the guide in ${WHERE} shows how) and save it there.`;
  }
  return null;
}
