"use client";
// Light/dark switch for the /commit pages.
//
// Independent of the site-wide DarkMode wrapper (whose toggle is hidden and which defaults to light):
// the choice is stored as "commit-theme" and applied as data-commit-theme on <html>, which
// THEME_CSS in theme.ts reads. With no stored choice the pages follow the system setting. The
// attribute is set before first paint by the inline script in layout.tsx; this component only
// reads it back and flips it.
import React, { useEffect, useState } from "react";
import { MONO, RULE, CARD, INK } from "./theme";

type Mode = "light" | "dark";
const KEY = "commit-theme";

function current(): Mode {
  const set = document.documentElement.getAttribute("data-commit-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    setMode(current());
    // leaving /commit for another page: drop the attribute so nothing else inherits it
    return () => document.documentElement.removeAttribute("data-commit-theme");
  }, []);

  const flip = () => {
    const next: Mode = current() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-commit-theme", next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode: the switch still works for this visit */ }
    setMode(next);
  };

  const dark = mode === "dark";
  return (
    <button
      type="button"
      onClick={flip}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ position: "fixed", top: 14, right: 14, zIndex: 50, display: "inline-flex", alignItems: "center",
               gap: 7, padding: "6px 11px 6px 9px", borderRadius: 999, border: `1px solid ${RULE}`,
               background: CARD, color: INK, cursor: "pointer", fontFamily: MONO, fontSize: 10.5,
               fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
               visibility: mode ? "visible" : "hidden" }}
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}
           strokeLinecap="round" aria-hidden="true">
        {dark ? (
          <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" />
        ) : (
          <>
            <circle cx="10" cy="10" r="3.6" />
            <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
          </>
        )}
      </svg>
      {dark ? "Dark" : "Light"}
    </button>
  );
}
