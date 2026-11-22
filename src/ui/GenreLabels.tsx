// Genre labels in a row: frosted glass with a colour dot (see .prism-tag in
// styles.ts). Used by the preview list and the playlist stats page.

import React from "react";
import type { TagLabel } from "./tagLabels";

// Genre labels in one line (frosted glass + colour dot, see .prism-tag in styles.ts).
export function TagLabels({ labels, artistTags = false }: { labels: TagLabel[]; artistTags?: boolean }) {
  return (
    <span style={styles.tags}>
      {labels.map((label) => (
        <span
          key={label.name}
          className={label.shared ? "prism-tag shared" : "prism-tag"}
          // --tag: a CSS variable the label's dot reads its colour from.
          style={{ ["--tag" as any]: label.colour }}
        >
          <span className="prism-tag-text">{label.name}</span>
        </span>
      ))}
      {artistTags && <span style={styles.artistNote}>artist tags</span>}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tags: { display: "flex", alignItems: "center", gap: 5, overflow: "hidden", whiteSpace: "nowrap" },
  artistNote: { color: "var(--spice-subtext)", fontSize: 11 },
};
