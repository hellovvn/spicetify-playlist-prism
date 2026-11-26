import { describe, expect, it } from "vitest";
import {
  buildReport,
  detailsFor,
  emptyForm,
  logContext,
  missingAnswer,
  osFrom,
  pushRecent,
  scrubText,
  spotifyVersionFrom,
} from "../src/report/report";

describe("missingAnswer", () => {
  it("needs a title and the main answer", () => {
    const bug = emptyForm("bug");
    expect(missingAnswer(bug)).toMatch(/title/);
    expect(missingAnswer({ ...bug, title: "Scan stuck" })).toMatch(/What happened/);
    expect(missingAnswer({ ...bug, title: "Scan stuck", second: "Stays at 0" })).toBeNull();
    const idea = { ...emptyForm("idea"), title: "Pink theme" };
    expect(missingAnswer(idea)).toMatch(/Your idea/);
    expect(missingAnswer({ ...idea, first: "A pink theme" })).toBeNull();
  });
});

describe("buildReport", () => {
  it("makes a bug report with the questions as labels and how often", () => {
    const r = buildReport(
      { ...emptyForm("bug"), title: "Scan stuck", first: "Scanning", second: "Stays at 0", frequency: "Every time" },
      { Prism: "0.1.0" },
    );
    if ("error" in r) throw new Error(r.error);
    expect(r.kind).toBe("bug");
    expect(r.fields.map((f) => f.label)).toEqual(["What were you doing?", "What happened?", "How often?"]);
    expect(r.fields[2].text).toBe("Every time");
    expect(r.details).toEqual({ Prism: "0.1.0" });
  });

  it("makes an idea without the bug-only questions, and leaves details out when turned off", () => {
    const r = buildReport({ ...emptyForm("idea"), title: "Pink theme", first: "Make it pink", expected: "x" }, null);
    if ("error" in r) throw new Error(r.error);
    expect(r.fields.map((f) => f.label)).toEqual(["Your idea"]);
    expect(r.details).toBeUndefined();
  });

  it("returns the relay's own error for something it would refuse", () => {
    const r = buildReport({ ...emptyForm("idea"), title: "x".repeat(200), first: "Hi" }, null);
    expect("error" in r && r.error).toMatch(/too long/);
  });
});

describe("detailsFor", () => {
  it("lists the setup and numbers the errors", () => {
    const d = detailsFor({
      prismVersion: "0.1.0",
      spicetifyVersion: "2.46.4",
      os: "Windows",
      screen: "scan",
      playlistTheme: "Starry night",
      recentErrors: ["a", "b"],
    });
    expect(Object.keys(d)).toEqual(["Prism", "Spicetify", "System", "Screen", "Playlist theme", "Error 1", "Error 2"]);
    expect(detailsFor({ prismVersion: "1", screen: "home", playlistTheme: "No theme", recentErrors: [] })["Recent errors"]).toBe("none");
  });
});

describe("scrubText", () => {
  it("hides the key, Spotify ids, quoted names and long text", () => {
    const key = "0123456789abcdef0123456789abcdef";
    expect(scrubText(`Last.fm failed: https://ws.audioscrobbler.com/2.0/?api_key=${key}&method=x`, [key])).not.toContain(key);
    expect(scrubText("url ?api_key=OLDKEY123&x=1")).toBe("url ?api_key=[hidden]&x=1");
    expect(scrubText("add to spotify:playlist:37i9dQZF1DX failed")).toBe("add to spotify:playlist failed");
    expect(scrubText("open https://open.spotify.com/track/abc123?si=x now")).toBe("open spotify:track now");
    expect(scrubText('couldn\'t save "Dark Romance"')).toBe("couldn't save …");
    expect(scrubText("x".repeat(500)).length).toBe(200);
  });
});

describe("log lines", () => {
  it("cuts the song name after ' for '", () => {
    expect(logContext("tags failed for Snooze · SZA")).toBe("tags failed for …");
    expect(logContext("adding songs failed")).toBe("adding songs failed");
  });

  it("keeps the newest 5 and skips an immediate repeat", () => {
    let list: string[] = [];
    for (const l of ["a", "a", "b", "c", "d", "e", "f"]) list = pushRecent(list, l);
    expect(list).toEqual(["b", "c", "d", "e", "f"]);
  });
});

describe("versions", () => {
  it("reads the OS and Spotify version from the user agent", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Spotify/1.2.52.442 Safari/537.36";
    expect(osFrom(ua)).toBe("Windows");
    expect(spotifyVersionFrom(ua)).toBe("1.2.52.442");
    expect(spotifyVersionFrom("Chrome")).toBeUndefined();
  });
});
