import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { buildIssue, noMentions, parseReport, LIMITS } from "../relay/src/report";
import { importPrivateKey, makeAppJwt } from "../relay/src/githubAuth";

const good = {
  kind: "bug",
  title: "Scan stuck at 0",
  fields: [
    { label: "What were you doing?", text: "Started a scan on Liked Songs" },
    { label: "What happened?", text: "It stayed at 0 of 250" },
  ],
  details: { Prism: "0.9.0", Screen: "scan" },
};

describe("parseReport", () => {
  it("accepts a normal report", () => {
    const r = parseReport(good);
    expect(r.ok).toBe(true);
  });

  it("rejects a wrong kind, missing title and non-objects", () => {
    expect(parseReport({ ...good, kind: "spam" }).ok).toBe(false);
    expect(parseReport({ ...good, title: 5 }).ok).toBe(false);
    expect(parseReport("hi").ok).toBe(false);
    expect(parseReport([good]).ok).toBe(false);
  });

  it("rejects reports where every answer is empty", () => {
    expect(parseReport({ ...good, fields: [{ label: "What happened?", text: "   " }] }).ok).toBe(false);
  });

  it("drops empty answers but keeps the rest", () => {
    const r = parseReport({ ...good, fields: [...good.fields, { label: "Anything else?", text: "" }] });
    expect(r.ok && r.report.fields.length).toBe(2);
  });

  it("enforces the size limits", () => {
    expect(parseReport({ ...good, title: "x".repeat(LIMITS.titleMax + 1) }).ok).toBe(false);
    expect(parseReport({ ...good, fields: [{ label: "A", text: "x".repeat(LIMITS.textMax + 1) }] }).ok).toBe(false);
    const many = Array.from({ length: LIMITS.fieldsMax + 1 }, (_, i) => ({ label: `Q${i}`, text: "a" }));
    expect(parseReport({ ...good, fields: many }).ok).toBe(false);
    expect(parseReport({ ...good, details: { Prism: 1 } }).ok).toBe(false);
  });

  it("puts a multi-line title on one line", () => {
    const r = parseReport({ ...good, title: "Scan\nstuck" });
    expect(r.ok && r.report.title).toBe("Scan stuck");
  });
});

describe("buildIssue", () => {
  it("makes the title, sections, details block and labels", () => {
    const r = parseReport(good);
    if (!r.ok) throw new Error(r.error);
    const issue = buildIssue(r.report);
    expect(issue.title).toBe("[Bug] Scan stuck at 0");
    expect(issue.body).toContain("### What happened?\n\nIt stayed at 0 of 250");
    expect(issue.body).toContain("Prism: 0.9.0");
    expect(issue.labels).toEqual(["bug", "from-prism"]);
  });

  it("never notifies anyone and can't break out of the details block", () => {
    const r = parseReport({
      kind: "idea",
      title: "Ping @hellovvn",
      fields: [{ label: "Idea", text: "cc @someone and email a@b.com" }],
      details: { Note: "```\n@x" },
    });
    if (!r.ok) throw new Error(r.error);
    const issue = buildIssue(r.report);
    expect(issue.title).not.toMatch(/@[a-z]/i);
    expect(issue.body).not.toMatch(/@[a-z]/i);
    expect(issue.body.match(/```/g)?.length).toBe(2); // only our own fence
  });
});

describe("noMentions", () => {
  it("leaves a lone @ alone", () => {
    expect(noMentions("meet @ 5")).toBe("meet @ 5");
  });
});

describe("GitHub App JWT", () => {
  it("signs with a PKCS#1 key (GitHub's .pem format) and verifies", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    expect(pem).toContain("BEGIN RSA PRIVATE KEY");

    const key = await importPrivateKey(pem);
    const jwt = await makeAppJwt("5928498", key, 1_700_000_000);
    const [h, p, s] = jwt.split(".");

    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(payload).toEqual({ iat: 1_700_000_000 - 60, exp: 1_700_000_000 + 540, iss: "5928498" });

    const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });

  it("also reads a PKCS#8 key", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    await expect(importPrivateKey(pem)).resolves.toBeDefined();
  });
});
