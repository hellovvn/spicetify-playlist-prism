// Grow, step after the seed (2026-11-26, developer's flow): how many NEW FINDS
// (similar songs from Last.fm that aren't in the library) the new playlist
// should get. Off = only songs from your playlists. The next step (your
// playlists) can be skipped only when this isn't Off.
//
// Made of catalogue elements only: screen title, text, the shared New finds
// choice (NewCountChoice: Off/5/10/20/Custom, also on the preview), and the action row (Back + main button).
// The count is remembered (prism:growNewCount) and the preview starts from it.

import React from "react";
import type { NewCount } from "../discover/discover";
import { NewCountChoice } from "./NewCountChoice";
import { SCREEN_HEIGHT } from "./styles";

interface NewFindsStepProps {
  count: NewCount;
  onChoose: (count: NewCount) => void;
  onBack: () => void;
  onNext: () => void;
}

export function NewFindsStep({ count, onChoose, onBack, onNext }: NewFindsStepProps) {
  const { ButtonPrimary, ButtonSecondary } = Spicetify.ReactComponent as any;
  return (
    <div style={styles.column} data-prism-state="new-finds">
      <h2 className="prism-screen-title" style={styles.title}>
        New finds
      </h2>
      <p style={styles.sub}>
        Prism can add songs you don't have yet: similar songs from Last.fm that share this vibe's genres. They're
        marked as new finds and only go into the new playlist. Up to 50 per playlist.
      </p>
      <div style={styles.countRow}>
        <span style={styles.label} id="prism-step-new-label">
          How many new finds?
        </span>
        <NewCountChoice count={count} onChoose={onChoose} labelledBy="prism-step-new-label" prefix="step-new" />
      </div>
      <p style={styles.sub} data-prism="step-new-note">
        {count === "off"
          ? "Off: the new playlist only gets songs from your playlists (you pick them next)."
          : "Next you can add songs from your playlists too, or skip that and get only new finds."}
      </p>
      <div style={{ flex: 1 }} />
      <div className="prism-actions" style={styles.buttons}>
        <ButtonSecondary buttonSize="sm" onClick={onBack}>
          Back
        </ButtonSecondary>
        <ButtonPrimary buttonSize="sm" onClick={onNext} data-prism="step-new-next">
          Next: your playlists
        </ButtonPrimary>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  column: { display: "flex", flexDirection: "column", gap: 12, height: SCREEN_HEIGHT },
  title: { margin: 0 },
  sub: { color: "var(--spice-subtext)", margin: 0 },
  countRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  label: { color: "var(--spice-text)", fontSize: 13, fontWeight: 600 },
  buttons: { display: "flex", justifyContent: "flex-end", gap: 8 },
};
