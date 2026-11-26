// Sends a report to Prism's relay (relay/, a Cloudflare Worker), which opens the
// GitHub issue. No GitHub token or key is in Prism: the relay holds the App's key.

import type { ReportInput } from "../../relay/src/report";

/** The relay's address (relay/README.md). Empty = reporting off. */
export const REPORT_RELAY_URL = "https://prism-reports.hellovvn-spicetify-prism.workers.dev";

export type SendResult = { ok: true; number: number; url: string } | { ok: false; error: string };

export async function sendReport(report: ReportInput): Promise<SendResult> {
  if (!REPORT_RELAY_URL) return { ok: false, error: "Reporting isn't set up yet. Please try again in a later version." };
  try {
    const res = await fetch(`${REPORT_RELAY_URL}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; number?: number; url?: string; error?: string } | null;
    if (res.ok && data?.ok && typeof data.number === "number") {
      return { ok: true, number: data.number, url: data.url ?? "" };
    }
    return { ok: false, error: data?.error ?? `Couldn't send the report (error ${res.status}). Please try again later.` };
  } catch {
    return { ok: false, error: "Couldn't reach Prism's report service. Check your connection and try again." };
  }
}
