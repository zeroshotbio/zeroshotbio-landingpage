// §02 — the three files, written the way §01 is written.
//
// This replaced a stack of bordered "file window" cards, each with its own header band, hash line,
// grid of boxed field descriptions and footer. All of it was true and none of it was readable: six
// levels of chrome around three files. Here a file is a heading, a paragraph, a plain list of its
// fields, and one look inside. The tables carry the only borders on the page.
import React from "react";
import { MONO, RULE, MUTED, FAINT, INK, FILE, nfmt } from "../theme";
import { GoldFeaturesRows, ZfaMenuRows, MatrixWindow, GF_FIELDS, MENU_FIELDS, EXAMPLE_CLUSTER } from "../parts";
import MANIFEST from "../data/manifest.json";
import MENU from "../data/zfa_menu_preview.json";
import H5AD from "../data/h5ad_summary.json";

const FILES: Record<string, any> = Object.fromEntries(
  (MANIFEST as any).files.map((f: any) => [f.file, f])
);

const prose: React.CSSProperties = { fontSize: 15.5, lineHeight: 1.72, color: "#3f3a34", maxWidth: 700 };

function FileHead({ name, keyName }: { name: string; keyName: string }) {
  const f = FILES[keyName];
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: FILE, margin: 0,
                   letterSpacing: -0.2 }}>
        {name}
      </h3>
      <div style={{ fontFamily: MONO, fontSize: 10, color: FAINT, marginTop: 6, wordBreak: "break-all" }}>
        {f.size_human} · {f.shape} · sha256 {f.sha256}
      </div>
    </div>
  );
}

// The fields of a file, as a list rather than a grid of cards.
function Fields({ items }: { items: { col: string; blurb: string }[] }) {
  return (
    <dl style={{ margin: "18px 0 0", maxWidth: 760 }}>
      {items.map((f, i) => (
        <div key={f.col} style={{ display: "flex", gap: 18, alignItems: "baseline", flexWrap: "wrap",
                                  padding: "9px 0", borderTop: i === 0 ? `1px solid ${RULE}` : "1px solid #f2efeb" }}>
          <dt style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: INK,
                       flex: "0 0 190px", minWidth: 0 }}>
            {f.col}
          </dt>
          <dd style={{ margin: 0, fontSize: 13.5, color: MUTED, lineHeight: 1.6, flex: "1 1 300px", minWidth: 0 }}>
            {f.blurb}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const blockGap: React.CSSProperties = { marginTop: 46 };

export default function InputSection() {
  const matrix = `${nfmt((H5AD as any).shape.cells)} × ${nfmt((H5AD as any).shape.genes)}`;

  return (
    <>
      <p style={{ ...prose, margin: "0 0 12px" }}>
        Three files arrive for the run as a whole, not one per cluster. Between them they say which
        clusters exist, what evidence stands behind each one, and what your labeller is allowed to
        answer with. Nothing else is supplied, and nothing in them names a cell type.
      </p>

      {/* ── the matrix ─────────────────────────────────────────────── */}
      <div style={blockGap}>
        <FileHead name="zscape_gold_48hpf.h5ad" keyName="zscape_gold_48hpf.h5ad" />
        <p style={{ ...prose, margin: 0 }}>
          The expression matrix — every cell of every cluster, against every gene. Raw integer
          counts live in <code style={{ fontFamily: MONO, fontSize: 13.5 }}>layers[&apos;counts&apos;]</code>,
          log1p CP10k in <code style={{ fontFamily: MONO, fontSize: 13.5 }}>X</code>, and
          ZSCAPE&apos;s published embedding in <code style={{ fontFamily: MONO, fontSize: 13.5 }}>obsm</code>.
          Your labeller does not have to touch it — the file below already carries ranked markers
          per cluster — but if you would rather compute your own evidence for a cluster than take
          ours, this is what you compute it from.
        </p>
        <p style={{ ...prose, margin: "15px 0 0" }}>
          Quality filtering is already applied: UMI ≥ 100, mitochondrial &lt; 25%, hash ratio ≥ 5.
          Filtering again on top of that is a failure mode, not a refinement. Highly variable genes
          are flagged rather than subset, so the matrix keeps its full width of{" "}
          {nfmt((H5AD as any).shape.genes)} genes.
        </p>
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7,
                        textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>
            Five cells of cluster {EXAMPLE_CLUSTER.replace(/^C0*/, "")}, against its own top five markers
          </div>
          <MatrixWindow />
          <p style={{ ...prose, fontSize: 13.5, margin: "10px 0 0", color: MUTED }}>
            Real counts, and mostly zero. That sparsity runs the full {matrix}, and it is the reason
            a cluster is easier to read from ranked markers than from raw expression.
          </p>
        </div>
      </div>

      {/* ── the features ───────────────────────────────────────────── */}
      <div style={blockGap}>
        <FileHead name="gold_features.csv" keyName="gold_features.csv" />
        <p style={{ ...prose, margin: 0 }}>
          One row per cluster, and the file your labeller will actually read. Each row carries three
          ranked lists of differentially expressed genes — <strong>DEGs</strong>, the genes whose
          expression separates that cluster from others — together with the quality statistics
          behind them. Each list holds <strong>up to fifty</strong> genes in rank order — most are
          full, but a cluster with little to separate it carries fewer, and one cluster&apos;s
          depleted list is empty.
        </p>
        <Fields items={GF_FIELDS} />
        <div style={{ marginTop: 22 }}>
          <GoldFeaturesRows />
        </div>
      </div>

      {/* ── the menu ───────────────────────────────────────────────── */}
      <div style={blockGap}>
        <FileHead name="zfa_menu.v1.json" keyName="artifacts/zfa_menu.v1.json" />
        <p style={{ ...prose, margin: 0 }}>
          The answer space: every term your labeller is permitted to return, frozen against ZFA
          release {(MENU as any).source?.release?.replace("releases/", "")}. It is as much an input
          as the evidence is — a cluster answered with a term that is not on this list has not been
          answered. Both sides draw from this exact file, and matching its content hash is how that
          parity is proven.
        </p>
        <Fields items={MENU_FIELDS} />
        <div style={{ marginTop: 22 }}>
          <ZfaMenuRows />
        </div>
      </div>
    </>
  );
}
