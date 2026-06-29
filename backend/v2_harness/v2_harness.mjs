// ── v2.0 harness — MULTI-LEVEL top-down expectation-guided recursion (MVP/POC) ───
// Reuses the existing gpt-5.5 three-personality machinery (prod /api/kasperov_agent:
// Researcher→Archivist→Reasoner) unchanged. New control flow:
//   LEVEL 0  coarse pass → TISSUE checklist (which expected tissues still missing?)
//   GATE     descend into a compartment ONLY IF (a) its coarse call was confident (assign)
//            AND (b) the checklist still lists something expected-and-unfound in that branch
//            (a routed-unfound tissue, OR unresolved expected cell types of its own tissue).
//   LEVEL 1  sub-leaf pass with the confirmed parent umbrella injected top-down + the
//            CELL-TYPE checklist + layer-appropriate experiential hints (attempt easy types;
//            abstain OK on hard continuum/endoderm blends) → CELL-TYPE checklist gap.
//   ESCAPE   at any sub-leaf, if its markers strongly+specifically contradict the parent
//            umbrella (a real lineage anchor, not a promiscuous gene), the Reasoner may
//            RE-HOME it outside the parent instead of forcing a subtype.
// Targeted-deep, not exhaustive-deep. GT-blind throughout. Pre-computed v2 leaves only.
import fs from "node:fs";
import { EXPECTED_TISSUES, EXPERIENTIAL_BANK, ROUTING_RULES, CELLTYPE_CHECKLIST, RUN_PLAN } from "./v2_config.mjs";

const DIR = "/data/scratch/bench/v2_mvp";
const SUB = JSON.parse(fs.readFileSync(`${DIR}/zscape_v2_substrate.json`, "utf8"));
const ENDPOINT = "https://www.zeroshot.bio/api/kasperov_agent", MODEL = "gpt-5.5";
const PW = process.env.KPW || ""; if (!PW) { console.error("KPW not set"); process.exit(1); }
const AUTH = "Basic " + Buffer.from("autopilot:" + PW).toString("base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const compById = Object.fromEntries(SUB.compartments.map((c) => [c.id, c]));

const trace = { meta: { dataset: "zscape_recursive (v2 substrate)", model: MODEL, harness: "v2.0 — multi-level top-down expectation-guided recursion (MVP)", note: "Inference via prod gpt-5.5 machinery unchanged; only the control flow is new. Multi-level: tissue checklist (L0) → gated descent → cell-type checklist (L1), with an escape hatch. Coarse markers derived from leaf-marker frequency (MVP). GT-blind." }, expectedTissues: EXPECTED_TISSUES.map((t) => t.tissue), level0_coarse: [], tissueGap: null, descents: [], skipped: [] };
const save = () => fs.writeFileSync(`${DIR}/zscape_v2_trace.json`, JSON.stringify(trace, null, 1));

async function callAgent(cluster, userMsg, mode, prior = []) {
  const body = { dataset: "zscape_recursive", model: MODEL, mode, cluster, messages: [...prior, { role: "user", content: userMsg }] };
  for (let a = 0; a < 2; a++) {
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 290000);
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", authorization: AUTH }, body: JSON.stringify(body), signal: ctrl.signal });
      if (!r.ok || !r.body) { clearTimeout(to); throw new Error("HTTP " + r.status); }
      const dec = new TextDecoder(); let buf = "", text = "";
      for await (const ch of r.body) { buf += dec.decode(ch, { stream: true }); const ps = buf.split("\n\n"); buf = ps.pop(); for (const p of ps) { const l = p.split("\n").find((x) => x.startsWith("data:")); if (!l) continue; let e; try { e = JSON.parse(l.slice(5).trim()); } catch { continue; } if (e.t === "text") text += e.v; else if (e.t === "error") text += `\n_[error: ${e.v}]_`; } }
      clearTimeout(to); if (text.trim()) return text.trim(); throw new Error("empty");
    } catch (e) { if (a === 0) { await sleep(1500); continue; } return `_[call failed: ${String(e.message || e)}]_`; }
  }
}
function parseConclude(text) {
  const m = text.match(/```kasperov-conclude\s*([\s\S]*?)```/);
  const raw = m ? m[1] : (text.match(/\{[^{}]*"identity"[\s\S]*?\}/)?.[0] ?? null);
  if (raw) { try { const o = JSON.parse(raw); return { identity: o.identity ?? o.label ?? "?", tier: o.tier ?? "?", decision: o.decision ?? "assign", confidence: o.confidence ?? null, rehomed: !!o.rehomed, rehomedTo: o.rehomedTo ?? null }; } catch {} }
  const v = text.match(/\*\*Verdict:\*\*\s*([^\n]+)/i);
  return v ? { identity: v[1].trim(), tier: "?", decision: "assign", confidence: null, rehomed: false, rehomedTo: null, _from: "verdict-line" } : null;
}
const clusterObj = (id, markers, nCells) => ({ id, label: id, degsUp: markers, markers: markers.map((g) => ({ g })), markersDown: [], nCells });
const markersStr = (m) => m.join(", ");

async function labelCluster(cluster, framing, tag) {
  const turns = [];
  process.stdout.write(`    · ${tag} R…`);
  const r1 = await callAgent(cluster, framing.researcher, "research");
  turns.push({ mode: "research", prompt: framing.researcher, text: r1 }); process.stdout.write(" A…");
  const a1 = await callAgent(cluster, framing.archivist, "archivist", [{ role: "user", content: framing.researcher }, { role: "assistant", content: r1 }]);
  turns.push({ mode: "archivist", prompt: framing.archivist, text: a1 }); process.stdout.write(" Rea…");
  let prior = [{ role: "user", content: framing.researcher }, { role: "assistant", content: r1 }, { role: "user", content: "Archivist raw-data check:" }, { role: "assistant", content: a1 }];
  let call = null, rt = "";
  for (let round = 0; round < framing.rounds; round++) {
    const rp = round === 0 ? framing.reasoner : "Decide now — conclude with a kasperov-conclude block (assign, abstain/roll-up, or escape-hatch re-home).";
    rt = await callAgent(cluster, rp, "reason", prior); turns.push({ mode: "reason", prompt: rp, text: rt });
    call = parseConclude(rt); if (call) break; prior = [...prior, { role: "user", content: rp }, { role: "assistant", content: rt }];
  }
  call = call ?? { identity: "(no conclusion)", tier: "?", decision: "abstain", confidence: null, rehomed: false, rehomedTo: null };
  console.log(` → ${call.rehomed ? "↗ RE-HOME→ " + (call.rehomedTo || call.identity) : call.identity + " [" + call.decision + "]"}`);
  return { turns, call };
}

function coarseFraming(markers) {
  return {
    researcher: `TOP-DOWN RECURSIVE LABELLING — LEVEL 0 (COARSE). This is a BROAD coarse compartment from the ZSCAPE zebrafish 48 hpf atlas; it likely holds several finer cell types. Name the BROAD germ-layer / tissue UMBRELLA it represents — NOT a fine subtype. Top markers: ${markersStr(markers)}. Ground each claim (ZFIN/ZFA/GO); if genuinely ambiguous give the deepest defensible umbrella, else abstain.`,
    archivist: `Report the raw stats you have for these top markers (${markersStr(markers)}).`,
    reasoner: `CONCLUDE this coarse pass with a kasperov-conclude block at the UMBRELLA tier (germ layer / tissue; state "none"). Assign if grounded; abstain only if the markers are genuinely incoherent.`,
    rounds: RUN_PLAN.reasonerRounds,
  };
}
function leafFraming(markers, umbrella, hintKeys, lookFor, checklist) {
  const hints = [...new Set(hintKeys)].map((k) => "• " + EXPERIENTIAL_BANK[k]).join("\n");
  const easy = checklist?.easy?.length ? `MAKE SURE TO ATTEMPT these expected, clear-marker cell types if the markers fit: ${checklist.easy.join("; ")}.` : "";
  const hard = checklist?.hard?.length ? `PRE-WARNED hard/continuum types (ABSTAIN is acceptable — do NOT force a call): ${checklist.hard.join("; ")}.` : "";
  return {
    researcher: `TOP-DOWN RECURSIVE LABELLING — LEVEL 1 (SUB-LEAF). This is a SUB-POPULATION WITHIN a compartment the labeller already called "${umbrella}" — the labeller's OWN prior call (NOT ground truth); treat it as a strong prior. EXPERIENTIAL PRIORS for ZSCAPE 48 hpf (HINTS, not rules):\n${hints}\n${easy}\n${hard}\n${lookFor ? `This descent is also checking for hidden populations — look for ${lookFor}; only assign one if THIS leaf's own markers specifically support it.\n` : ""}ESCAPE HATCH: if THIS leaf's markers STRONGLY and SPECIFICALLY contradict "${umbrella}" — a real lineage anchor (a high-specificity master gene), NOT a promiscuous/shared gene — say so; the Reasoner may RE-HOME it outside "${umbrella}".\nIdentify the SPECIFIC SUBTYPE of this leaf. Top markers: ${markersStr(markers)}. If the markers don't confidently support a subtype, ABSTAIN and roll up to "${umbrella}".`,
    archivist: `Report the raw stats you have for these top markers (${markersStr(markers)}).`,
    reasoner: `Conclude with a kasperov-conclude block. Normally assign the subtype if grounded in THIS leaf's markers, else abstain and roll up to "${umbrella}". ESCAPE HATCH: if the markers are a specific lineage anchor that contradicts "${umbrella}", set "rehomed": true and "rehomedTo": "<correct identity outside ${umbrella}>" — use sparingly; a promiscuous/low-specificity marker is NOT enough. Stay GT-blind.`,
    rounds: RUN_PLAN.reasonerRounds,
  };
}
const matchTissue = (id) => { const s = (id || "").toLowerCase(); for (const t of EXPECTED_TISSUES) if (t.syn.some((k) => s.includes(k))) return t.tissue; return null; };
const matchCellType = (id, checklist) => { if (!checklist) return null; const s = (id || "").toLowerCase(); for (const ct of [...(checklist.easy || []), ...(checklist.hard || [])]) { const key = ct.split(/[\/(]/)[0].trim().toLowerCase(); if (key.length > 3 && s.includes(key)) return ct; } return null; };

(async () => {
  // ── LEVEL 0 — coarse pass + tissue checklist ──
  console.log(`\n=== LEVEL 0 — coarse pass (${RUN_PLAN.coarseCompartments.length}) ===`);
  for (const cid of RUN_PLAN.coarseCompartments) {
    const c = compById[cid]; if (!c) continue;
    console.log(`  ${cid} (n=${c.nCells}, ${c.nLeaves} leaves) [${c.degsUp.slice(0, 6).join(", ")}]`);
    const res = await labelCluster(clusterObj(cid, c.degsUp, c.nCells), coarseFraming(c.degsUp), cid);
    trace.level0_coarse.push({ compartmentId: cid, nCells: c.nCells, nLeaves: c.nLeaves, markers: c.degsUp, leafIds: c.leafIds, turns: res.turns, call: res.call, matchedTissue: matchTissue(res.call.identity), confident: res.call.decision === "assign" });
    save();
  }
  const fm = {}; for (const cc of trace.level0_coarse) if (cc.matchedTissue) (fm[cc.matchedTissue] ??= []).push(cc.compartmentId);
  const unfound = EXPECTED_TISSUES.map((t) => t.tissue).filter((t) => !fm[t]);
  trace.tissueGap = { found: Object.entries(fm).map(([tissue, comps]) => ({ tissue, comps })), unfound };
  console.log(`\n=== tissue checklist gap ===\n  found: ${Object.keys(fm).join(", ")}\n  UNFOUND: ${unfound.join(", ")}`);
  save();

  // ── GATE + LEVEL 1 — gated descent per compartment ──
  for (const cc of trace.level0_coarse) {
    const cid = cc.compartmentId, c = compById[cid], umbrella = cc.call.identity, tissue = cc.matchedTissue;
    if (!cc.confident) { trace.skipped.push({ compartmentId: cid, umbrella, reason: "GATE fail — parent call not confident (abstained); do not descend" }); save(); continue; }
    const huntUnfound = unfound.filter((t) => ROUTING_RULES[t] && ROUTING_RULES[t].intoUmbrella.some((u) => umbrella.toLowerCase().includes(u.toLowerCase())));
    const checklist = tissue ? CELLTYPE_CHECKLIST[tissue] : null;
    const reasons = [];
    if (huntUnfound.length) reasons.push(`hunt routed-unfound tissue(s): ${huntUnfound.join(", ")}`);
    if (checklist) reasons.push(`resolve expected cell types of "${tissue}": ${[...checklist.easy, ...checklist.hard].join("; ")}`);
    if (!reasons.length) { trace.skipped.push({ compartmentId: cid, umbrella, reason: "GATE fail — checklist empty in this branch (nothing expected-and-unfound)" }); save(); continue; }
    // build the level-1 lookFor + experiential hints
    const hintKeys = ["adult_markers_off"]; const lookFors = [];
    for (const t of huntUnfound) { const rl = ROUTING_RULES[t]; if (rl) { hintKeys.push(...rl.hints); lookFors.push(rl.lookFor); } }
    const desc = { compartmentId: cid, umbrella, confident: true, tissue, descendReasons: reasons, huntUnfound, cellTypeChecklist: checklist ? { tissue, easy: checklist.easy, hard: checklist.hard } : null, leaves: [], cellTypeGap: null, escapes: [] };
    trace.descents.push(desc); save();
    const leaves = c.leafIds.map((id) => ({ id, ...SUB.leaves[id] })).sort((a, b) => b.nCells - a.nCells).slice(0, RUN_PLAN.recurseLeafCap);
    console.log(`\n=== GATE PASS → LEVEL 1 descend ${cid} ("${umbrella}") — ${reasons.length} reason(s), ${leaves.length} leaves ===`);
    const foundCT = new Set();
    for (const lf of leaves) {
      const res = await labelCluster(clusterObj(lf.id, lf.degsUp, lf.nCells), leafFraming(lf.degsUp, umbrella, hintKeys, lookFors.join("; "), checklist), lf.id);
      const ct = matchCellType(res.call.identity, checklist); if (ct) foundCT.add(ct);
      const leafRec = { leafId: lf.id, nCells: lf.nCells, markers: lf.degsUp, turns: res.turns, call: res.call, matchedCellType: ct, matchedTissue: matchTissue(res.call.identity) };
      desc.leaves.push(leafRec);
      if (res.call.rehomed) desc.escapes.push({ leafId: lf.id, from: umbrella, to: res.call.rehomedTo || res.call.identity });
      save();
    }
    if (checklist) desc.cellTypeGap = { found: [...foundCT], stillMissing: [...checklist.easy, ...checklist.hard].filter((x) => !foundCT.has(x)) };
    save();
  }
  console.log(`\n=== DONE. trace → ${DIR}/zscape_v2_trace.json ===`);
  console.log(`  descended: ${trace.descents.map((d) => d.compartmentId).join(", ")} | skipped: ${trace.skipped.map((s) => s.compartmentId).join(", ") || "none"} | escapes: ${trace.descents.reduce((n, d) => n + d.escapes.length, 0)}`);
})();
