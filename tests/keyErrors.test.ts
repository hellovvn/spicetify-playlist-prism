import { describe, expect, it } from "vitest";
import { LastfmError } from "../src/lastfm/client";
import { isKeyProblem, keyProblemMessage, noKeyError } from "../src/lastfm/keyErrors";

describe("Last.fm key problems", () => {
  it("knows missing, invalid and suspended keys", () => {
    expect(isKeyProblem(noKeyError())).toBe(true);
    expect(isKeyProblem(new LastfmError(10, "Invalid API key"))).toBe(true);
    expect(isKeyProblem(new LastfmError(26, "Suspended"))).toBe(true);
    expect(isKeyProblem(new LastfmError(29, "Rate limit"))).toBe(false);
    expect(isKeyProblem(new Error("boom"))).toBe(false);
  });

  it("gives each problem its own message pointing to settings", () => {
    const missing = keyProblemMessage(noKeyError())!;
    const invalid = keyProblemMessage(new LastfmError(10, "Invalid API key"))!;
    const suspended = keyProblemMessage(new LastfmError(26, "Suspended"))!;
    expect(missing).toMatch(/shared Last\.fm access/);
    expect(invalid).toMatch(/Shared secret/);
    expect(suspended).toMatch(/suspended/);
    for (const message of [missing, invalid, suspended]) expect(message).toMatch(/Prism settings/);
  });

  it("doesn't blame the user for Prism's shared key", () => {
    for (const code of [10, 26]) {
      const message = keyProblemMessage(new LastfmError(code, "x"), "prism")!;
      expect(message).toMatch(/Prism's shared Last\.fm access isn't working/);
      expect(message).not.toMatch(/your API key/);
    }
    expect(keyProblemMessage(new LastfmError(29, "Rate limit"), "prism")).toBeNull();
  });

  it("returns null for other errors", () => {
    expect(keyProblemMessage(new LastfmError(29, "Rate limit"))).toBeNull();
    expect(keyProblemMessage("oops")).toBeNull();
  });
});
