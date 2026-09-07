import React from "react";

export const metadata = { title: "Site map · Zeroshot" };

type Link = { href: string; label: string; note?: string };
type Section = { title: string; links: Link[] };

const SECTIONS: Section[] = [
  {
    title: "Cell-type labelling & annotation",
    links: [
      { href: "/daniotype_kasperov", label: "DanioType · Kasperov auto-pilot labeller", note: "access-gated" },
      { href: "/minifin_annotation_wizard", label: "MiniFin annotation wizard" },
      { href: "/meta_reasoner", label: "Meta-Reasoner replay & judgement" },
      { href: "/cell_labelling_hierarchy", label: "Cell-labelling hierarchy audit" },
      { href: "/cell_type_tinder", label: "Cell Type Tinder" },
      { href: "/cell_type_court", label: "Cell Type Court" },
      { href: "/schema_menu", label: "ZFA structural label menu" },
    ],
  },
  {
    title: "Chat & workflows",
    links: [
      { href: "/zscape_chat", label: "ZSCAPE chat" },
      { href: "/POC_workflow", label: "Zeroshot compound workflow (POC)" },
    ],
  },
  {
    title: "Visualizations & interactive pages",
    links: [
      { href: "/pipeline", label: "Aquarium to Atlas — the MiniFin pipeline map", note: "isometric; every number sourced, gaps marked" },
      { href: "/zebrafish_ontology", label: "ZFA Atlas — zebrafish anatomy ontology", note: "dataset menus on the anatomy graph" },
      { href: "/zfa_mapping", label: "ZSCAPE → ZFA mapping — Stage 1", note: "parallel-sets + side-by-side term table" },
      { href: "/dev_tree", label: "Developmental tree — 0–24 hpf", note: "DanioCell annotation hierarchy on a time axis; containment, not lineage" },
      { href: "/danio_specimen_poster.html", label: "DANIO — interactive specimen poster" },
      { href: "/d3_complexity_heatmap.html", label: "Complexity heatmap" },
      { href: "/prospective_diseases_treemap.html", label: "Prospective diseases treemap" },
      { href: "/epicule", label: "Epicule" },
      { href: "/the_long_dusk", label: "The Long Dusk" },
      { href: "/patrick", label: "Patrick" },
    ],
  },
];

const INK = "#2b2620";
const MUTE = "#8a847b";
const ACCENT = "#0e7490";
const BG = "#fdfbf7";

export default function SiteMapPage() {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: INK, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 28px 80px" }}>
        <a href="/" style={{ fontSize: 13, color: ACCENT, textDecoration: "none", fontWeight: 600 }}>← zeroshot.bio</a>
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: "14px 0 6px", lineHeight: 1.1 }}>Site map</h1>
        <p style={{ fontSize: 15, color: MUTE, lineHeight: 1.55, margin: "0 0 36px", maxWidth: 640 }}>
          Every page and tool on zeroshot.bio. Some apps are access-gated and will ask for a password.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} style={{ marginBottom: 34 }}>
            <h2 style={{ fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: MUTE, margin: "0 0 12px" }}>{s.title}</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
              {s.links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    style={{
                      display: "flex", alignItems: "baseline", gap: 10, textDecoration: "none",
                      padding: "10px 14px", borderRadius: 10, border: "1px solid #efe8dd", background: "#fffdfb",
                    }}
                  >
                    <span style={{ fontSize: 15.5, fontWeight: 650, color: INK }}>{l.label}</span>
                    {l.note ? <span style={{ fontSize: 12, color: MUTE }}>· {l.note}</span> : null}
                    <span style={{ marginLeft: "auto", fontSize: 12.5, color: MUTE, fontFamily: "ui-monospace, monospace" }}>{l.href}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p style={{ fontSize: 12.5, color: MUTE, marginTop: 40, lineHeight: 1.5 }}>
          Internal API endpoints and experimental scratch routes are omitted. The home page is at{" "}
          <a href="/" style={{ color: ACCENT }}>zeroshot.bio</a>.
        </p>
      </div>
    </div>
  );
}
