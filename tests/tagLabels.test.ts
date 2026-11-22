// Unit tests for the preview list's genre labels. Run with: npm test

import { describe, expect, test } from "vitest";
import { TAG_PALETTE, labelsFor, tagColour } from "../src/ui/tagLabels";
import type { SourcedTag } from "../src/tags/combineTags";

const t = (name: string): SourcedTag => ({ name, weight: 1, source: "track" });

describe("tagColour", () => {
  test("always gives a palette colour", () => {
    for (const name of ["r&b", "hip hop", "rap", "", "a very long made-up genre name"]) {
      expect(TAG_PALETTE).toContain(tagColour(name));
    }
  });

  test("the same tag always gets the same colour", () => {
    expect(tagColour("hip hop")).toBe(tagColour("hip hop"));
  });

  test("ignores capitals and spaces at the ends", () => {
    expect(tagColour("  R&B ")).toBe(tagColour("r&b"));
  });

  test("common genres don't all share one colour", () => {
    const common = ["r&b", "hip hop", "rap", "pop", "trap", "soul", "indie", "rock", "electronic", "jazz"];
    expect(new Set(common.map(tagColour)).size).toBeGreaterThanOrEqual(4);
  });
});

describe("labelsFor", () => {
  test("shared tags come first and are marked shared", () => {
    const labels = labelsFor(["rap"], [t("trap"), t("rap"), t("hip hop")]);
    expect(labels.map((l) => [l.name, l.shared])).toEqual([
      ["rap", true],
      ["trap", false],
      ["hip hop", false],
    ]);
  });

  test("a shared tag isn't repeated as an extra, whatever its capitals", () => {
    const labels = labelsFor(["r&b"], [t("R&B"), t("soul")]);
    expect(labels.map((l) => l.name)).toEqual(["r&b", "soul"]);
  });

  test("shows at most `max` labels, keeping shared ones first", () => {
    const labels = labelsFor(["a", "b", "c"], [t("d"), t("e")], 4);
    expect(labels.map((l) => l.name)).toEqual(["a", "b", "c", "d"]);
  });

  test("each label carries its tag's colour", () => {
    const [label] = labelsFor(["pop"], []);
    expect(label.colour).toBe(tagColour("pop"));
  });
});
