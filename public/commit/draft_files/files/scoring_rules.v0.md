# Scoring rules — DRAFT v0

Status: **draft, not yet agreed.** It turns the rule stated on zeroshot.bio/commit into something
that can be computed. The reference implementation is `commit_lib.score` in our repository. Anything
marked *Decision* is a choice we made that you can challenge before the run.

## What is scored

- **112 clusters**, `C001`–`C112`. Each one is scored on its own.
- **Excluded:** the 26 clusters listed in `excluded_clusters.csv`. They were dropped upstream, have no
  cells in the matrix and are never scored.
- **Scored separately:** 31 clusters are marked `scored_ambiguous`, meaning the reviewers could not
  settle the call from the evidence. They are scored, and every number is reported three ways: all
  112, the 81 clean clusters, and the 31 ambiguous ones. (The /commit page already states the 31.)

## One answer per cluster

Your `zfa_id` for the cluster is compared with the key's **primary** term for that cluster and its
**accepted alternatives**. Both sides draw only from `zfa_menu.v1` (hash `dec9f728…`). An id that is
not on the menu, or a missing answer, scores zero.

"Ancestor" and "contained in" mean the `is_a` ∪ `part_of` closure in the pinned ZFA release
(`sources.v0.json`). A term is a **cell type** if it is `ZFA:0009000` (cell) or descends from it
through `is_a`. Every other term is a **structure**. The `kind` field in the menu records this.

| outcome | when |
|---|---|
| **full (1.0)** | Your id is the key's primary term or one of its accepted alternatives. **Or** the key's primary is a structure and your id is a cell type contained in it: the key's term is an ancestor of yours. |
| **half (0.5)** | The key's primary is a cell type and your id is the **region containing it**: the key's anatomy term for that cluster, or that term's direct parent. |
| **zero (0)** | Everything else: null, off-menu, a broader or narrower cell type, a sibling, an unrelated term. |

*Decision: "the region containing it" is the key's own anatomy term, or at most one level above
it. It is not any ontology ancestor of the cell type.* Every cell type sits under *whole organism*.
Under the looser reading, answering *whole organism* for every cluster would earn half credit on
every cluster whose key answer is a cell type. Under this rule, no blanket answer earns more than a
few percent of the credit.

*Decision: accepted alternatives are narrow.* A term is accepted only if a reviewer proposed it on
the primary's axis, it is backed by a human annotator or by two different model families, and it
is not an ancestor of the primary. The key marks which clusters have alternatives.

## What is reported

1. **Graded score:** the mean credit over the scored clusters.
2. **Strict exact-match accuracy:** your id equals the key's primary. No alternatives, no
   containment. This is always reported next to the graded score.
3. Both numbers are given for all 112, the 81 clean clusters and the 31 ambiguous ones.
4. How many answers are off-menu or missing.

## Known open points

- **Full credit for "more precise than the key" is often out of reach.** ZFA links few cell types
  to the regions that contain them. Where it records none inside the key's region, the clause
  cannot apply.
- **Retreating to a broader cell type scores zero, while retreating to the region scores half.**
  In other words, the parent cell type of the key's answer earns nothing, while the key's anatomy
  term earns half. The page states it this way. Confirm that this ordering is intended.
- **Evidence is not scored yet.** Citations and the evidence statement are checked for being
  present and well-formed (`validate_submission.py`), but they don't change the number.
