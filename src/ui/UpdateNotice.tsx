// "Prism 0.2.0 is out" on the start page (developer's pick "A", 2026-11-26).
// The standard Notice box with small secondary buttons: "How to update" opens
// the steps in place (option "B", 2026-11-26), "What's new" opens the GitHub
// release page in the browser, "Not now" hides it until Spotify restarts.

import React from "react";
import { osFrom } from "../report/report";
import { dismissUpdate, findUpdate, PRISM_VERSION } from "../update/check";
import { INSTALL_GUIDE_URL, type LatestRelease, showsUpdateCommand, UPDATE_COMMAND } from "../update/version";

/** Copies text with Spotify's own clipboard helper, or the browser's. */
async function copyText(text: string): Promise<boolean> {
  try {
    const clip = (Spicetify.Platform as any)?.ClipboardAPI;
    if (clip?.copy) await clip.copy(text);
    else await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function UpdateNotice() {
  const { ButtonSecondary } = Spicetify.ReactComponent as any;
  const [release, setRelease] = React.useState<LatestRelease | null>(null);
  const [showHow, setShowHow] = React.useState(false);
  const [copied, setCopied] = React.useState<"" | "yes" | "no">("");
  const withCommand = showsUpdateCommand(osFrom(navigator.userAgent));

  React.useEffect(() => {
    let alive = true;
    findUpdate().then((found) => alive && setRelease(found));
    return () => {
      alive = false;
    };
  }, []);

  async function copy() {
    const ok = await copyText(UPDATE_COMMAND);
    setCopied(ok ? "yes" : "no");
    window.setTimeout(() => setCopied(""), 1600);
  }

  if (!release) return null;
  return (
    <div className="prism-notice prism-fade-in" role="status" data-prism="update-notice">
      <div style={styles.row}>
        <span>
          <b>Prism {release.version} is out.</b> <span style={styles.muted}>You have {PRISM_VERSION}.</span>
        </span>
        <div style={styles.buttons}>
          <ButtonSecondary
            buttonSize="sm"
            aria-expanded={showHow}
            onClick={() => setShowHow((open) => !open)}
            data-prism="update-how"
          >
            How to update
          </ButtonSecondary>
          <ButtonSecondary buttonSize="sm" onClick={() => window.open(release.url, "_blank")} data-prism="update-whats-new">
            What's new
          </ButtonSecondary>
          <ButtonSecondary
            buttonSize="sm"
            onClick={() => {
              dismissUpdate(release.version);
              setRelease(null);
            }}
            data-prism="update-not-now"
          >
            Not now
          </ButtonSecondary>
        </div>
      </div>
      {showHow && (
        <div className="prism-fade-in" data-prism="update-steps">
          {withCommand && (
            <>
              <p style={styles.small}>Paste this into PowerShell. It updates Prism and restarts Spotify:</p>
              <div className="prism-command">
                <code>{UPDATE_COMMAND}</code>
                <ButtonSecondary buttonSize="sm" onClick={copy} data-prism="update-copy">
                  {copied === "yes" ? "Copied" : copied === "no" ? "Couldn't copy" : "Copy"}
                </ButtonSecondary>
              </div>
            </>
          )}
          <p style={styles.small}>
            {withCommand ? "On macOS or Linux, " : "Download the new zip and replace the prism folder, "}
            <button className="prism-quiet-button" style={styles.inlineLink} onClick={() => window.open(INSTALL_GUIDE_URL, "_blank")}>
              {withCommand ? "follow the steps in the guide" : "as the guide shows"}
            </button>
            . Your settings, tones and stats stay.
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13 },
  muted: { color: "var(--spice-subtext)" },
  buttons: { display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" },
  small: { margin: "8px 0 0", fontSize: 12, color: "var(--spice-subtext)" },
  inlineLink: { display: "inline", padding: 0, fontSize: 12 },
};
