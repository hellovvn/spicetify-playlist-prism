// "How many new finds" choice, shared by Grow's New finds step and the
// preview's New finds row: the Segmented choice Off/5/10/20 + Custom, and
// with Custom a small number box (1 to MAX_NEW_CUSTOM), the same pair the
// preview's "Songs from your playlists" row uses (2026-11-26, developer's ask).

import React from "react";
import { MAX_NEW_CUSTOM, NEW_COUNTS, parseNewCount, type NewCount } from "../discover/discover";

interface NewCountChoiceProps {
  count: NewCount;
  onChoose: (count: NewCount) => void;
  labelledBy: string; // id of the label next to it
  allowOff?: boolean; // false = no "Off" chip (new finds only)
  prefix: string; // data-prism prefix, e.g. "step-new" -> "step-new-10", "step-new-custom"
}

export function NewCountChoice({ count, onChoose, labelledBy, allowOff = true, prefix }: NewCountChoiceProps) {
  const [customOpen, setCustomOpen] = React.useState(() => count !== "off" && !NEW_COUNTS.includes(count));
  const [customText, setCustomText] = React.useState(() => (typeof count === "number" ? String(count) : ""));
  const customValid = typeof parseNewCount(customText) === "number";
  const options = NEW_COUNTS.filter((option) => allowOff || option !== "off");

  return (
    <>
      <div className="prism-seg" role="group" aria-labelledby={labelledBy} data-prism={`${prefix}-count`}>
        {options.map((option) => {
          const on = !customOpen && count === option;
          return (
            <button
              key={String(option)}
              type="button"
              className={on ? "on" : ""}
              aria-pressed={on}
              onClick={() => {
                setCustomOpen(false);
                onChoose(option);
              }}
              data-prism={`${prefix}-${option}`}
            >
              {option === "off" ? "Off" : option}
            </button>
          );
        })}
        <button
          type="button"
          className={customOpen ? "on" : ""}
          aria-pressed={customOpen}
          onClick={() => {
            setCustomOpen(true);
            // The box keeps its last number: Custom means that number again.
            const n = parseNewCount(customText);
            if (typeof n === "number") onChoose(n);
          }}
          data-prism={`${prefix}-custom`}
        >
          Custom
        </button>
      </div>
      {customOpen && (
        <input
          type="number"
          min={1}
          max={MAX_NEW_CUSTOM}
          step={1}
          autoFocus
          value={customText}
          placeholder="15"
          onChange={(event) => {
            setCustomText(event.target.value);
            const n = parseNewCount(event.target.value);
            if (typeof n === "number") onChoose(n);
          }}
          className="prism-glass-input"
          style={styles.input}
          aria-label={`Number of new finds, 1 to ${MAX_NEW_CUSTOM}`}
          aria-invalid={!customValid}
          data-prism={`${prefix}-custom-input`}
        />
      )}
      {/* The max is always stated (developer's ask); pink while the number isn't valid. */}
      {customOpen && (
        <span style={customValid ? styles.max : styles.hint} data-prism={`${prefix}-max`}>
          {customValid ? `max ${MAX_NEW_CUSTOM}` : `1 to ${MAX_NEW_CUSTOM}`}
        </span>
      )}
    </>
  );
}

// Same sizes as the preview's songs Custom box (PreviewScreen customInput / countHint).
const styles: Record<string, React.CSSProperties> = {
  input: { width: 76, padding: "5px 10px", fontSize: 13 },
  hint: { fontSize: 12, color: "#ffb3c7" },
  max: { fontSize: 12, color: "var(--spice-subtext)" },
};
