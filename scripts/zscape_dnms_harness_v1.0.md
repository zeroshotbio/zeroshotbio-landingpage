# ZSCAPE De-Novo & Menu-Select Harness v1.0 — instruction set (REVIEW DRAFT, not applied)

Status: **spec only.** Nothing run, nothing spent, nothing written to the registry, `:5008`,
`canonical_runs.json`, or `dataset_facts.json`. This is a two-phase variant of the validated
de-leaked tri-personality flow (Researcher → Archivist → Reasoner).

---

## 0. Harness identity (registry entry — proposed, NOT written)

A NEW harness id, parallel to v1.1 — does not overwrite or supersede it.

```json
{
  "id": "zscape-dnms/v1.0",
  "name": "ZSCAPE De-Novo & Menu-Select",
  "version": "1.0",
  "basis": "de-leaked tri-personality flow (Researcher x2 -> Archivist -> Reasoner), prompt label = 'Cluster {id}'",
  "supersedes": null,
  "parallelTo": "v1.1",
  "gitCommit": "<stamp at build time>",
  "model": "gpt-5.5",
  "phases": [
    "phase1 denovo  — open-vocab, markers only, NO menu / NO GT vocabulary",
    "phase2 menuSelect — closed-vocab, maps the FROZEN denovo call to the full ZSCAPE menu"
  ],
  "menu": { "dataset": "zscape_native", "entries": 156, "sha256_16": "24c0b8727aa7728f",
            "source": "deduplicated GT cell_type_sub labels, sorted, identical for every cluster" },
  "scoreChannels": {
    "menuSelect": "exact-string menuLabel vs GT cell_type_sub (in-vocab, NO semantic judge)",
    "deNovo": "open-vocab capability / disagreement analysis (separate; never blended)"
  }
}
```

---

## 1. Why two phases (the two numbers, kept distinct)

- **Phase 1 (de novo)** measures *unconstrained capability*: given only markers, what does the
  model call the cluster, open-vocabulary, with zero knowledge of the published label set? This is
  the honest "can it identify cells" signal. It is **never** scored by exact match (open vocab).
- **Phase 2 (menu-select)** measures *schema-mapping under a closed vocabulary*: given its own
  frozen de novo call + the full published ZSCAPE label space, can it pick the exact published
  label? This **is** exact-match scorable, in-vocab, no semantic judge.

These are two different questions and **two different numbers. Never blend them.** The menu-select
number is a *constrained-classification* accuracy, NOT an open-vocab capability claim — report it as
such.

### Menu-select is NOT the leak we just fixed — state this explicitly
The c4d306-era leak put **this cluster's specific answer** into the opening prompt. The menu is the
**complete 156-entry label space, identical for every cluster** — it gives the model the *class
list*, not the *per-cluster answer*. That is standard closed-set classification (one of N), and N=156
here (1:1 sub vocabulary), so it is genuinely hard. The firewall (§6) guarantees the menu never
contaminates phase 1, so the de novo signal stays leak-free.

---

## 2. Flow

```
 PHASE 1 — DE NOVO (open vocab, markers only, label="Cluster {id}")     [identical to de-leaked QC]
   R1  default_prompt(cluster)            -> proposer read
   R2  second_opinion_prompt(cluster)     -> alternative-hypothesis read
   A   archivist_prompt(cluster)          -> raw :5007 DEG stats verification
   RZ  AUTO_REASON_PROMPT x rounds (+ NUDGE), dispatch follow-ups -> kasperov-conclude
   C   get_confidence(...)                -> per-tier prediction+pct
        |
        v
 == FREEZE ==  persist deNovoLabel + deNovoState + deNovoConfidence + phase1 transcript.
               IMMUTABLE. Build the menu only AFTER this point.
        |
        v
 PHASE 2 — MENU-SELECT (closed vocab)
   M   PHASE2_MENU_SELECT_PROMPT  (frozen denovo call + phase1 marker evidence + FULL menu)
        -> kasperov-menu { menuLabel | NO_MATCH, abstain, why }
        |
        v
 == LOG ==  persist menuLabel + menuAbstain + menuWhy + phase2 turn. Roll coarser tiers up
            from the picked sub entry's GT tier mapping.
```

Phase 2 is a **single additional Reasoner turn appended to the phase-1 conversation** (so "the
marker evidence already in context" is literally the phase-1 `conv`). It MAPS the frozen call; it
does NOT re-run R1/R2/A and does NOT revise the de novo identity.

---

## 3. Phase-1 prompt templates (VERBATIM from the de-leaked flow — unchanged)

Reused exactly as in `backend/daniotype_autopilot_api/app.py` (de-leaked: `cluster["label"] = "Cluster {id}"`).

**R1 — default_prompt(c):**
```
Cluster {id}'s top up-regulated markers are: {top8_degsUp}. Using ZFIN curated expression,
ZFA anatomy, and GO, identify the most likely zebrafish cell type (with state if the markers
support it), grounding each claim in a cited record. If the evidence is ambiguous, say so.
```

**R2 — second_opinion_prompt(c):**
```
Independent second opinion for Cluster {id}. Its top up-regulated markers are: {top8_degsUp}.
Assume NO prior conclusion. Name at least one ALTERNATIVE cell-type hypothesis besides the most
obvious one and weigh them against each other using ZFIN curated expression, ZFA anatomy, and GO,
citing a record for each claim. If the markers are ambiguous between identities, say which and why,
and which tier (germ layer / tissue / cell type) is the deepest you can defend.
```

**A — archivist_prompt(c):**
```
Pull this cluster's raw DEG stats for its top markers ({top6}): exact log2FC, %in/out,
BH-adjusted p-value, and cross-cluster specificity. Return the full per-gene table so we can
confirm which are the strongest, most specific markers.
```

**RZ — AUTO_REASON_PROMPT** (archivist-aware reconcile → `kasperov-conclude` or `kasperov-dispatch`)
and **AUTO_NUDGE_PROMPT** — verbatim as in app.py. Conclusion is a `kasperov-conclude` block:
`{ "identity": "...", "state": "...", "decision": "assign|abstain", "cited_markers": [...] }`.

**C — get_confidence(...)** → `{ germ_layer:{prediction,pct}, tissue:{…}, cell_type_broad:{…},
cell_type_sub:{…}, why }`.

> HARD RULE: none of the phase-1 prompts, the dispatched follow-ups, the archivist payload, or the
> confidence call may contain the menu or ANY GT vocabulary token. Phase 1 is open-vocab.

`deNovoLabel = conclude.identity`, `deNovoState = conclude.state`,
`deNovoDecision = conclude.decision`, `deNovoConfidence = the get_confidence tiers`.

---

## 4. Freeze + log (between phases)

Persist, immutably, BEFORE the menu is built or phase 2 runs:
```json
"deNovo": {
  "label": "<conclude.identity>",
  "state": "<conclude.state>",
  "decision": "assign|abstain",
  "confidence": { "germ_layer": {...}, "tissue": {...}, "cell_type_broad": {...}, "cell_type_sub": {...} },
  "citedMarkers": [...],
  "frozenAt": "<iso8601>"
}
```
This is the permanent unconstrained-capability signal and MUST survive untouched — phase 2 reads it
but never overwrites it.

---

## 5. Phase-2 menu build + prompt (NEW)

**Menu build (once per run, AFTER freeze):**
```
menu = sorted(set( gt.clusters[*].cell_type_sub.label ))   # zscape_native/groundtruth.json
# -> 156 entries, sha256_16 = 24c0b8727aa7728f. SAME list for EVERY cluster. Never a per-cluster subset.
```
Persist `menuVersion = sha256_16` on every run so scoring knows the exact vocabulary used.

**PHASE2_MENU_SELECT_PROMPT** (appended as one Reasoner-`menu` turn to the phase-1 conv):
```
You have already committed a FINAL de novo identity for this cluster, recorded and frozen:

    de novo call : "{deNovo.label}"  (state: {deNovo.state})
    tier reads   : germ {germ.pct}% / tissue {tissue.pct}% / broad {broad.pct}% / sub {sub.pct}%

That call is FINAL — do NOT change it, re-derive it, or second-guess it here.

Your ONLY task now is to MAP that frozen call onto the published ZSCAPE schema. Below is the
COMPLETE ZSCAPE cell-type vocabulary — the identical full list used for every cluster, not a
shortlist chosen for this one. Using your frozen call and the marker evidence already established
above, choose the SINGLE entry that best matches.

ZSCAPE cell-type menu (choose exactly one by its exact text, or abstain):
  1. KA neuron
  2. NaK ionocyte
  ...
  156. <last entry>

Rules:
- Return the EXACT text of one menu entry, OR "NO_MATCH" if no entry is a defensible match for your
  frozen de novo call. Do not force a poor fit — "no good match" is a valid, informative answer
  (it flags a gap between your call and the published schema).
- You are MAPPING an existing conclusion to its closest schema label, NOT identifying the cluster
  again. Do not let the menu change your biological judgment.
- Cite, in one or two lines, which features of your de novo call + markers drive the pick.

Respond with a kasperov-menu block:
```kasperov-menu
{ "menuLabel": "<exact menu text or NO_MATCH>", "abstain": <true|false>, "why": "<short>" }
```
```

**Validation:** `menuLabel` must be an exact member of `menu` (or `NO_MATCH`). If the model returns
a near-miss/paraphrase, re-prompt once ("return the EXACT menu text"); a second failure → record as
`abstain=true, menuLabel=NO_MATCH, why="invalid menu return"`. No semantic coercion.

---

## 6. Run-log schema (per cluster) + firewall

```json
{
  "id": "<cluster id>",
  "promptLabel": "Cluster <id>",
  "deNovo": { ... see §4 ... },                       // FROZEN, immutable
  "menu": {
    "menuVersion": "24c0b8727aa7728f",
    "menuLabel": "<exact entry | NO_MATCH>",
    "abstain": false,
    "why": "<short mapping rationale>",
    "rolledTiers": { "cell_type_sub": "<menuLabel>", "cell_type_broad": "<rollup>",
                     "tissue": "<rollup>", "germ_layer": "<rollup>" }   // null when abstain
  },
  "transcript": [ ...phase1 conv..., {phase2 menu turn} ]
}
```

**FIREWALL (hard rules):**
1. The menu (and any GT-vocabulary token) MUST NOT appear in any phase-1 message, dispatch, archivist
   payload, or confidence call. Build the menu only after the freeze.
2. `deNovo` is written before the menu exists and is never mutated by phase 2.
3. The menu is the FULL 156-entry list, identical for every cluster — never a per-cluster shortlist.
4. Phase 2 maps; it does not re-litigate. The de novo identity is fixed input, not a revisable draft.

---

## 7. Scoring (SPEC ONLY — not run)

Two channels, **kept distinct, never blended**:

**(A) Menu-select accuracy — the in-vocab number.**
- `menuLabel == GT.cell_type_sub.label`  → exact string match. NO semantic judge.
- Coarser tiers roll up from the PICKED sub entry via the GT sub→tier map
  (e.g. `periderm 4` → broad `periderm`, tissue `Epidermis`, germ `ectoderm`); score broad/tissue/germ
  by exact match of the rolled-up value vs GT at that tier. Roll-up is from the chosen entry, not a
  separate prediction.
- `abstain` (NO_MATCH) is its own bucket = **schema-gap signal**, reported separately. Headline pair:
  `exact = matched / (total − abstained)` AND `coverage = (total − abstained) / total`, both shown.
  Also report all-clusters `matched / total` (abstain counted non-correct). Label it
  **"menu-select (closed-vocab, N=156)"** — never present it as open-vocab capability.

**(B) De novo — the open-vocab signal.** `deNovoLabel` is retained for a SEPARATE analysis:
open-vocab quality (semantic judge or manual) and **de novo ↔ menu disagreement** (where the frozen
call and the mapped label diverge, and where menu abstains while de novo was confident = schema gaps).
This number is never mixed into (A).

---

## 8. What is intentionally NOT in this draft
- No registry write, no `_active_harness` change — the stamp in §0 is proposed text only.
- No driver code committed; this is the instruction set. A driver would reuse the de-leaked
  `run_one_cluster` for phase 1, add a `run_menu_select(conv, deNovo, menu)` turn for phase 2, and
  store under a QC/eval id — never touching `:5008`, `canonical_runs.json`, or `dataset_facts.json`.
- Nothing run, nothing spent. Next step on approval: a ~$5 randomized sample (same seed discipline).
```
