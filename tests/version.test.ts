import { describe, expect, it } from "vitest";
import {
  CHECK_EVERY_MS,
  INSTALL_GUIDE_URL,
  isNewer,
  needsCheck,
  noticeFor,
  parseSavedCheck,
  parseVersion,
  readRelease,
  showsUpdateCommand,
  UPDATE_COMMAND,
} from "../src/update/version";

describe("parseVersion / isNewer", () => {
  it("reads tags with or without v", () => {
    expect(parseVersion("v0.2.0")).toEqual([0, 2, 0]);
    expect(parseVersion("Prism 1.10")).toEqual([1, 10, 0]);
    expect(parseVersion("latest")).toBeNull();
  });
  it("compares numbers, not text", () => {
    expect(isNewer("0.10.0", "0.9.0")).toBe(true);
    expect(isNewer("0.1.0", "0.1.0")).toBe(false);
    expect(isNewer("0.1.0", "0.2.0")).toBe(false);
    expect(isNewer("junk", "0.1.0")).toBe(false);
  });
});

describe("readRelease", () => {
  const good = { tag_name: "v0.2.0", html_url: "https://github.com/hellovvn/spicetify-prism/releases/tag/v0.2.0" };
  it("takes the version and page", () => {
    expect(readRelease(good)).toEqual({ version: "0.2.0", url: good.html_url });
  });
  it("skips drafts, pre-releases, odd links and junk", () => {
    expect(readRelease({ ...good, prerelease: true })).toBeNull();
    expect(readRelease({ ...good, draft: true })).toBeNull();
    expect(readRelease({ ...good, html_url: "https://evil.example/x" })).toBeNull();
    expect(readRelease(null)).toBeNull();
    expect(readRelease({ message: "Not Found" })).toBeNull();
  });
});

describe("saved check", () => {
  it("parses and rejects junk", () => {
    expect(parseSavedCheck('{"checkedAt":5,"latest":null}')).toEqual({ checkedAt: 5, latest: null });
    expect(parseSavedCheck("{oops")).toBeNull();
    expect(parseSavedCheck(null)).toBeNull();
  });
  it("asks again after a day", () => {
    expect(needsCheck(null, 0)).toBe(true);
    expect(needsCheck({ checkedAt: 1000, latest: null }, 1000 + CHECK_EVERY_MS - 1)).toBe(false);
    expect(needsCheck({ checkedAt: 1000, latest: null }, 1000 + CHECK_EVERY_MS)).toBe(true);
    expect(needsCheck({ checkedAt: 5000, latest: null }, 1000)).toBe(true); // clock went back
  });
});

describe("noticeFor", () => {
  const r = { version: "0.2.0", url: "https://github.com/x" };
  it("shows a newer release", () => expect(noticeFor(r, "0.1.0", null)).toBe(r));
  it("hides when up to date or no release", () => {
    expect(noticeFor(r, "0.2.0", null)).toBeNull();
    expect(noticeFor(null, "0.1.0", null)).toBeNull();
  });
  it("Not now hides that version only", () => {
    expect(noticeFor(r, "0.1.0", "0.2.0")).toBeNull();
    expect(noticeFor({ ...r, version: "0.3.0" }, "0.1.0", "0.2.0")).not.toBeNull();
  });
});

describe("how to update", () => {
  it("re-runs the install script from main", () => {
    expect(UPDATE_COMMAND).toContain("/hellovvn/spicetify-prism/main/install.ps1");
    expect(INSTALL_GUIDE_URL).toBe("https://github.com/hellovvn/spicetify-prism#install");
  });
  it("shows the PowerShell line except on macOS and Linux", () => {
    expect(showsUpdateCommand("Windows")).toBe(true);
    expect(showsUpdateCommand(undefined)).toBe(true);
    expect(showsUpdateCommand("macOS")).toBe(false);
    expect(showsUpdateCommand("Linux")).toBe(false);
  });
});
