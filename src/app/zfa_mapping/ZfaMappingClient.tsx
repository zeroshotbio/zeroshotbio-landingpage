"use client";
// ZfaMappingClient — filterable review table for the Stage 1 ZSCAPE→ZFA mapping.
// Renders the bundled static asset (stage1.v1.json). All CSS is scoped under
// `.zfa` so it does not touch the rest of the site.
import React, { useMemo, useState } from "react";
import DATA from "./stage1.v1.json";

type Candidate = {
  zfa_id: string;
  zfa_name?: string | null;
  caro_bucket?: string | null;
  rule?: string;
  score?: number;
  match_text?: string;
  obsolete?: boolean;
};
type Row = {
  string: string;
  norm_light: string;
  norm_morph: string;
  tiers: Record<string, number>;
  parents: Record<string, string[]>;
  n_cells: number;
  outcome: string;
  rule: string | null;
  zfa_id: string | null;
  zfa_name: string | null;
  caro_bucket: string | null;
  depth: number | null;
  candidates: Candidate[];
  flags: string[];
};
type Meta = {
  zfa_obo_sha256: string;
  zfa_data_version: string;
  zfa_n_terms: number;
  zfa_n_obsolete: number;
  dataset_cells: number;
  generated_utc: string;
  caro_source: string;
  outcome_counts: Record<string, number>;
  rule_counts: Record<string, number>;
  label_weighted_bind_rate: number;
  cell_weighted_coverage_by_tier: Record<
    string,
    { bound_cells: number; tier_cells: number; coverage: number | null }
  >;
};

const PAYLOAD = DATA as unknown as { meta: Meta; labels: Row[] };
const M = PAYLOAD.meta;
const ROWS = PAYLOAD.labels;

const fmt = (n: number | null | undefined) => (n == null ? "" : n.toLocaleString());
const pct = (x: number | null | undefined) =>
  x == null ? "—" : (x * 100).toFixed(x < 0.1 ? 2 : 1) + "%";
const TIERS = ["germ_layer", "tissue", "cell_type_broad", "cell_type_sub"];
const INFO_FLAG = /ABOVE_ROOTS|TISSUE_ABOVE|REDIRECTED/;

const CSS = `
.zfa{--bg:#0d1117;--panel:#161b22;--panel2:#1c2230;--edge:#2a3242;--fg:#e6edf3;--mut:#8b949e;
 --auto:#2ea043;--propose:#d29922;--ambig:#a371f7;--unmatched:#f85149;--chip:#21334d;--chipfg:#79c0ff;
 --flag:#3d1f1f;--flagfg:#ffa198;--info:#243b2a;--infofg:#7ee787;
 background:var(--bg);color:var(--fg);min-height:100vh;
 font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.zfa *{box-sizing:border-box}
.zfa a{color:var(--chipfg)}
.zfa .hd{padding:20px 24px;border-bottom:1px solid var(--edge);background:linear-gradient(180deg,#11161f,#0d1117)}
.zfa h1{margin:0 0 4px;font-size:20px;font-weight:650}
.zfa .sub{color:var(--mut);font-size:12px}
.zfa .wrap{max-width:1500px;margin:0 auto;padding:0 24px 80px}
.zfa .cards{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}
.zfa .card{background:var(--panel);border:1px solid var(--edge);border-radius:10px;padding:12px 16px;min-width:150px}
.zfa .card .k{color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.zfa .card .v{font-size:22px;font-weight:700;margin-top:2px}
.zfa .card .v small{font-size:12px;color:var(--mut);font-weight:500}
.zfa .covrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;align-items:center}
.zfa .covrow .t{font-size:11px;color:var(--mut);width:120px}
.zfa .bar{height:6px;border-radius:3px;background:#30363d;overflow:hidden;width:120px}
.zfa .bar>i{display:block;height:100%;background:var(--auto)}
.zfa .controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0;position:sticky;top:0;background:var(--bg);padding:10px 0;z-index:5;border-bottom:1px solid var(--edge)}
.zfa select,.zfa input[type=text]{background:var(--panel2);color:var(--fg);border:1px solid var(--edge);border-radius:7px;padding:7px 10px;font-size:13px}
.zfa input[type=text]{min-width:230px}
.zfa .count{color:var(--mut);font-size:12px;margin-left:auto}
.zfa table{width:100%;border-collapse:collapse;font-size:13px}
.zfa th{position:sticky;top:52px;background:var(--panel);text-align:left;padding:9px 10px;border-bottom:1px solid var(--edge);color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em;cursor:pointer;white-space:nowrap}
.zfa td{padding:9px 10px;border-bottom:1px solid #1e242e;vertical-align:top}
.zfa tr.row:hover{background:#12171f}
.zfa tr.row{cursor:pointer}
.zfa .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.zfa .label{font-weight:600}
.zfa .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.zfa .b-AUTO_BIND{background:rgba(46,160,67,.16);color:var(--auto);border:1px solid rgba(46,160,67,.4)}
.zfa .b-PROPOSE{background:rgba(210,153,34,.16);color:var(--propose);border:1px solid rgba(210,153,34,.4)}
.zfa .b-AMBIGUOUS{background:rgba(163,113,247,.16);color:var(--ambig);border:1px solid rgba(163,113,247,.4)}
.zfa .b-UNMATCHED{background:rgba(248,81,73,.16);color:var(--unmatched);border:1px solid rgba(248,81,73,.4)}
.zfa .tier{display:inline-block;padding:1px 7px;border-radius:5px;font-size:10px;margin:1px 2px 1px 0;background:var(--chip);color:var(--chipfg);font-weight:600}
.zfa .tier.germ_layer{background:#3a2f14;color:#e3b341}
.zfa .tier.tissue{background:#14303a;color:#56d4dd}
.zfa .tier.cell_type_broad{background:#1d2f14;color:#7ee787}
.zfa .tier.cell_type_sub{background:#2a1d3a;color:#c297ff}
.zfa .rule{font-family:ui-monospace,monospace;font-size:11px;color:var(--mut)}
.zfa .flag{display:inline-block;padding:1px 6px;border-radius:5px;font-size:10px;margin:1px 3px 1px 0;background:var(--flag);color:var(--flagfg);font-weight:600}
.zfa .flag.info{background:var(--info);color:var(--infofg)}
.zfa .bucket{font-size:11px;color:var(--mut)}
.zfa .exp{background:#0b0f16}
.zfa .exp td{padding:12px 16px;border-left:2px solid var(--edge)}
.zfa .exp h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;color:var(--mut);letter-spacing:.04em}
.zfa .cand{display:flex;gap:10px;align-items:center;padding:4px 0;border-bottom:1px solid #161b22;flex-wrap:wrap}
.zfa .score{font-family:ui-monospace,monospace;background:#1c2230;padding:1px 7px;border-radius:5px;font-size:11px}
.zfa .kv{color:var(--mut);font-size:12px;margin:2px 0}
.zfa .kv b{color:var(--fg);font-weight:600}
.zfa .section-h{margin:30px 0 8px;font-size:15px;font-weight:650;display:flex;align-items:center;gap:8px}
.zfa .section-h .n{color:var(--mut);font-weight:500;font-size:13px}
.zfa .unres{border:1px solid var(--unmatched);border-radius:10px;padding:2px 0;background:rgba(248,81,73,.04)}
.zfa .arr{color:var(--mut);display:inline-block;width:12px;transition:transform .12s}
.zfa .arr.open{transform:rotate(90deg)}
`;

function TierBadges({ row }: { row: Row }) {
  return (
    <>
      {Object.keys(row.tiers).map((t) => (
        <span key={t} className={"tier " + t}>
          {t.replace("cell_type_", "")}·{fmt(row.tiers[t])}
        </span>
      ))}
    </>
  );
}

function FlagBadges({ flags }: { flags: string[] }) {
  return (
    <>
      {flags.map((f, i) => (
        <span key={i} className={"flag" + (INFO_FLAG.test(f) ? " info" : "")}>
          {f}
        </span>
      ))}
    </>
  );
}

function CandRow({ c }: { c: Candidate }) {
  return (
    <div className="cand">
      {c.score != null && <span className="score">{c.score}</span>}
      <span className="rule">{c.rule || ""}</span>
      <span className="mono">{c.zfa_id}</span> <b>{c.zfa_name}</b>
      {c.caro_bucket != null && <span className="bucket">[{c.caro_bucket || "—"}]</span>}
      {c.match_text && <span className="bucket">≈ &quot;{c.match_text}&quot;</span>}
      {c.obsolete && <span className="flag">obsolete</span>}
    </div>
  );
}

function Expanded({ row }: { row: Row }) {
  const parentKeys = Object.keys(row.parents || {});
  return (
    <td colSpan={9}>
      <div className="kv">
        <b>norm(light):</b> <span className="mono">{row.norm_light}</span> &nbsp;
        <b>norm(morph):</b> <span className="mono">{row.norm_morph}</span>
        {row.depth != null && (
          <>
            {" "}
            &nbsp; <b>is_a depth:</b> {row.depth}
          </>
        )}
      </div>
      {parentKeys.length > 0 && (
        <div className="kv">
          <b>ZSCAPE parent context:</b>{" "}
          {parentKeys.map((t) => `${t}→[${row.parents[t].join(", ")}]`).join("   ")}
        </div>
      )}
      {row.candidates && row.candidates.length > 0 && (
        <>
          <h4>candidates / rule that proposed each</h4>
          {row.candidates.map((c, i) => (
            <CandRow key={i} c={c} />
          ))}
        </>
      )}
    </td>
  );
}

export default function ZfaMappingClient() {
  const [fOutcome, setFOutcome] = useState("");
  const [fTier, setFTier] = useState("");
  const [fRule, setFRule] = useState("");
  const [fFlag, setFFlag] = useState("");
  const [fText, setFText] = useState("");
  const [sortK, setSortK] = useState<keyof Row>("n_cells");
  const [sortDir, setSortDir] = useState(-1);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const flagOpts = useMemo(() => {
    const s = new Set<string>();
    ROWS.forEach((r) => r.flags.forEach((f) => s.add(f.split(":")[0])));
    return Array.from(s).sort();
  }, []);

  const rows = useMemo(() => {
    const fx = fText.toLowerCase().trim();
    const out = ROWS.filter((r) => {
      if (fOutcome && r.outcome !== fOutcome) return false;
      if (fTier && !(fTier in r.tiers)) return false;
      if (fRule && r.rule !== fRule) return false;
      if (fFlag && !r.flags.some((f) => f.split(":")[0] === fFlag)) return false;
      if (fx) {
        const hay = (r.string + " " + (r.zfa_name || "") + " " + (r.zfa_id || "")).toLowerCase();
        if (!hay.includes(fx)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      const x = a[sortK] ?? "";
      const y = b[sortK] ?? "";
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    });
    return out;
  }, [fOutcome, fTier, fRule, fFlag, fText, sortK, sortDir]);

  const unres = useMemo(
    () =>
      ROWS.filter((r) => r.outcome === "UNMATCHED" || r.outcome === "AMBIGUOUS").sort(
        (a, b) => b.n_cells - a.n_cells
      ),
    []
  );

  const toggle = (key: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const sortBy = (k: keyof Row) => {
    if (sortK === k) setSortDir((d) => -d);
    else {
      setSortK(k);
      setSortDir(k === "n_cells" ? -1 : 1);
    }
  };

  const oc = M.outcome_counts || {};
  const cov = M.cell_weighted_coverage_by_tier || {};

  return (
    <div className="zfa">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hd">
        <h1>ZSCAPE → ZFA · Stage 1 mechanical mapping</h1>
        <div className="sub">
          zfa.obo <span className="mono">{M.zfa_data_version}</span> · sha256{" "}
          <span className="mono">{(M.zfa_obo_sha256 || "").slice(0, 16)}…</span> ·{" "}
          {fmt(M.zfa_n_terms)} terms ({M.zfa_n_obsolete} obsolete) · {fmt(M.dataset_cells)} cells ·
          built {(M.generated_utc || "").replace("T", " ").slice(0, 19)} UTC · CARO buckets reused
          from {M.caro_source}
        </div>
      </div>

      <div className="wrap">
        <div className="cards">
          <div className="card">
            <div className="k">auto-bind</div>
            <div className="v">
              {oc.AUTO_BIND || 0}
              <small> / {ROWS.length}</small>
            </div>
            <div className="sub">label-weighted {pct(M.label_weighted_bind_rate)}</div>
          </div>
          <div className="card">
            <div className="k">propose</div>
            <div className="v">{oc.PROPOSE || 0}</div>
            <div className="sub">need Stage 2</div>
          </div>
          <div className="card">
            <div className="k">ambiguous</div>
            <div className="v">{oc.AMBIGUOUS || 0}</div>
            <div className="sub">never bound</div>
          </div>
          <div className="card">
            <div className="k">unmatched</div>
            <div className="v">{oc.UNMATCHED || 0}</div>
            <div className="sub">explicit gap</div>
          </div>
          <div className="card" style={{ minWidth: 300 }}>
            <div className="k">cell-weighted coverage (auto-bound / {fmt(M.dataset_cells)})</div>
            {TIERS.map((t) => {
              const c = cov[t] || { coverage: 0 };
              const p = (c.coverage || 0) * 100;
              return (
                <div className="covrow" key={t}>
                  <span className="t">{t}</span>
                  <span className="mono" style={{ width: 56 }}>
                    {pct(c.coverage)}
                  </span>
                  <span className="bar">
                    <i style={{ width: p.toFixed(1) + "%" }} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="controls">
          <select value={fOutcome} onChange={(e) => setFOutcome(e.target.value)}>
            <option value="">outcome: all</option>
            {["AUTO_BIND", "PROPOSE", "AMBIGUOUS", "UNMATCHED"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <select value={fTier} onChange={(e) => setFTier(e.target.value)}>
            <option value="">tier: all</option>
            {TIERS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={fRule} onChange={(e) => setFRule(e.target.value)}>
            <option value="">rule: all</option>
            {["R1", "R2", "R3", "R4", "R5", "R6", "R7"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select value={fFlag} onChange={(e) => setFFlag(e.target.value)}>
            <option value="">flag: all</option>
            {flagOpts.map((f) => (
              <option key={f} value={f}>
                flag: {f}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="search label / ZFA name / id"
            value={fText}
            onChange={(e) => setFText(e.target.value)}
          />
          <span className="count">
            {rows.length} / {ROWS.length} labels
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th onClick={() => sortBy("n_cells")}>cells {sortK === "n_cells" ? (sortDir < 0 ? "▾" : "▴") : ""}</th>
              <th onClick={() => sortBy("string")}>label</th>
              <th>tiers</th>
              <th onClick={() => sortBy("outcome")}>outcome</th>
              <th onClick={() => sortBy("rule")}>rule</th>
              <th>ZFA id</th>
              <th>ZFA name</th>
              <th onClick={() => sortBy("caro_bucket")}>CARO bucket</th>
              <th>flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = open.has(r.string);
              return (
                <React.Fragment key={r.string}>
                  <tr className="row" onClick={() => toggle(r.string)}>
                    <td className="mono">{fmt(r.n_cells)}</td>
                    <td>
                      <span className={"arr" + (isOpen ? " open" : "")}>▶</span>{" "}
                      <span className="label">{r.string}</span>
                    </td>
                    <td>
                      <TierBadges row={r} />
                    </td>
                    <td>
                      <span className={"badge b-" + r.outcome}>{r.outcome}</span>
                    </td>
                    <td className="rule">{r.rule || ""}</td>
                    <td className="mono">{r.zfa_id || ""}</td>
                    <td>{r.zfa_name || ""}</td>
                    <td className="bucket">{r.caro_bucket == null ? "" : r.caro_bucket || "—"}</td>
                    <td>
                      <FlagBadges flags={r.flags} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="exp">
                      <Expanded row={r} />
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="section-h">
          ⛔ Unresolved <span className="n">({unres.length})</span>
        </div>
        <div className="sub" style={{ marginBottom: 8 }}>
          AMBIGUOUS + UNMATCHED — never silently bound. Fuzzy hints (below the R7 auto-propose
          floor) shown for triage.
        </div>
        <div className="unres">
          <table>
            <thead>
              <tr>
                <th>cells</th>
                <th>label</th>
                <th>tiers</th>
                <th>outcome</th>
                <th>top fuzzy hints (score)</th>
              </tr>
            </thead>
            <tbody>
              {unres.map((r) => {
                const hints =
                  (r.candidates || [])
                    .map(
                      (c) => `${c.zfa_name || c.zfa_id}${c.score != null ? ` (${c.score})` : ""}`
                    )
                    .join(" · ") || "—";
                return (
                  <tr key={r.string}>
                    <td className="mono">{fmt(r.n_cells)}</td>
                    <td className="label">{r.string}</td>
                    <td>
                      <TierBadges row={r} />
                    </td>
                    <td>
                      <span className={"badge b-" + r.outcome}>{r.outcome}</span>
                    </td>
                    <td className="bucket">{hints}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
