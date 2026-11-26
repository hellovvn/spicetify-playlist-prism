// Which Last.fm API key Prism uses (pure, tested in tests/keyChoice.test.ts).
//
// 1. The user's OWN key, if they added one in Settings.
// 2. Otherwise Prism's shared key, which the relay hands out (GET /lastfm-key,
//    relay/src/worker.ts) and Prism keeps a copy of in LocalStorage.
// The shared key is a read-only Last.fm app key: no shared secret, no sign-in.

export type KeySource = "own" | "prism";

export interface ChosenKey {
  key: string;
  source: KeySource;
}

/** Last.fm API keys are 32 hex characters. */
export function looksLikeLastfmKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value.trim());
}

/** The relay's reply `{ ok: true, key }` -> the key, or null if it's missing or malformed. */
export function parseSharedKeyReply(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const { ok, key } = data as { ok?: unknown; key?: unknown };
  return ok === true && looksLikeLastfmKey(key) ? key.trim() : null;
}

/** The user's own key wins; Prism's shared key is the fallback. */
export function chooseLastfmKey(own: string | null, shared: string | null): ChosenKey | null {
  const ownKey = own?.trim();
  if (ownKey) return { key: ownKey, source: "own" };
  const sharedKey = shared?.trim();
  if (sharedKey) return { key: sharedKey, source: "prism" };
  return null;
}
