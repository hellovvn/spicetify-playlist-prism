// A group's cover: a 2x2 mosaic of its songs' album art, like Spotify's own
// playlist covers. Used by the Organize review cards, the group detail and
// the "create playlists" list.

import React from "react";
import type { ScannedSong } from "../scan/scan";
import type { GroupSummary } from "../organize/grouping";
import { tagColour } from "./tagLabels";

// A 2x2 mosaic of the group's first 4 different album covers, like Spotify's
// own playlist covers. Missing covers become tiles in the group's genre colour.
export function CoverMosaic({ songs, summary, size }: { songs: ScannedSong[]; summary: GroupSummary; size: number }) {
  const covers: string[] = [];
  for (const song of songs) {
    if (song.cover && !covers.includes(song.cover)) covers.push(song.cover);
    if (covers.length === 4) break;
  }
  const colour = tagColour(summary.tags[0]?.[0] ?? "prism");
  return (
    <span style={{ ...styles.mosaic, width: size, height: size }} aria-hidden="true">
      {[0, 1, 2, 3].map((i) =>
        covers.length >= 4 || (covers.length > 0 && i < covers.length) ? (
          <img key={i} src={covers[i]} alt="" style={styles.tile} loading="lazy" />
        ) : covers.length > 0 && covers.length < 4 && i >= covers.length ? (
          <img key={i} src={covers[i % covers.length]} alt="" style={styles.tile} loading="lazy" />
        ) : (
          <span key={i} style={{ ...styles.tile, background: `linear-gradient(${135 + i * 40}deg, ${colour}, #2a1748 75%)` }} />
        )
      )}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  mosaic: { display: "grid", gridTemplateColumns: "1fr 1fr", borderRadius: 10, overflow: "hidden", flexShrink: 0, alignSelf: "center" },
  tile: { width: "100%", height: "100%", objectFit: "cover", display: "block", aspectRatio: "1" },
};
