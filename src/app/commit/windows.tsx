// The four file windows on /commit.
//
// These render the challenge inputs AS THE CONTESTANT RECEIVES THEM — the files that ship, the
// columns that ship, the rows that ship, nothing else. cluster_public.csv has no window because it
// is no longer part of the delivery: once its four ZSCAPE label columns are withheld, the two that
// remain (cluster_id, n_cells) are byte-identical to columns of gold_features.csv. The builder
// still reads it as the source for the cluster-size distribution; the manifest marks it
// shipped:false. Anything withheld is named once, in the "what you are not given"
// column of the page, and never appears here; a window that listed the held-back fields would stop
// being a window into the file and start being a description of our copy of it.
//
// Every number, hash and shape below is read from the build-time bundle (src/app/commit/data/,
// emitted by scripts/build_commit_challenge_asset.py), so a rebuild moves the page.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, ACCENT, CARD, card, nfmt } from "./theme";
import MANIFEST from "./data/manifest.json";
import FEATURES from "./data/gold_features_preview.json";
import MENU from "./data/zfa_menu_preview.json";
import H5AD from "./data/h5ad_summary.json";

const FILES: Record<string, any> = Object.fromEntries(
  (MANIFEST as any).files.map((f: any) => [f.file, f])
);

// ── window chrome ──────────────────────────────────────────────────────────
// `file` is the manifest key (our row's path); `display` is what a contestant actually receives.
function Window({ file, display, kicker, children }: {
  file: string; display?: string; kicker: string; children: React.ReactNode;
}) {
  const f = FILES[file];
  const name = display ?? file;
  return (
    <section style={{ ...card, marginBottom: 22 }}>
      <header style={{ padding: "14px 18px", borderBottom: `1px solid ${RULE}`, background: "#faf9f7" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: INK }}>{name}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
            {f.size_human} · {f.shape}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>{kicker}</div>
        <div title={f.sha256}
             style={{ fontFamily: MONO, fontSize: 10, color: FAINT, marginTop: 7, wordBreak: "break-all" }}>
          sha256 {f.sha256}
        </div>
      </header>
      {children}
    </section>
  );
}

const scroll: React.CSSProperties = { overflowX: "auto", WebkitOverflowScrolling: "touch" };
const th: React.CSSProperties = {
  fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
  color: MUTED, textAlign: "left", padding: "9px 14px", borderBottom: `1px solid ${RULE}`,
  whiteSpace: "nowrap", background: CARD, position: "sticky", top: 0,
};
const td: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11.5, color: INK, padding: "7px 14px",
  borderBottom: "1px solid #f2efeb", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
};
const footRow: React.CSSProperties = {
  padding: "10px 18px", fontSize: 11.5, color: FAINT, borderTop: `1px solid ${RULE}`, background: "#faf9f7",
};

// ── 1. gold_features.csv ───────────────────────────────────────────────────
export function GoldFeaturesWindow() {
  const cols = (FEATURES as any).schema.filter((s: any) => s.in_challenge_input);
  const rows = (FEATURES as any).rows as any[];
  const markerCols: string[] = (FEATURES as any).marker_columns;

  return (
    <Window
      file="gold_features.csv"
      kicker="The primary input. One row per cluster: three ordered 50-gene marker lists plus per-cluster QC."
    >
      {/* schema */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${RULE}` }}>
        <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED, marginBottom: 9 }}>
          schema · {cols.length} columns
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: "7px 20px" }}>
          {cols.map((c: any) => (
            <div key={c.column} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid #f2efeb", paddingBottom: 5 }}>
              <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: INK }}>{c.column}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: FAINT, textAlign: "right" }}>
                {c.genes_per_row ? `list · ${c.genes_per_row.min}–${c.genes_per_row.max} genes` : c.dtype}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* example rows */}
      <div style={scroll}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
          <thead>
            <tr>
              <th style={th}>cluster_id</th><th style={th}>n_cells</th>
              <th style={th}>top_50_markers</th><th style={th}>mean_umi</th><th style={th}>pct_mito</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cluster_id}>
                <td style={{ ...td, fontWeight: 700 }}>{r.cluster_id}</td>
                <td style={td}>{nfmt(r.n_cells)}</td>
                <td style={{ ...td, whiteSpace: "normal", minWidth: 340 }}>
                  {r.top_50_markers.shown.map((g: string, i: number) => (
                    <span key={g} style={{ color: i < 3 ? INK : MUTED }}>
                      {g}<span style={{ color: FAINT }}>{i < r.top_50_markers.shown.length - 1 ? ";" : ""}</span>
                    </span>
                  ))}
                  <span style={{ color: ACCENT, fontWeight: 700, marginLeft: 6 }}>{r.top_50_markers.more_label}</span>
                </td>
                <td style={td}>{r.mean_umi}</td>
                <td style={td}>{r.pct_mitochondrial}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={footRow}>
        Showing {rows.length} of {nfmt((FEATURES as any).total_rows)} rows, and the first{" "}
        {(FEATURES as any).markers_shown_per_list} genes of one of the three marker lists. The file
        carries all 50, in rank order, for each of{" "}
        {markerCols.map((c, i) => (
          <span key={c}><code style={{ fontFamily: MONO }}>{c}</code>{i < markerCols.length - 1 ? ", " : ""}</span>
        ))}.
      </div>
    </Window>
  );
}

// ── 2. artifacts/zfa_menu.v1.json ──────────────────────────────────────────
export function ZfaMenuWindow() {
  const terms = (MENU as any).sample_terms as any[];
  const src = (MENU as any).source;
  const depth = (MENU as any).depth_range;

  return (
    <Window
      file="artifacts/zfa_menu.v1.json"
      kicker="The answer space. Every label you submit must be one of these terms — selected by identifier, not typed as free text."
    >
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${RULE}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
        {[
          ["terms", nfmt((MENU as any).n_terms)],
          ["ontology release", src.release?.replace("releases/", "") ?? "—"],
          ["depth range", depth ? `${depth.min} – ${depth.max}` : "—"],
          ["version", (MENU as any).version],
        ].map(([k, v]) => (
          <div key={k as string}>
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED }}>{k}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: INK, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ ...scroll, maxHeight: 330, overflowY: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
          <thead>
            <tr>
              <th style={th}>zfa id</th><th style={th}>name</th>
              <th style={th}>caro</th><th style={th}>depth</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <td style={{ ...td, fontWeight: 700, color: ACCENT }}>{t.id}</td>
                <td style={{ ...td, whiteSpace: "normal" }}>{t.name}</td>
                <td style={{ ...td, color: MUTED, fontSize: 10.5 }}>{t.caro.replace(/_/g, " ")}</td>
                <td style={{ ...td, color: MUTED }}>{t.depth ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={footRow}>
        {terms.length} of {nfmt((MENU as any).n_terms)} terms, spread across the depth range rather
        than taken from the top of the list. Depth is the shortest <code style={{ fontFamily: MONO }}>is_a</code>{" "}
        distance to a root — depth 0 is the whole organism, depth 10 is about as specific as this
        ontology gets.
      </div>
      <div style={{ ...footRow, borderTop: "none", paddingTop: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: FAINT, wordBreak: "break-all" }}>
          menu_version_hash {(MENU as any).menu_version_hash}
        </div>
        <div style={{ marginTop: 6 }}>
          Both sides select from this exact set; matching the hash is how parity is proven.
        </div>
      </div>
    </Window>
  );
}

// ── 3. zscape_gold_48hpf.h5ad ──────────────────────────────────────────────
export function H5adWindow() {
  const h = H5AD as any;
  const checks = h.validation_checks as any[];
  const passed = checks.filter((c) => c.verdict === "PASS").length;

  const spec: [string, string][] = [
    ["shape", `${nfmt(h.shape.cells)} cells × ${nfmt(h.shape.genes)} genes`],
    ["X", `${h.X.contents} · ${h.X.dtype}`],
    ["layers['counts']", `raw integer counts · ${h.layers.counts_dtype}`],
    ["cluster key", `obs['${h.cluster_obs_key}'] · ${h.clusters} categories`],
    ["stage", `${h.timepoint_hpf} hpf · ${h.arm} arm`],
    ["obsm", h.obsm_keys.join(", ")],
  ];

  return (
    <Window
      file="zscape_gold_48hpf.h5ad"
      kicker="The expression matrix, if you want to compute your own evidence rather than take ours."
    >
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${RULE}` }}>
        {spec.map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 16, justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f2efeb" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{k}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: INK, textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${RULE}` }}>
        <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED, marginBottom: 9 }}>
          obs columns
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {h.obs_columns.map((c: string) => (
            <span key={c} style={{ fontFamily: MONO, fontSize: 10.5, background: "#f1efeb", color: "#6b655d", border: `1px solid ${RULE}`, borderRadius: 999, padding: "3px 9px" }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 18px" }}>
        <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED, marginBottom: 9 }}>
          arrival validation · {passed}/{checks.length} pass
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))", gap: "5px 18px" }}>
          {checks.map((c) => (
            <div key={c.check} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 11.5, color: MUTED }}>
              <span style={{ color: "#3f6b55", fontWeight: 700, fontFamily: MONO, fontSize: 10 }}>✓</span>
              <span>{c.check}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={footRow}>
        QC is already applied upstream — UMI ≥ 100, mitochondrial &lt; 25%, hash ratio ≥ 5.{" "}
        <strong style={{ color: MUTED }}>Do not re-filter.</strong> Highly variable genes are
        flagged in <code style={{ fontFamily: MONO }}>var</code>, never subset, so the matrix keeps
        its full width.
      </div>
    </Window>
  );
}
