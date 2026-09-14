import React from "react";

export const metadata = { title: "Site map · Zeroshot" };

type Link = { href: string; label: string; note?: string };
type Section = { title: string; blurb?: string; image?: { src: string; alt: string; href: string }; links: Link[] };

const SECTIONS: Section[] = [
  {
    title: "Isometric Pipeline Visualization",
    blurb:
      "One map of the zebrafish single-cell pipeline, from the aquarium to the published atlas, plus close-ups of its rows. They share one dark instrument shell: a step list on the left, the map in the middle, the story on the right.",
    image: {
      src: "/images/sitemap_isometric_pipeline.jpg",
      alt: "The Aquarium to Atlas isometric map: five rows of pipeline stations, from the aquarium and fixed material at the top to the filtered matrix and published object at the bottom",
      href: "/pipeline",
    },
    links: [
      { href: "/pipeline", label: "Aquarium to Atlas: the whole pipeline", note: "five rows, seven landmarks; MiniFin as the worked example" },
      { href: "/molecular_pipe", label: "Molecular biology: the bench", note: "row 2: in-situ barcoding, cDNA capture, library prep, sequencer" },
      { href: "/FASTQ_pipe", label: "FASTQ → Unfiltered DGE", note: "row 3, first half: barcode parse, alignment, UMI dedup, matrix build" },
      { href: "/bioinformatics_pipe", label: "Unfiltered → Filtered", note: "row 3, second half: four culls, each decision drawn on a roof" },
      { href: "/data_structures", label: "Data Structures: medallion plan view", note: "bronze, silver and gold buckets and the repos between them" },
    ],
  },
  {
    title: "Fate maps & developmental atlases",
    links: [
      { href: "/fate_map_wang_2026", label: "Fate map · Wang 2026: 5.5–11.3 hpf zebrafish gastrula", note: "one embryo, every followable lineage; ITEC reconstruction" },
      { href: "/fate_map_daniocell", label: "Fate map · DanioCell: five days of becoming a fish", note: "489,686 cells, 3.3–120 hpf; transcriptional identity, not lineage" },
      { href: "/fate_map_zebrahub", label: "Fate map · Zebrahub: two maps of becoming", note: "120,444 cells from 40 embryos, plus 101,676 tracked nuclei" },
      { href: "/fate_map_24_48", label: "Fate map · 24–48 hpf: the inferred skeleton", note: "186 states, 173 transitions, each with its literature verdict" },
      { href: "/dev_tree", label: "Developmental tree: 0–48 hpf", note: "DanioCell annotation hierarchy on a time axis; containment, not lineage" },
    ],
  },
  {
    title: "Reproductions & analysis notes",
    links: [
      { href: "/compass", label: "COMPASS, reproduced: the shared response of a perturbed cell", note: "six CRISPRi lines, held against Tahoe, ChemFish, MegaFin and MiniFin" },
      { href: "/rhaister", label: "Rhaister, reproduced: predicting what was not measured", note: "three figures: task, canonical split, panel-size titration" },
      { href: "/HVG_test", label: "HVG selection: does it earn its place?", note: "a three-figure note across three ground-truth datasets" },
      { href: "/grcz12", label: "GRCz12 arm comparison", note: "the built GRCz11/Ensembl-99 MiniFin arm beside the staged GRCz12 arm" },
      { href: "/epicule", label: "Epicule: why the graph network won", note: "the GNN world-model (MiniEpi v2)" },
    ],
  },
  {
    title: "Cell-type labelling & annotation",
    links: [
      { href: "/daniotype_kasperov", label: "DanioType · Kasperov auto-pilot labeller", note: "access-gated" },
      { href: "/meta_reasoner", label: "Meta-Reasoner replay & judgement", note: "access-gated" },
      { href: "/commit", label: "The Commit Challenge · ZSCAPE Commit Gold", note: "112 frozen clusters, one ZFA id each; docs at /commit/docs" },
      { href: "/minifin_annotation_wizard", label: "MiniFin annotation wizard" },
      { href: "/cell_labelling_hierarchy", label: "Cell-labelling hierarchy audit", note: "per-category drill-downs" },
      { href: "/cell_type_tinder", label: "Cell Type Tinder" },
      { href: "/cell_type_court", label: "Cell Type Court" },
    ],
  },
  {
    title: "Zebrafish anatomy ontology (ZFA)",
    links: [
      { href: "/zebrafish_ontology", label: "ZFA Atlas: dataset menus on the anatomy ontology", note: "access-gated" },
      { href: "/zfa_mapping", label: "ZSCAPE ↔ ZFA consensus map", note: "Steven + Darien consensus, read-only" },
      { href: "/zfa_judge.html", label: "ZSCAPE ⇄ ZFA term-by-term judgement", note: "the earlier Stage 1 judging UI, kept as it was" },
      { href: "/schema_menu", label: "ZFA structural label menu", note: "MiniFin label schema" },
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
    title: "Other pages",
    links: [
      { href: "/patrick", label: "Patrick: R4b decision dashboard", note: "access-gated" },
      { href: "/danio_specimen_poster.html", label: "DANIO: interactive specimen poster" },
      { href: "/d3_complexity_heatmap.html", label: "Complexity heatmap" },
      { href: "/prospective_diseases_treemap.html", label: "Prospective diseases treemap" },
      { href: "/the_long_dusk", label: "The Long Dusk", note: "a Zeroshot fable" },
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
            {s.blurb ? (
              <p style={{ fontSize: 14, color: INK, lineHeight: 1.55, margin: "0 0 14px", maxWidth: 680 }}>{s.blurb}</p>
            ) : null}
            {s.image ? (
              <a href={s.image.href} style={{ display: "block", marginBottom: 12, borderRadius: 12, overflow: "hidden", border: "1px solid #2a2d2b", background: "#151817" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image.src} alt={s.image.alt} style={{ display: "block", width: "100%", height: "auto" }} />
              </a>
            ) : null}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
              {s.links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    style={{
                      display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, rowGap: 2, textDecoration: "none",
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
