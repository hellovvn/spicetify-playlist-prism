// PURE parts of the Tone view on Spotify's playlist page (src/ui/toneRows.ts):
// no Spotify, no React, so tests/toneRows.test.ts can load them.

// "/playlist/<22-character id>" -> "spotify:playlist:<id>", else null.
export function playlistUriFromPath(path: string | undefined): string | null {
  const match = /^\/playlist\/([A-Za-z0-9]{22})\/?$/.exec(path ?? "");
  return match ? `spotify:playlist:${match[1]}` : null;
}

// The ring: a faint full circle, a lavender-to-pink arc for the score, and
// the % in the middle (the same look as Grow's score ring, smaller).
// null = not scored: a dashed ring with "–". partial = a rough guess (no
// Last.fm tags, mood + tempo only): the same ring at half strength.
export function ringSvg(score: number | null, partial = false): string {
  const size = 32;
  const r = 13;
  const c = size / 2;
  const round = 2 * Math.PI * r;
  if (score === null) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="3" stroke-dasharray="3 4"/><text x="${c}" y="${c + 4}" text-anchor="middle" font-size="11" fill="#b3a6d6">–</text></svg>`;
  }
  const pct = Math.round(score * 100);
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"${partial ? ' opacity="0.5"' : ""}>` +
    `<defs><linearGradient id="prism-tone-fill" x1="0" x2="1"><stop offset="0" stop-color="#cdb8ff"/><stop offset="1" stop-color="#ffb3c7"/></linearGradient></defs>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="3"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#prism-tone-fill)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${((round * pct) / 100).toFixed(1)} ${round.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>` +
    `<text x="${c}" y="${c + 4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#ffffff">${pct}</text></svg>`
  );
}

// The strip's status text: only while the rings are loading or if they
// failed. Once loaded it's empty: the rings say it all (the "59% tone fit ·
// 19 of 28 songs fit…" summary was removed at the developer's request).
export function stripStatus(show: boolean, state: { loading: { done: number; total: number } | null; failed: boolean }): string {
  if (!show) return "";
  if (state.loading) return state.loading.total > 0 ? `Scoring songs: ${state.loading.done} of ${state.loading.total}…` : "Scoring songs…";
  if (state.failed) return "Couldn't score the songs";
  return "";
}
