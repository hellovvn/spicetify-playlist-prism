// "Report a bug" / "Suggest an idea" (developer's pick, mockup "B"): opened from
// Settings > "Help make Prism better", shown in the Settings layer, so the screen
// underneath (e.g. a half-done scan) stays as it was. Send posts it through the
// relay (src/report/send.ts) as a public GitHub issue. Nobody can reply, so the
// questions ask for detail up front. Pure parts: src/report/report.ts.

import React from "react";
import { version as PRISM_VERSION } from "../../package.json";
import {
  buildReport,
  detailsFor,
  emptyForm,
  FREQUENCIES,
  missingAnswer,
  osFrom,
  QUESTIONS,
  scrubText,
  spotifyVersionFrom,
  type ReportForm,
  type ReportKind,
} from "../report/report";
import { recentErrors } from "../report/errorLog";
import { sendReport } from "../report/send";
import { getOwnLastfmKey, getSharedLastfmKey, loadPlaylistThemeSetting } from "../storage";
import { parsePlaylistTheme, PLAYLIST_THEMES } from "../theme/playlistTheme";

export interface ReportScreenProps {
  kind: ReportKind;
  /** The Prism screen under Settings (sent as a detail, e.g. "scan"). */
  screen: string;
  /** Back to Settings. */
  onClose: () => void;
}

/** The details sent with a report, worked out now (shown to the user first). */
function collectDetails(screen: string): Record<string, string> {
  const ua = navigator.userAgent;
  // Hide both keys (the user's own and Prism's shared one) if they ever show up in an error.
  const keys = [getOwnLastfmKey(), getSharedLastfmKey()].filter((k): k is string => !!k);
  const theme = parsePlaylistTheme(loadPlaylistThemeSetting());
  return detailsFor({
    prismVersion: PRISM_VERSION,
    spicetifyVersion: (Spicetify as any).Config?.version,
    spotifyVersion: spotifyVersionFrom(ua),
    os: osFrom(ua),
    screen,
    playlistTheme: PLAYLIST_THEMES.find((t) => t.id === theme)?.label ?? theme,
    recentErrors: recentErrors().map((e) => scrubText(e, keys)),
  });
}

export function ReportScreen({ kind, screen, onClose }: ReportScreenProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  const [form, setForm] = React.useState<ReportForm>(() => emptyForm(kind));
  const [details] = React.useState(() => collectDetails(screen));
  const [includeDetails, setIncludeDetails] = React.useState(true);
  const [showDetails, setShowDetails] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState<{ number: number; url: string } | null>(null);

  const q = QUESTIONS[kind];
  const set = (patch: Partial<ReportForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  };

  async function send() {
    const missing = missingAnswer(form);
    if (missing) return setError(missing);
    const report = buildReport(form, includeDetails ? details : null);
    if ("error" in report) return setError(report.error);
    setSending(true);
    const result = await sendReport(report);
    setSending(false);
    if (result.ok) setSent({ number: result.number, url: result.url });
    else setError(result.error);
  }

  if (sent) {
    return (
      <div className="prism-fade-in" style={styles.thanks} data-prism="report-sent">
        <span className="prism-star-icon" aria-hidden="true" style={styles.bigStar} />
        <h2 className="prism-screen-title">Thanks, it's sent</h2>
        <p style={styles.sub}>It's now issue #{sent.number} on Prism's GitHub.</p>
        <div className="prism-actions" style={styles.actions}>
          {sent.url && (
            <ButtonSecondary buttonSize="sm" onClick={() => window.open(sent.url, "_blank")} data-prism="report-view">
              View on GitHub
            </ButtonSecondary>
          )}
          <ButtonPrimary buttonSize="sm" onClick={onClose} data-prism="report-done">
            Done
          </ButtonPrimary>
        </div>
      </div>
    );
  }

  const area = (label: string, value: string, onChange: (v: string) => void, placeholder: string, rows: number, id: string) => (
    <label style={styles.field}>
      <span className="prism-heading">{label}</span>
      <textarea
        className="prism-glass-input is-multiline"
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={4000}
        onChange={(e) => onChange(e.target.value)}
        data-prism={`report-${id}`}
      />
    </label>
  );

  return (
    <div className="prism-fade-in" style={styles.column} data-prism="report" data-prism-kind={kind}>
      <h2 className="prism-screen-title">{kind === "bug" ? "Report a bug" : "Suggest an idea"}</h2>

      <label style={styles.field}>
        <span className="prism-heading">Short title</span>
        <input
          className="prism-glass-input"
          style={styles.input}
          value={form.title}
          maxLength={120}
          placeholder={kind === "bug" ? "Scan stuck at 0" : "A pink playlist theme"}
          onChange={(e) => set({ title: e.target.value })}
          data-prism="report-title"
        />
      </label>

      {kind === "bug" ? (
        <>
          {area(q.first, form.first, (v) => set({ first: v }), "Started a scan on Liked Songs", 2, "first")}
          {area(q.second, form.second, (v) => set({ second: v }), "It stayed at 0 of 250", 3, "second")}
          {area(q.expected!, form.expected, (v) => set({ expected: v }), "The scan to count up", 2, "expected")}
          <div style={styles.field}>
            <span className="prism-heading" id="prism-report-often">How often?</span>
            <div className="prism-seg" style={styles.seg} role="group" aria-labelledby="prism-report-often">
              {FREQUENCIES.map((f) => (
                <button key={f} type="button" className={form.frequency === f ? "on" : ""} aria-pressed={form.frequency === f} onClick={() => set({ frequency: f })}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {area(q.first, form.first, (v) => set({ first: v }), "A playlist theme in soft pinks", 3, "first")}
          {area(q.second, form.second, (v) => set({ second: v }), "Optional", 2, "second")}
        </>
      )}

      <div style={styles.detailsRow}>
        <label style={styles.check}>
          <input type="checkbox" className="prism-checkbox" checked={includeDetails} onChange={(e) => setIncludeDetails(e.target.checked)} data-prism="report-include-details" />
          <span>Send details about my setup</span>
        </label>
        <button
          type="button"
          className="prism-quiet-button"
          aria-expanded={showDetails}
          aria-controls="prism-report-details"
          onClick={() => setShowDetails(!showDetails)}
          data-prism="report-details-toggle"
        >
          {showDetails ? "▴ Hide details" : "▾ Show details"}
        </button>
      </div>
      {showDetails && (
        <div id="prism-report-details" className="prism-glass-panel" style={styles.details} data-prism="report-details">
          {Object.entries(details).map(([k, v]) => (
            <div key={k} className="prism-row" style={styles.detailRow}>
              <span style={styles.detailKey}>{k}</span>
              <span style={styles.detailValue}>{v}</span>
            </div>
          ))}
          <p style={styles.never}>Never sent: your Last.fm key, lyrics, or song and playlist names.</p>
        </div>
      )}

      <p style={styles.sub}>Reports are posted publicly on Prism's GitHub. Nobody can reply to you, so the more detail, the better.</p>
      {error && (
        <p role="alert" style={styles.error} data-prism="report-error">
          {error}
        </p>
      )}

      <div className="prism-actions" style={styles.actions}>
        <ButtonSecondary buttonSize="sm" onClick={onClose} disabled={sending} data-prism="report-cancel">
          Cancel
        </ButtonSecondary>
        <ButtonPrimary buttonSize="sm" onClick={send} disabled={sending} data-prism="report-send">
          {sending ? "Sending…" : "Send"}
        </ButtonPrimary>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  column: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, width: "100%", margin: "0 auto" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  input: { fontSize: 14 },
  // Keep the segmented choice its own width (the column would stretch it).
  seg: { alignSelf: "flex-start" },
  sub: { margin: 0, color: "var(--spice-subtext)", fontSize: 13 },
  error: { margin: 0, color: "var(--prism-error)", fontSize: 13 },
  detailsRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  check: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" },
  details: { maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", padding: "4px 6px" },
  detailRow: { display: "flex", gap: 12, padding: "6px 8px", fontSize: 12 },
  detailKey: { flex: "0 0 110px", color: "var(--spice-subtext)" },
  detailValue: { flex: 1, minWidth: 0, overflowWrap: "anywhere", color: "var(--spice-text)" },
  never: { margin: "6px 8px", fontSize: 12, color: "var(--spice-subtext)" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 8 },
  thanks: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", padding: "32px 0" },
  bigStar: { fontSize: 44 },
};
