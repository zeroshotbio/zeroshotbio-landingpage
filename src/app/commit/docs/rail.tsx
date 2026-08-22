"use client";
// The contents rail, with the section you are reading marked.
//
// The only client code on the reference page. It reads scroll position rather than using an
// IntersectionObserver: sections here vary hugely in height — one is four paragraphs, another is
// three file windows — and an observer keyed on visibility flickers between them. Comparing each
// section's top against a fixed line below the viewport top is deterministic and behaves the same
// for a short section and a very long one.
//
// Without JS the rail still renders and every link still works; only the highlight is missing.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT } from "../theme";

export type RailSection = { id: string; n: string; title: string; blurb: string };

export default function DocsRail({ sections, stats }: {
  sections: RailSection[]; stats: string[];
}) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const pick = () => {
      frame = 0;
      const line = window.scrollY + 140;          // a little below the viewport top
      // at the very bottom nothing further can come into view, so the last section wins
      const atEnd =
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      if (atEnd) { setActive(sections[sections.length - 1].id); return; }

      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= line) current = s.id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(pick); };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav className="doc-rail" aria-label="Contents">
      <Link href="/commit"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
                     fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7,
                     textTransform: "uppercase", color: ACCENT, border: `1px solid ${RULE}`,
                     background: "#fffefd", borderRadius: 8, padding: "9px 13px", marginBottom: 22 }}>
        ← Back to the overview
      </Link>

      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.9,
                    textTransform: "uppercase", color: MUTED, marginBottom: 9, paddingLeft: 11 }}>
        Contents
      </div>

      {sections.map((s) => {
        const on = s.id === active;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="doc-link"
            aria-current={on ? "true" : undefined}
            style={{
              background: on ? "#fffefd" : "transparent",
              borderLeftColor: on ? ACCENT : "transparent",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 9, color: on ? ACCENT : FAINT, marginRight: 8 }}>
              {s.n}
            </span>
            <span style={{ fontSize: 13, color: INK, fontWeight: on ? 650 : 550 }}>{s.title}</span>
            <span style={{ display: "block", fontSize: 11, color: on ? MUTED : FAINT,
                           marginTop: 2, paddingLeft: 25 }}>
              {s.blurb}
            </span>
          </a>
        );
      })}

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${RULE}`,
                    fontFamily: MONO, fontSize: 9.5, color: FAINT, lineHeight: 1.7 }}>
        {stats.map((t) => (
          <div key={t} style={{ wordBreak: "break-all" }}>{t}</div>
        ))}
      </div>
    </nav>
  );
}
