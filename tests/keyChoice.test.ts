import { describe, expect, it } from "vitest";
import { chooseLastfmKey, looksLikeLastfmKey, parseSharedKeyReply } from "../src/lastfm/keyChoice";

const A = "0123456789abcdef0123456789abcdef";
const B = "fedcba9876543210fedcba9876543210";

describe("chooseLastfmKey", () => {
  it("uses the user's own key first", () => {
    expect(chooseLastfmKey(A, B)).toEqual({ key: A, source: "own" });
  });

  it("falls back to Prism's shared key", () => {
    expect(chooseLastfmKey(null, B)).toEqual({ key: B, source: "prism" });
    expect(chooseLastfmKey("   ", B)).toEqual({ key: B, source: "prism" });
  });

  it("returns null when there is neither", () => {
    expect(chooseLastfmKey(null, null)).toBeNull();
    expect(chooseLastfmKey("", " ")).toBeNull();
  });
});

describe("parseSharedKeyReply", () => {
  it("reads the relay's key", () => {
    expect(parseSharedKeyReply({ ok: true, key: A })).toBe(A);
  });

  it("rejects errors, missing or malformed keys", () => {
    expect(parseSharedKeyReply({ ok: false, error: "No shared Last.fm key set up." })).toBeNull();
    expect(parseSharedKeyReply({ ok: true })).toBeNull();
    expect(parseSharedKeyReply({ ok: true, key: "not-a-key" })).toBeNull();
    expect(parseSharedKeyReply(null)).toBeNull();
    expect(parseSharedKeyReply("hi")).toBeNull();
  });
});

describe("looksLikeLastfmKey", () => {
  it("wants 32 hex characters", () => {
    expect(looksLikeLastfmKey(A.toUpperCase())).toBe(true);
    expect(looksLikeLastfmKey(A.slice(1))).toBe(false);
    expect(looksLikeLastfmKey(42)).toBe(false);
  });
});
