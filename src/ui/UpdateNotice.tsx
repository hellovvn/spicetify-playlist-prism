// "Prism 0.2.0 is out" on the start page (developer's pick "A", 2026-11-26).
// The standard Notice box with two small secondary buttons: "What's new" opens
// the GitHub release page in the browser, "Not now" hides it until the next version.

import React from "react";
import { dismissUpdate, findUpdate, PRISM_VERSION } from "../update/check";
import type { LatestRelease } from "../update/version";

export function UpdateNotice() {
  const { ButtonSecondary } = Spicetify.ReactComponent as any;
  const [release, setRelease] = React.useState<LatestRelease | null>(null);

  React.useEffect(() => {
    let alive = true;
    findUpdate().then((found) => alive && setRelease(found));
    return () => {
      alive = false;
    };
  }, []);

  if (!release) return null;
  return (
    <div className="prism-notice prism-fade-in" role="status" style={styles.box} data-prism="update-notice">
      <span>
        <b>Prism {release.version} is out.</b> <span style={styles.muted}>You have {PRISM_VERSION}.</span>
      </span>
      <div style={styles.buttons}>
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
  );
}

const styles: Record<string, React.CSSProperties> = {
  box: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13 },
  muted: { color: "var(--spice-subtext)" },
  buttons: { display: "flex", gap: 8, flexShrink: 0 },
};
