import { describe, expect, it } from "vitest";
import { kofiUrl } from "../src/support";

describe("kofiUrl", () => {
  it("builds the Ko-fi page link", () => {
    expect(kofiUrl("prism_dev")).toBe("https://ko-fi.com/prism_dev");
    expect(kofiUrl("  prism  ")).toBe("https://ko-fi.com/prism");
  });

  it("gives no link while the username is empty or odd", () => {
    expect(kofiUrl("")).toBeNull();
    expect(kofiUrl("a/b")).toBeNull();
    expect(kofiUrl("x?y=1")).toBeNull();
  });
});
