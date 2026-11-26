// Turns a report sent from Prism into a GitHub issue (title, body, labels).
// Pure: no network, no Cloudflare APIs, so it is unit-tested (tests/relayReport.test.ts).
//
// Everything in a report is untrusted (anyone can call the relay), so this module
// checks every field's type and size and makes the text safe to post:
// - "@name" would notify that GitHub user, so a zero-width space is put after the "@".
// - Auto-attached details go in a code block, so they can't add links or formatting.

export type ReportKind = "bug" | "idea";

/** One question on the form and the user's answer, e.g. "What happened?" + text. */
export interface ReportField {
  label: string;
  text: string;
}

/** What Prism sends to the relay (POST /report, JSON). */
export interface ReportInput {
  kind: ReportKind;
  title: string;
  fields: ReportField[];
  /** Auto-attached, shown to the user before sending: versions, screen, recent errors. */
  details?: Record<string, string>;
}

export interface IssueDraft {
  title: string;
  body: string;
  labels: string[];
}

export const LIMITS = {
  titleMin: 3,
  titleMax: 120,
  fieldsMax: 8,
  labelMax: 60,
  textMax: 4000,
  totalTextMax: 12000,
  detailsMax: 20,
  detailKeyMax: 40,
  detailValueMax: 500,
} as const;

const KIND_TITLES: Record<ReportKind, string> = { bug: "Bug", idea: "Idea" };
const KIND_LABELS: Record<ReportKind, string> = { bug: "bug", idea: "idea" };
export const FROM_PRISM_LABEL = "from-prism";

export type ParseResult = { ok: true; report: ReportInput } | { ok: false; error: string };

/** Checks untrusted JSON and returns a clean ReportInput, or the first problem found. */
export function parseReport(raw: unknown): ParseResult {
  if (!isObject(raw)) return fail("The report must be a JSON object.");

  const kind = raw.kind;
  if (kind !== "bug" && kind !== "idea") return fail('"kind" must be "bug" or "idea".');

  if (typeof raw.title !== "string") return fail('"title" must be text.');
  const title = oneLine(raw.title);
  if (title.length < LIMITS.titleMin) return fail("The title is too short.");
  if (title.length > LIMITS.titleMax) return fail("The title is too long.");

  if (!Array.isArray(raw.fields)) return fail('"fields" must be a list.');
  if (raw.fields.length > LIMITS.fieldsMax) return fail("Too many fields.");
  const fields: ReportField[] = [];
  let total = 0;
  for (const f of raw.fields) {
    if (!isObject(f) || typeof f.label !== "string" || typeof f.text !== "string") {
      return fail("Each field needs a label and text.");
    }
    const label = oneLine(f.label);
    const text = f.text.replace(/\r\n?/g, "\n").trim();
    if (!label || label.length > LIMITS.labelMax) return fail("A field label is empty or too long.");
    if (text.length > LIMITS.textMax) return fail(`"${label}" is too long.`);
    total += text.length;
    if (text) fields.push({ label, text });
  }
  if (total > LIMITS.totalTextMax) return fail("The report is too long.");
  if (fields.length === 0) return fail("The report is empty.");

  let details: Record<string, string> | undefined;
  if (raw.details !== undefined) {
    if (!isObject(raw.details)) return fail('"details" must be an object.');
    const entries = Object.entries(raw.details);
    if (entries.length > LIMITS.detailsMax) return fail("Too many details.");
    details = {};
    for (const [key, value] of entries) {
      if (typeof value !== "string") return fail("Each detail must be text.");
      const k = oneLine(key);
      if (!k || k.length > LIMITS.detailKeyMax) return fail("A detail name is empty or too long.");
      if (value.length > LIMITS.detailValueMax) return fail(`The detail "${k}" is too long.`);
      details[k] = value;
    }
  }

  return { ok: true, report: { kind, title, fields, details } };
}

/** Builds the GitHub issue for a report that passed parseReport. */
export function buildIssue(report: ReportInput): IssueDraft {
  const title = `[${KIND_TITLES[report.kind]}] ${noMentions(report.title)}`;

  const parts: string[] = [];
  for (const f of report.fields) {
    parts.push(`### ${noMentions(f.label)}\n\n${noMentions(f.text)}`);
  }

  const details = report.details ? Object.entries(report.details) : [];
  if (details.length > 0) {
    const lines = details.map(([k, v]) => `${plain(k)}: ${plain(v)}`).join("\n");
    parts.push(`<details><summary>Details from Prism</summary>\n\n\`\`\`text\n${lines}\n\`\`\`\n\n</details>`);
  }

  parts.push("_Sent from inside Prism._");

  return {
    title,
    body: parts.join("\n\n"),
    labels: [KIND_LABELS[report.kind], FROM_PRISM_LABEL],
  };
}

/** "@someone" -> "@​someone", so posting the issue never notifies anyone. */
export function noMentions(text: string): string {
  return text.replace(/@(?=[A-Za-z0-9_-])/g, "@​");
}

/** For text inside the details code block: one line, no backticks (can't close the block). */
function plain(text: string): string {
  return noMentions(oneLine(text).replace(/`/g, "'"));
}

function oneLine(text: string): string {
  return text.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(error: string): ParseResult {
  return { ok: false, error };
}
