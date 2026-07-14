version: judge-v1
last-verified: 2026-07-14
authoritative-file: backend/graphjudge_api/app.py

# Final judge — fuzzy graph distance over the ZFA ontology

Service `:5011`. Scores a `(pred, gt)` pair by resolving BOTH to ZFA nodes and measuring weighted
graph distance on the anatomy ontology. **This is the FIXED MEASURING STICK — it is never tuned to
flatter the labeller.** Both the graph judge and the legacy LLM judge render in the scorecard
(`GraphJudgeScorecard.tsx`, `variant` prop); the graph judge is authoritative.

## Canon
- **Scheme b** — edge weights `part_of = 0.5`, `is_a = 1.0`; `score = 1 / (1 + d_weighted)`;
  directional subsumption (a prediction that names an ANCESTOR of the GT is penalised less than a
  sibling miss).
- **Resolver** — Qwen3-Embedding-0.6B + CL→ZFA ontology bridge, cosine threshold **THR 0.78**. Below
  threshold → unresolved → tier scores n/a (a coverage fact, not a zero).
- Per-tier scoring: each of DN (de-novo) and MX (menu-exposed) is scored at every schema tier against
  the ancestry-derived GT for that tier.

## Known drift
- Six-tier CARO/ZFA GT (path-a ancestry-derived) is used by the **offline MVP** scorecards only; the
  live judge scores the 4-tier schema.

## Changelog
- **v1** — scheme-b weighting (`part_of 0.5` / `is_a 1.0`) + Qwen resolver + THR 0.78 + directional
  subsumption. First durably-recorded graph-judge spec — **not a claim that no prior tuning existed**
  ("scheme b" and the 0.78 threshold came from somewhere; that history isn't on disk to cite).
  → LEDGER #1, #2
