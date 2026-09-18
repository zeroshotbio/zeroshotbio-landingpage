# Submission format — DRAFT v0

A submission is two files:

- `rubric.json`: your confidence rubric, declared once before the run.
- `answers.jsonl`: one JSON object per line, one line for each of the 112 clusters.

Check both with `python validate_submission.py rubric.json answers.jsonl`. It needs only Python 3
and `zfa_menu.v1.enriched.json`. A submission that fails validation is not scored.

## rubric.json

```json
{
  "tiers": ["high", "medium", "low"],
  "signals": ["marker_coherence", "reference_corroboration", "ontology_convergence"],
  "description": "how the signals combine into the score, and where the tier boundaries fall"
}
```

## answers.jsonl, one line per cluster

```json
{
  "cluster_id": "C001",
  "zfa_id": "ZFA:0000516",
  "identity_zfa_id": null,
  "anatomy_zfa_id": "ZFA:0000516",
  "ancestor_chain": ["ZFA:0000516", "ZFA:…", "…", "ZFA:0100000"],
  "confidence": {"score": 0.62, "tier": "medium",
                 "signals": {"marker_coherence": 0.7, "reference_corroboration": 0.5, "ontology_convergence": 0.66}},
  "references": [{"key": "r1", "source": "ZFIN wild-type expression", "id": "ZDB-PUB-…", "detail": "gene X in term Y at Long-pec"}],
  "evidence": "Top markers … are expressed in … at 48 hpf [r1]."
}
```

## Rules the validator checks

1. Every cluster `C001`–`C112` appears exactly once.
2. `zfa_id` is on the menu. It is required: the committed pick cannot be null.
3. `identity_zfa_id` is a menu cell type or `null`. `anatomy_zfa_id` is a menu structure or `null`.
4. `ancestor_chain` starts at `zfa_id`, and each next id is a direct `is_a` or `part_of` parent of
   the one before it. It ends at a root, meaning a term with no parents. Where there are several
   paths, any one is valid.
5. `confidence.score` is a number from 0 to 1. `confidence.tier` is one of the rubric's tiers.
   `confidence.signals` uses only the rubric's signal names, and every value is a number.
6. `references` is a non-empty list, and every item has `key`, `source` and `id`.
7. `evidence` is a non-empty statement. It cites at least one reference as `[key]` and cites no
   key that is missing from `references`.
