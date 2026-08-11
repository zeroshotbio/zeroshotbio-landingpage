// DatasetProfileCard — the EXPANDED technical profile, rendered directly beneath the concise
// DatasetSpecCard for the same dataset.
//
// Division of labour: the concise card is fast orientation and its layout is deliberately fixed;
// this one is the one-page technical reference and is allowed to be substantially taller. It reuses
// the same tokens (PAPER / #fffdfb / #e5e1dc hairlines / ACCENT teal / mono labels / serif name) so
// the pair reads as one family rather than two designs.
//
// Server component: no state, no fetch. Content lives in dataset_profiles.json, deliberately
// separate from dataset_cards.json so the existing cards' data is untouched.
import React from "react";
import { INK, ACCENT } from "../theme";
import PROFILES from "../dataset_profiles.json";

const P: Record<string, any> = (PROFILES as any).profiles;
export const PROFILE_IDS: string[] = (PROFILES as any).order;
export const hasProfile = (id: string) => !!P[id];

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const RULE = "#e5e1dc";
const MUTED = "#8a847b";
const FAINT = "#b0a89e";

// Confidence tags are used sparingly — only where provenance actually matters.
const TAG: Record<string, { bg: string; fg: string; bd: string }> = {
  CONFIRMED: { bg: "#eaf4ee", fg: "#3f6b55", bd: "#cfe0d6" },
  "STRONGLY INFERRED": { bg: "#eef4f7", fg: "#3f5f70", bd: "#cddfe8" },
  RECONSTRUCTED: { bg: "#f4f1e8", fg: "#7a6a3e", bd: "#e2d9bf" },
  UNRESOLVED: { bg: "#f8efe9", fg: "#8a5a3c", bd: "#e8d2c2" },
};

function Tag({ t }: { t: string }) {
  const c = TAG[t] || { bg: "#f3f0ec", fg: MUTED, bd: RULE };
  return (
    <span
      style={{
        fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
        borderRadius: 99, padding: "1.5px 7px", whiteSpace: "nowrap",
        color: c.fg, background: c.bg, border: `1px solid ${c.bd}`,
      }}
    >
      {t}
    </span>
  );
}

const sectionTitle: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
  textTransform: "uppercase", color: "#3f3a34",
};

function Row({ r }: { r: any }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", padding: "9px 0", borderBottom: `1px solid #efeae3` }}>
      <div style={{ flex: "0 0 190px", minWidth: 150 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: MUTED }}>{r.k}</span>
      </div>
      <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: r.mono ? 11.5 : 12.5, lineHeight: 1.55, color: INK,
            fontFamily: r.mono ? MONO : undefined, minWidth: 0, wordBreak: "break-word",
          }}
        >
          {r.href ? (
            <a href={r.href} target="_blank" rel="noopener noreferrer"
               style={{ color: ACCENT, textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: "#a9d3de" }}>
              {r.v}
            </a>
          ) : r.v}
        </span>
        {r.tag && <Tag t={r.tag} />}
      </div>
    </div>
  );
}

function Chips({ g }: { g: any }) {
  const muted = !!g.muted;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: FAINT, marginBottom: 6 }}>
        {g.label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {g.items.map((t: string) => (
          <span
            key={t}
            style={{
              fontSize: 10.5, fontWeight: muted ? 600 : 700, letterSpacing: 0.2, borderRadius: 99,
              padding: "2.5px 9px", whiteSpace: "nowrap",
              fontStyle: muted ? "italic" : "normal",
              color: muted ? "#6b655d" : "#0e6a80",
              background: muted ? "transparent" : "#e9f3f6",
              border: `1px solid ${muted ? "#d8d3cd" : "#c4e0e8"}`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({ s }: { s: any }) {
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span style={sectionTitle}>{s.title}</span>
        <span style={{ flex: 1, height: 1, background: RULE }} />
      </div>

      {/* a cross-dataset relationship worth seeing before the detail */}
      {s.shared && (
        <div
          style={{
            margin: "10px 0 2px", background: "#eef6f8", border: "1px solid #c4e0e8", borderRadius: 8,
            padding: "8px 11px", fontSize: 11.5, lineHeight: 1.5, color: "#0e6a80", fontWeight: 600,
          }}
        >
          ⇄ {s.shared}
        </div>
      )}

      {(s.rows || []).map((r: any) => <Row key={r.k} r={r} />)}
      {(s.groups || []).map((g: any) => <Chips key={g.label} g={g} />)}

      {s.note && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 11.5, lineHeight: 1.55, color: MUTED, fontStyle: "italic", flex: "1 1 320px", minWidth: 0 }}>
            {s.note}
          </span>
          {(s.noteTags || []).map((t: string) => <Tag key={t} t={t} />)}
        </div>
      )}

      {s.bullets && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {s.bullets.map((b: string, i: number) => (
            <li key={i} style={{ fontSize: 12.5, lineHeight: 1.6, color: "#5a544c", marginTop: 7 }}>{b}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DatasetProfileCard({ id }: { id: string }) {
  const p = P[id];
  if (!p) return null;
  return (
    <div
      style={{
        position: "relative", background: "#fffdfb", border: `1px solid ${RULE}`, borderRadius: 18,
        // A slightly stronger left rail marks this as the deeper companion to the card above it.
        borderLeft: `3px solid ${ACCENT}`,
        padding: "26px 30px 26px", color: INK,
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: ACCENT }}>
            {p.kicker}
          </div>
          <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.2, marginTop: 3 }}>{p.name}</div>
        </div>
        <span
          style={{
            flexShrink: 0, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.7,
            textTransform: "uppercase", borderRadius: 99, padding: "3px 10px",
            color: ACCENT, background: "transparent", border: `1px solid #a9d3de`,
          }}
        >
          Technical profile
        </span>
      </div>

      <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "#5a544c", maxWidth: 780 }}>{p.lede}</p>

      {/* publication */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${RULE}`, fontSize: 12, lineHeight: 1.55, color: MUTED }}>
        <a href={p.paper.href} target="_blank" rel="noopener noreferrer"
           style={{ color: ACCENT, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: "#a9d3de" }}>
          {p.paper.title}
        </a>
        <div style={{ marginTop: 2 }}>{p.paper.citation} · {p.paper.venue}</div>
      </div>

      {/* headline numerals */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 40px", marginTop: 18, paddingTop: 16, borderTop: `1px solid ${RULE}` }}>
        {p.headline.map((h: any) => (
          <div key={h.cap} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 27, fontWeight: 800, lineHeight: 1, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>
              {h.n}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.7, color: MUTED, fontVariant: "all-small-caps" }}>
              {h.cap}
            </span>
          </div>
        ))}
      </div>

      {p.sections.map((s: any) => <Section key={s.title} s={s} />)}

      <div style={{ marginTop: 24, paddingTop: 13, borderTop: `1px solid ${RULE}`, fontFamily: MONO, fontSize: 10, color: FAINT, lineHeight: 1.5, wordBreak: "break-word" }}>
        {p.footer}
      </div>
    </div>
  );
}
