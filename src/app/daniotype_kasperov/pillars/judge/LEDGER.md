# Final judge — improvement ledger (append-only, newest last)

### 1 — Weighted graph distance (scheme b) over string/exact match — [SHIPPED]
· resolve pred+gt to ZFA nodes, weight `part_of 0.5` / `is_a 1.0`, `score = 1/(1+d)`, directional
subsumption · a near-miss up the anatomy tree scores partial credit instead of 0; a sibling miss is
penalised · verdict: canon (judge-v2). do-not-retry: n/a.

### 2 — Qwen3-Embedding resolver + CL→ZFA bridge, THR 0.78 — [SHIPPED]
· embed the free-text label, bridge Cell-Ontology terms into ZFA, accept at cosine ≥ 0.78 · below
threshold the tier is scored **n/a (unresolved)**, never a silent zero — coverage and correctness
stay separate signals · verdict: canon. do-not-retry: n/a.

### 3 — The judge is fixed by contract — [POLICY, not an experiment]
· the measuring stick is NEVER tuned to raise labeller scores; all labelling/merging gains are
measured against THIS unchanged judge · verdict: standing rule. This ledger records resolver/scheme
changes ONLY when independently motivated (e.g. a resolver bug), never to move scores.

### 4 — DN < MX gap is a real quality signal — [VERIFIED]
2026-07-13 · de-novo scores below menu-exposed at matched tiers, paired, across all three datasets +
a separate real coverage asymmetry (DN resolves less often) · verdict: the gap is genuine, not a
scoring artifact — it is what the phrasing work (labelling LEDGER #1) closes. do-not-retry: n/a.
