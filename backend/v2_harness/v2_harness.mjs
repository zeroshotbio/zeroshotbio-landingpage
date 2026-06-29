// ── v2.0 harness — top-down expectation-guided recursion (MVP/POC) ───────────────
// Reuses the EXISTING gpt-5.5 three-personality machinery (prod /api/kasperov_agent:
// Researcher→Archivist→Reasoner) unchanged — this file only adds the NEW control flow:
//   coarse-first labelling → expected-tissue gap check → selective recursion into the
//   compartments experiential priors say hold the missing tissues → sub-leaf labelling
//   with the confirmed parent umbrella injected top-down. GT-blind throughout.
// Inference: prod endpoint (the only gpt-5.5 access); auth via KPW env (Basic password).
import fs from "node:fs";
import { EXPECTED_TISSUES, EXPERIENTIAL_BANK, ROUTING_RULES, RUN_PLAN } from "./v2_config.mjs";

const DIR = "/data/scratch/bench/v2_mvp";
const SUB = JSON.parse(fs.readFileSync(`${DIR}/zscape_v2_substrate.json`, "utf8"));
const ENDPOINT = "https://www.zeroshot.bio/api/kasperov_agent";
const MODEL = "gpt-5.5";
const PW = process.env.KPW || "";
if (!PW) { console.error("KPW (Basic password) not set"); process.exit(1); }
const AUTH = "Basic " + Buffer.from("autopilot:" + PW).toString("base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const compById = Object.fromEntries(SUB.compartments.map((c) => [c.id, c]));
const trace = { meta: { dataset: "zscape_recursive (v2 substrate)", model: MODEL, harness: "v2.0 — top-down expectation-guided recursion (MVP)", note: "Inference via prod gpt-5.5 machinery (Researcher→Archivist→Reasoner) unchanged; only the control flow is new. Coarse markers derived from leaf-marker frequency (MVP). Archivist grounds on provided markers (v2 substrate not in :5007). GT-blind." }, expectedTissues: EXPECTED_TISSUES.map((t) => t.tissue), coarse: [], gap: null, routing: [], recursion: [] };
const save = () => fs.writeFileSync(`${DIR}/zscape_v2_trace.json`, JSON.stringify(trace, null, 1));

async function callAgent(cluster, userMsg, mode, prior = []) {
  const body = { dataset: "zscape_recursive", model: MODEL, mode, cluster, messages: [...prior, { role: "user", content: userMsg }] };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 290000);
      const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", authorization: AUTH }, body: JSON.stringify(body), signal: ctrl.signal });
      if (!r.ok || !r.body) { clearTimeout(to); throw new Error("HTTP " + r.status); }
      const dec = new TextDecoder(); let buf = "", text = "";
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop();
        for (const p of parts) { const l = p.split("\n").find((x) => x.startsWith("data:")); if (!l) continue; let e; try { e = JSON.parse(l.slice(5).trim()); } catch { continue; } if (e.t === "text") text += e.v; else if (e.t === "error") text += `\n_[error: ${e.v}]_`; }
      }
      clearTimeout(to);
      if (text.trim()) return text.trim();
      throw new Error("empty");
    } catch (e) { if (attempt === 0) { await sleep(1500); continue; } return `_[call failed: ${String(e.message || e)}]_`; }
  }
}

function parseConclude(text) {
  let m = text.match(/```kasperov-conclude\s*([\s\S]*?)```/);
  let raw = m ? m[1] : (text.match(/\{[^{}]*"identity"[\s\S]*?\}/)?.[0] ?? null);
  if (!raw) { const v = text.match(/\*\*Verdict:\*\*\s*([^\n]+)/i); return v ? { identity: v[1].trim(), tier: "?", decision: "assign", confidence: null, _from: "verdict-line" } : null; }
  try { const o = JSON.parse(raw); return { identity: o.identity ?? o.label ?? "?", tier: o.tier ?? "?", decision: o.decision ?? "assign", confidence: o.confidence ?? null }; } catch { return null; }
}

const clusterObj = (id, markers, nCells) => ({ id, label: id, degsUp: markers, markers: markers.map((g) => ({ g })), markersDown: [], nCells });

async function labelCluster(cluster, framing, tag) {
  const turns = [];
  process.stdout.write(`    · ${tag} researcher…`);
  const r1 = await callAgent(cluster, framing.researcher, "research");
  turns.push({ mode: "research", prompt: framing.researcher, text: r1 }); process.stdout.write(" archivist…");
  const a1 = await callAgent(cluster, framing.archivist, "archivist", [{ role: "user", content: framing.researcher }, { role: "assistant", content: r1 }]);
  turns.push({ mode: "archivist", prompt: framing.archivist, text: a1 }); process.stdout.write(" reasoner…");
  let prior = [{ role: "user", content: framing.researcher }, { role: "assistant", content: r1 }, { role: "user", content: "Archivist raw-data check:" }, { role: "assistant", content: a1 }];
  let call = null, rt = "";
  for (let round = 0; round < framing.rounds; round++) {
    const rp = round === 0 ? framing.reasoner : "Decide now — conclude with a kasperov-conclude block (assign, or abstain and roll up).";
    rt = await callAgent(cluster, rp, "reason", prior);
    turns.push({ mode: "reason", prompt: rp, text: rt });
    call = parseConclude(rt); if (call) break;
    prior = [...prior, { role: "user", content: rp }, { role: "assistant", content: rt }];
  }
  console.log(` → ${call ? call.identity + " [" + call.decision + "]" : "(no conclude)"}`);
  return { turns, call: call ?? { identity: "(no conclusion)", tier: "?", decision: "abstain", confidence: null } };
}

const markersStr = (m) => m.join(", ");
function coarseFraming(markers) {
  return {
    researcher: `TOP-DOWN RECURSIVE LABELLING — COARSE PASS. This is a BROAD coarse compartment (umbrella-level cluster) from the ZSCAPE zebrafish 48 hpf whole-embryo atlas; it likely contains several finer cell types. Name the BROAD germ-layer / tissue UMBRELLA this compartment represents — NOT a fine subtype yet. Top compartment markers: ${markersStr(markers)}. Ground each claim (ZFIN/ZFA/GO); if genuinely ambiguous give the deepest defensible umbrella, else abstain.`,
    archivist: `Report the raw stats you have for this compartment's top markers (${markersStr(markers)}).`,
    reasoner: `Reconcile the reads and CONCLUDE this COARSE pass with a kasperov-conclude block at the UMBRELLA tier (germ layer or tissue; state "none"). Assign the umbrella if grounded; abstain only if the markers are genuinely incoherent.`,
    rounds: RUN_PLAN.reasonerRounds,
  };
}
function leafFraming(markers, umbrella, hintKeys, lookFor) {
  const hints = [...new Set(hintKeys)].map((k) => "• " + EXPERIENTIAL_BANK[k]).join("\n");
  return {
    researcher: `TOP-DOWN RECURSIVE LABELLING — SUB-LEAF. This cluster is a SUB-POPULATION WITHIN a compartment the labeller already called "${umbrella}" — that is the labeller's OWN prior call from the coarse pass, NOT ground truth (treat it as a strong prior, not a fact). EXPERIENTIAL PRIORS for ZSCAPE 48 hpf (HINTS, not rules):\n${hints}\n${lookFor ? `This recursion is specifically checking whether a hidden population is here — look for ${lookFor}. ONLY assign it if THIS leaf's own markers support it (a present, specific positive anchor); otherwise do not.\n` : ""}Given the compartment is "${umbrella}", identify the SPECIFIC SUBTYPE of THIS leaf. Top markers: ${markersStr(markers)}. If the markers don't confidently support a subtype (or the hidden population), ABSTAIN and roll up to "${umbrella}".`,
    archivist: `Report the raw stats you have for this leaf's top markers (${markersStr(markers)}).`,
    reasoner: `Conclude with a kasperov-conclude block: assign the subtype if grounded in THIS leaf's own markers, else abstain and roll up to "${umbrella}". Stay GT-blind — the parent "${umbrella}" is a prior, not ground truth.`,
    rounds: RUN_PLAN.reasonerRounds,
  };
}

function matchTissue(identity) {
  const s = (identity || "").toLowerCase();
  for (const t of EXPECTED_TISSUES) if (t.syn.some((k) => s.includes(k))) return t.tissue;
  return null;
}

(async () => {
  console.log(`\n=== v2.0 coarse pass (${RUN_PLAN.coarseCompartments.length} compartments) ===`);
  for (const cid of RUN_PLAN.coarseCompartments) {
    const c = compById[cid]; if (!c) { console.log("  missing", cid); continue; }
    console.log(`  ${cid} (n=${c.nCells}, ${c.nLeaves} leaves) [${c.degsUp.slice(0,6).join(", ")}]`);
    const res = await labelCluster(clusterObj(cid, c.degsUp, c.nCells), coarseFraming(c.degsUp), cid);
    trace.coarse.push({ compartmentId: cid, nCells: c.nCells, nLeaves: c.nLeaves, markers: c.degsUp, leafIds: c.leafIds, turns: res.turns, call: res.call, matchedTissue: matchTissue(res.call.identity) });
    save();
  }

  // GAP CHECK
  const foundMap = {};
  for (const cc of trace.coarse) if (cc.matchedTissue) (foundMap[cc.matchedTissue] ??= []).push(cc.compartmentId);
  const found = Object.entries(foundMap).map(([tissue, comps]) => ({ tissue, comps }));
  const unfound = EXPECTED_TISSUES.map((t) => t.tissue).filter((t) => !foundMap[t]);
  trace.gap = { found, unfound };
  console.log(`\n=== gap check ===\n  found: ${found.map((f) => f.tissue + "←" + f.comps.join("/")).join(", ") || "(none)"}\n  UNFOUND: ${unfound.join(", ")}`);
  save();

  // ROUTING (selective, GT-blind — predicate over coarse CALLS)
  const recurseMap = {}; // compId -> {tissues:[], hintKeys:[], lookFors:[]}
  for (const tissue of unfound) {
    const rule = ROUTING_RULES[tissue]; if (!rule) continue;
    let chosen = trace.coarse.filter((cc) => rule.intoUmbrella.some((u) => (cc.call.identity || "").toLowerCase().includes(u.toLowerCase()))).map((cc) => cc.compartmentId);
    let rationale;
    if (chosen.length) rationale = `coarse call(s) match umbrella ${JSON.stringify(rule.intoUmbrella)}`;
    else { const big = [...trace.coarse].sort((a, b) => b.nCells - a.nCells)[0]; chosen = big ? [big.compartmentId] : []; rationale = `no umbrella match → fallback: largest coarse compartment (${chosen[0]})`; }
    trace.routing.push({ tissue, ruleUmbrella: rule.intoUmbrella, chosen, rationale, hints: rule.hints, lookFor: rule.lookFor });
    for (const cid of chosen) { const e = (recurseMap[cid] ??= { tissues: [], hintKeys: [], lookFors: [] }); e.tissues.push(tissue); e.hintKeys.push(...rule.hints); if (rule.lookFor) e.lookFors.push(rule.lookFor); }
  }
  console.log(`\n=== routing ===`); trace.routing.forEach((r) => console.log(`  ${r.tissue} → ${r.chosen.join("/")}  (${r.rationale})`));
  save();

  // RECURSION (top-down) — capped
  const allChosen = Object.keys(recurseMap);
  const recurseComps = allChosen.slice(0, RUN_PLAN.maxRecurseCompartments);
  trace.meta.recursionNote = `Routing selected ${allChosen.join(", ")||"none"}; this bounded MVP executed ${recurseComps.join(", ")} (largest ${RUN_PLAN.recurseLeafCap} sub-leaves). Others are recorded in routing, not executed.`;
  console.log(`\n=== selective recursion into ${recurseComps.join(", ")} ===`);
  for (const cid of recurseComps) {
    const c = compById[cid]; const cc = trace.coarse.find((x) => x.compartmentId === cid);
    const umbrella = cc?.call?.identity || "the parent compartment";
    const targets = recurseMap[cid];
    const leaves = c.leafIds.map((id) => ({ id, ...SUB.leaves[id] })).sort((a, b) => b.nCells - a.nCells).slice(0, RUN_PLAN.recurseLeafCap);
    const rec = { compartmentId: cid, umbrella, targetedFor: targets.tissues, hintKeys: [...new Set(targets.hintKeys)], lookFor: targets.lookFors, leaves: [] };
    trace.recursion.push(rec); // push once; append leaves in place + save incrementally
    console.log(`  ${cid} umbrella="${umbrella}" hunting ${targets.tissues.join("/")} across ${leaves.length} leaves`);
    for (const lf of leaves) {
      const res = await labelCluster(clusterObj(lf.id, lf.degsUp, lf.nCells), leafFraming(lf.degsUp, umbrella, targets.hintKeys, targets.lookFors.join("; ")), lf.id);
      rec.leaves.push({ leafId: lf.id, nCells: lf.nCells, markers: lf.degsUp, turns: res.turns, call: res.call, matchedTissue: matchTissue(res.call.identity) });
      save();
    }
  }
  trace.meta.finishedAt = "(stamped post-run)";
  save();
  console.log(`\n=== DONE. trace → ${DIR}/zscape_v2_trace.json ===`);
})();
