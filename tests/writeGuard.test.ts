// Safety net for the hard rule "never modify existing playlists".
// This test reads every file in src/ as TEXT and fails if any file other than
// src/spotify/write.ts calls a Spotify function that changes something.
// It automates the CLAUDE.md checklist item "grep for any other write call".
//
// (A "static check": it inspects the code itself, without running it.)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const SRC = join(__dirname, "..", "src");
const WRITE_MODULE = "spotify/write.ts";

// Spotify Platform functions that change the user's library or playlists.
const WRITE_CALL =
  /\b(PlaylistAPI|RootlistAPI|LibraryAPI)\s*\.\s*(add|remove|move|createPlaylist|updateDetails|setAttributes|clearAttributes|uploadImage|createFolder|renameFolder|removeFolder|moveFolder|pin|unpin)\s*\(/g;
// Also catch the old Web API writes, in case someone tries CosmosAsync.
const WEB_API_WRITE = /CosmosAsync\s*\.\s*(post|put|del|delete)\s*\(/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "types" ? [] : sourceFiles(path); // types = Spicetify's own definitions
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  name: relative(SRC, path).replace(/\\/g, "/"),
  text: readFileSync(path, "utf8"),
}));

describe("write guard (static check of src/)", () => {
  test("finds the source files (so the checks below aren't empty)", () => {
    expect(files.map((f) => f.name)).toContain(WRITE_MODULE);
    expect(files.length).toBeGreaterThan(10);
  });

  test.each(files.filter((f) => f.name !== WRITE_MODULE).map((f) => [f.name, f.text]))(
    "%s makes no Spotify write calls",
    (_name, text) => {
      expect([...text.matchAll(WRITE_CALL)].map((m) => m[0])).toEqual([]);
      expect([...text.matchAll(WEB_API_WRITE)].map((m) => m[0])).toEqual([]);
    }
  );

  test("write.ts itself only creates a playlist, adds to it, and does Merge's rename", () => {
    const text = files.find((f) => f.name === WRITE_MODULE)!.text;
    const calls = [...text.matchAll(WRITE_CALL)].map((m) => `${m[1]}.${m[2]}`).sort();
    expect(calls).toEqual(["PlaylistAPI.add", "PlaylistAPI.updateDetails", "RootlistAPI.createPlaylist"]);
    // The rename passes the NAME only (never description or cover).
    expect(text).toMatch(/PlaylistAPI\.updateDetails\(playlistUri, \{ name \}\)/);
    expect([...text.matchAll(WEB_API_WRITE)]).toEqual([]);
  });
});
