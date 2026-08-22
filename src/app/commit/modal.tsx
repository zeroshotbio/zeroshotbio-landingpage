"use client";
// A detail panel that opens over the page.
//
// The rest of /commit is server-rendered; only the open/close lives here. Children are passed in
// already rendered, so the heavy content (three file windows, the answer figure, the scoring rule)
// stays server components and none of it ships as client JS.
//
// Behaviour: Escape closes, clicking the backdrop closes, the close button takes focus on open and
// focus returns to the trigger on close, and the page behind is locked from scrolling and hidden
// from screen readers while a panel is up.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, PAPER } from "./theme";

export default function DetailModal({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      // keep tab focus inside the panel while it is up
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: "flex", width: "100%", gap: 11, alignItems: "center", textAlign: "left",
          fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
          textTransform: "uppercase", color: ACCENT, cursor: "pointer",
          border: `1px solid ${RULE}`, background: CARD, borderRadius: 8,
          padding: "13px 16px", marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1, color: FAINT }}>▸</span>
        <span style={{ flex: 1 }}>{label}</span>
        {hint && (
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4,
                         textTransform: "none", color: FAINT }}>
            {hint}
          </span>
        )}
      </button>

      {open && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "2vh 2vw",
            // the page stays visible behind, but plainly behind
            background: "rgba(246,244,242,0.62)",
            backdropFilter: "blur(9px) saturate(120%)",
            WebkitBackdropFilter: "blur(9px) saturate(120%)",
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            style={{
              width: "90vw", height: "90vh", maxWidth: 1400,
              display: "flex", flexDirection: "column",
              background: PAPER, border: `1px solid ${RULE}`, borderRadius: 14,
              boxShadow: "0 24px 70px rgba(43,43,43,0.22), 0 2px 8px rgba(43,43,43,0.10)",
              overflow: "hidden",
            }}
          >
            <header style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              padding: "16px 20px", borderBottom: `1px solid ${RULE}`, background: CARD, flexShrink: 0,
            }}>
              <div style={{ fontSize: 16, fontWeight: 650, color: INK, letterSpacing: -0.2 }}>
                {label}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label={`Close ${label}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 9,
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
                  textTransform: "uppercase", color: INK, cursor: "pointer",
                  border: `1px solid ${RULE}`, background: PAPER, borderRadius: 8,
                  padding: "9px 14px", flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, color: MUTED }}>×</span> Close
              </button>
            </header>

            <div style={{ overflowY: "auto", padding: "26px 24px 40px", flex: 1 }}>
              <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
