// A small glass drop-down menu, used instead of the browser's own <select>:
// a <select>'s open list is drawn by Windows, so it can't look like glass.
//
// A button shows the label; clicking it opens a frosted list of choices.
// Picking one calls onPick. It closes on a pick, a click outside, Escape or
// scrolling. Keyboard: Enter/Space/Down opens it, Up/Down move, Enter picks.
//
// The list uses position: fixed (placed from the button's position on
// screen), so it isn't cut off by a scrolling list it sits in; it opens
// upwards when there isn't room below. It's drawn with a React PORTAL straight
// into <body>: Spotify's main view has `will-change: transform`, which makes
// "fixed" measure from that view instead of the window (the list appeared
// ~300px off to the side). A portal renders it outside Spotify's layout.

import React from "react";

export interface GlassMenuOption {
  value: string;
  label: string;
}

export interface GlassMenuProps {
  label: string; // what the button says, e.g. "Move to…"
  options: GlassMenuOption[];
  onPick: (value: string) => void;
  ariaLabel: string; // for screen readers, e.g. "Move Grown Up to another group"
  dataPrism?: string; // test hook on the button
}

export function GlassMenu({ label, options, onPick, ariaLabel, dataPrism }: GlassMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0); // highlighted choice (keyboard)
  const [place, setPlace] = React.useState<React.CSSProperties>({});
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  function openMenu() {
    const box = buttonRef.current!.getBoundingClientRect();
    const height = Math.min(options.length * 34 + 12, 240);
    const below = window.innerHeight - box.bottom > height + 8;
    setPlace({
      left: Math.max(8, box.right - 220),
      width: 220,
      ...(below ? { top: box.bottom + 6 } : { bottom: window.innerHeight - box.top + 6 }),
    });
    setActive(0);
    setOpen(true);
  }

  function pick(value: string) {
    setOpen(false);
    buttonRef.current?.focus();
    onPick(value);
  }

  // While open: close on a click outside, or when anything scrolls (the
  // button would move away from the list).
  React.useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", outside);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) pick(options[active].value);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="prism-menu-button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        data-prism={dataPrism}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="prism-menu-chevron">
          ▾
        </span>
      </button>
      {open &&
        Spicetify.ReactDOM.createPortal(
        <div ref={listRef} className="prism-menu-list" role="listbox" aria-label={ariaLabel} style={{ position: "fixed", zIndex: 1000, ...place }}>
          {options.map((option, i) => (
            <div
              key={option.value}
              role="option"
              aria-selected={i === active}
              className={i === active ? "prism-menu-option active" : "prism-menu-option"}
              onMouseEnter={() => setActive(i)}
              // mousedown (not click): picks before the button loses focus.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(option.value);
              }}
              data-prism="menu-option"
            >
              {option.label}
            </div>
          ))}
        </div>,
          document.body
        )}
    </>
  );
}
