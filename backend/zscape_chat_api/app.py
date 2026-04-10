#!/usr/bin/env python3
"""
ZSCAPE Chat API  —  Flask SSE backend for the ZSCAPE chat interface.

At startup (fast, ~5s):
  - Load pre-computed Jina v3 cell-type embeddings  (151 × 512)
  - Load pre-computed Jina v3 KO phenotype embeddings (28 × 512)
  - Load complement ground truth (3,747 KO×cell-type entries, 10 categories)
  - Train FullRidge on concatenated [KO_emb | CT_emb] → 10 phenotype scores
  - Load KO descriptions, DE stats, LOKO Pearson scores

On a known-KO query:
  - Look up pre-computed KO embedding → run FullRidge across 151 cell types
  - Return predicted category scores + description + LOKO stats

On a novel-gene query (the interesting case):
  - Lazy-load sentence_transformers + jinaai/jina-embeddings-v3 on first request
    (model downloads once, ~200 MB, caches to ~/.cache/huggingface/)
  - Stream SSE "simulating" status events during the 15-20s model-load window
  - Embed the user's gene description locally → 512-d
  - Run FullRidge across 151 cell types → 10-category predictions
  - Stream results to Claude for final narrative

Usage:
  ANTHROPIC_API_KEY=sk-...  python app.py --port 5002
"""

from __future__ import annotations

import os
import csv
import json
import threading
import argparse
from collections import defaultdict
from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
import numpy as np
from sklearn.linear_model import Ridge
import anthropic

app = Flask(__name__)
CORS(app)

# ── Paths ────────────────────────────────────────────────────────────────────

V4_ROOT = os.environ.get("ZSCAPE_V4_ROOT", "/data/ZSCAPE_complements_v4")

CT_EMB_FILE       = f"{V4_ROOT}/ground_truth/jina_celltype_embeddings.npy"
CT_KEYS_FILE      = f"{V4_ROOT}/ground_truth/jina_celltype_keys.json"
KO_EMB_FILE       = f"{V4_ROOT}/ground_truth/jina_ko_phenotype_embeddings.npy"
KO_NAMES_FILE     = f"{V4_ROOT}/ground_truth/jina_ko_phenotype_names.npy"
GT_FILE           = f"{V4_ROOT}/text_loko/complement_ground_truth.json"
KO_DESC_FILE      = f"{V4_ROOT}/text_loko/ko_descriptions.json"
DE_SUMMARY_FILE   = f"{V4_ROOT}/ground_truth/D_de_summary.csv"
LOKO_RESULTS_FILE = f"{V4_ROOT}/results/jina_ridge.csv"

# ── Constants ─────────────────────────────────────────────────────────────────

SCORE_CATS = [
    "notochord", "somitic_muscle", "nmp_stalling", "neural_crest",
    "cranial_ganglia", "hindbrain_seg", "hedgehog_floor_plate",
    "cardiac_lpm", "pharyngeal_arch", "posterior_axis",
]

# ── Global state ──────────────────────────────────────────────────────────────

CT_EMBEDDINGS: np.ndarray        # (151, 512)
CT_NAMES:      list[str]         # 151 cell type names

KO_EMBEDDINGS: np.ndarray        # (28, 512)
KO_NAMES:      list[str]         # 28 KO names
KO_NAME_TO_IDX: dict[str, int]
CT_NAME_TO_IDX: dict[str, int]

KO_DESCRIPTIONS: dict[str, str]  # canonical → phenotype text
DE_STATS:        dict[str, dict] # ko → {pct_de, mean_lfc, n_comparisons}
LOKO_PEARSON:    dict[str, float]

FULL_RIDGE: Ridge                # trained at startup

GT_N_ENTRIES: int = 0            # number of GT rows used to train Ridge

# Lazy-loaded local Jina model for novel-gene embedding
_JINA_MODEL = None
_JINA_LOCK  = threading.Lock()


# ── Name normalisation ────────────────────────────────────────────────────────

_DESC_KEY_MAP = {
    "tbx16;msgn1":  "tbx16-msgn1",
    "tbx16;tbx16l": "tbx16-tbx16l",
    "cdx4;cdx1a":   "cdx4-cdx1a",
    "tfap2a;foxd3": "tfap2a-foxd3",
    "wnt3a;wnt8a":  "wnt3a-wnt8",
    "foxa2;foxa3":  None,
}

def _canonical(name: str) -> "str | None":
    name = name.strip()
    return _DESC_KEY_MAP.get(name, name)


# ── Data loading ──────────────────────────────────────────────────────────────

def load_data() -> None:
    global CT_EMBEDDINGS, CT_NAMES, CT_NAME_TO_IDX
    global KO_EMBEDDINGS, KO_NAMES, KO_NAME_TO_IDX
    global KO_DESCRIPTIONS, DE_STATS, LOKO_PEARSON
    global FULL_RIDGE, GT_N_ENTRIES

    # Cell-type embeddings
    CT_EMBEDDINGS = np.load(CT_EMB_FILE).astype(np.float32)
    with open(CT_KEYS_FILE) as f:
        CT_NAMES = json.load(f)
    CT_NAME_TO_IDX = {n: i for i, n in enumerate(CT_NAMES)}
    print(f"[zscape_chat] CT embeddings: {CT_EMBEDDINGS.shape}, {len(CT_NAMES)} cell types")

    # KO phenotype embeddings
    KO_EMBEDDINGS = np.load(KO_EMB_FILE).astype(np.float32)
    raw_names     = np.load(KO_NAMES_FILE, allow_pickle=True).tolist()
    KO_NAMES      = [str(n) for n in raw_names]
    KO_NAME_TO_IDX = {n: i for i, n in enumerate(KO_NAMES)}
    print(f"[zscape_chat] KO embeddings: {KO_EMBEDDINGS.shape}, {len(KO_NAMES)} KOs")

    # KO phenotype descriptions
    with open(KO_DESC_FILE) as f:
        raw_desc = json.load(f)
    KO_DESCRIPTIONS = {}
    for raw_key, text in raw_desc.items():
        if text is None:
            continue
        canon = _canonical(raw_key)
        if canon and canon in KO_NAME_TO_IDX:
            KO_DESCRIPTIONS[canon] = text

    # DE stats
    pct_de_acc   = defaultdict(list)
    mean_lfc_acc = defaultdict(list)
    with open(DE_SUMMARY_FILE) as f:
        for row in csv.DictReader(f):
            if row["has_power"] != "True":
                continue
            ko = row["knockout"]
            pct_de_acc[ko].append(float(row["pct_de_genes"]))
            mean_lfc_acc[ko].append(float(row["mean_abs_lfc_sig"]))
    DE_STATS = {}
    for ko in KO_NAMES:
        pcts = pct_de_acc.get(ko, [])
        lfcs = mean_lfc_acc.get(ko, [])
        DE_STATS[ko] = {
            "pct_de":        sum(pcts) / len(pcts) if pcts else None,
            "mean_lfc":      sum(lfcs) / len(lfcs) if lfcs else None,
            "n_comparisons": len(pcts),
        }

    # LOKO Pearson (jina_ridge, ctrl_hvg)
    pearson_acc = defaultdict(list)
    with open(LOKO_RESULTS_FILE) as f:
        for row in csv.DictReader(f):
            if row["model"] == "cdm" and row["gene_set"] == "ctrl_hvg":
                pearson_acc[row["knockout"]].append(float(row["pearson"]))
    LOKO_PEARSON = {ko: sum(v) / len(v) for ko, v in pearson_acc.items()}
    mean_p = sum(LOKO_PEARSON.values()) / max(len(LOKO_PEARSON), 1)
    print(f"[zscape_chat] LOKO Pearson: {len(LOKO_PEARSON)} KOs, mean={mean_p:.3f}")

    # Build FullRidge: X=(N,1024) = [ko_emb | ct_emb], y=(N,10) = category scores
    with open(GT_FILE) as f:
        gt = json.load(f)

    rows_X, rows_y = [], []
    for key, entry in gt.items():
        ko = key.split("__")[0]   # key prefix is the canonical KO name (dashes)
        ct = entry["cell_type"]
        if ko not in KO_NAME_TO_IDX or ct not in CT_NAME_TO_IDX:
            continue
        ko_emb = KO_EMBEDDINGS[KO_NAME_TO_IDX[ko]]
        ct_emb = CT_EMBEDDINGS[CT_NAME_TO_IDX[ct]]
        rows_X.append(np.concatenate([ko_emb, ct_emb]))
        rows_y.append([entry["scores"].get(cat, 0) for cat in SCORE_CATS])

    X = np.array(rows_X, dtype=np.float32)
    y = np.array(rows_y, dtype=np.float32)
    GT_N_ENTRIES = len(X)

    FULL_RIDGE = Ridge(alpha=10.0)
    FULL_RIDGE.fit(X, y)
    print(f"[zscape_chat] FullRidge trained on {GT_N_ENTRIES} rows, "
          f"X={X.shape}, y={y.shape}")


# ── Jina lazy loader ──────────────────────────────────────────────────────────

def _get_jina_model():
    """Lazy-load the local Jina v3 sentence-transformer (thread-safe)."""
    global _JINA_MODEL
    if _JINA_MODEL is not None:
        return _JINA_MODEL
    with _JINA_LOCK:
        if _JINA_MODEL is None:
            from sentence_transformers import SentenceTransformer
            print("[zscape_chat] Loading jinaai/jina-embeddings-v3 locally...")
            _JINA_MODEL = SentenceTransformer(
                "jinaai/jina-embeddings-v3",
                trust_remote_code=True,
                truncate_dim=512,
            )
            print("[zscape_chat] Jina model loaded.")
    return _JINA_MODEL


def embed_text_local(text: str) -> np.ndarray:
    """Embed text with local Jina v3 → (512,) float32."""
    model = _get_jina_model()
    emb = model.encode([text], task="text-matching")[0]
    return np.array(emb, dtype=np.float32)


def _generate_gene_description(query: str) -> "tuple[str, str]":
    """
    Use Claude Haiku to extract the gene name and generate a 3-sentence zebrafish
    knockout phenotype description suitable for embedding.
    Returns (gene_name, description).  Falls back to (\"unknown\", query) on error.
    """
    client = anthropic.Anthropic()
    try:
        resp = client.messages.create(
            model      = "claude-haiku-4-5-20251001",
            max_tokens = 300,
            messages   = [{
                "role":    "user",
                "content": (
                    f'User query: "{query}"\n\n'
                    "Extract the gene name and write a 3-sentence technical description of "
                    "what knockout of that gene in zebrafish would look like, focusing on: "
                    "which developmental cell types are affected, which signalling pathways "
                    "are disrupted, and what tissues show the strongest phenotype. "
                    "Be specific and use zebrafish developmental biology terminology.\n\n"
                    "Reply in this exact format (no extra text):\n"
                    "GENE: <gene_name>\n"
                    "DESCRIPTION: <3-sentence phenotype description>"
                ),
            }],
        )
        text      = resp.content[0].text.strip()
        gene_name = "unknown"
        gene_desc = query
        for line in text.splitlines():
            if line.startswith("GENE:"):
                gene_name = line[5:].strip()
            elif line.startswith("DESCRIPTION:"):
                gene_desc = line[12:].strip()
        print(f"[zscape_chat] Gene={gene_name!r}  desc={gene_desc[:80]}…")
        return gene_name, gene_desc
    except Exception as exc:
        print(f"[zscape_chat] Haiku description failed: {exc}")
        return "unknown", query   # fallback: embed raw user query


# ── Embedding utils ───────────────────────────────────────────────────────────

def _l2_norm(v: np.ndarray) -> np.ndarray:
    return v / (np.linalg.norm(v) + 1e-8)

def cosine_similarities(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    q = _l2_norm(query_vec)
    M = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-8)
    return M @ q

def top_similar_kos(emb: np.ndarray, top_k: int = 3,
                    exclude: "str | None" = None) -> list[dict]:
    sims = cosine_similarities(emb, KO_EMBEDDINGS)
    order = np.argsort(sims)[::-1]
    results = []
    for i in order:
        ko = KO_NAMES[i]
        if ko == exclude:
            continue
        results.append({
            "ko":          ko,
            "similarity":  float(sims[i]),
            "description": KO_DESCRIPTIONS.get(ko),
            "loko_pearson": LOKO_PEARSON.get(ko),
            "de_stats":    DE_STATS.get(ko),
        })
        if len(results) >= top_k:
            break
    return results


# ── FullRidge prediction ──────────────────────────────────────────────────────

def predict_across_celltypes(ko_emb: np.ndarray) -> np.ndarray:
    """
    Given a (512,) KO/gene embedding, predict category scores for all 151 cell types.
    Returns: (151, 10) float array.
    """
    tiled_ko = np.tile(ko_emb, (len(CT_NAMES), 1))          # (151, 512)
    X_all = np.concatenate([tiled_ko, CT_EMBEDDINGS], axis=1) # (151, 1024)
    return FULL_RIDGE.predict(X_all).astype(np.float32)        # (151, 10)


def format_ridge_predictions(preds: np.ndarray, top_per_cat: int = 3) -> str:
    """
    preds: (151, 10) — format into a readable summary for the LLM context.
    """
    lines = []

    # Per-category: top cell types
    lines.append("Predicted phenotype category involvement across 151 cell types:")
    for j, cat in enumerate(SCORE_CATS):
        scores_j = preds[:, j]
        top_idx  = np.argsort(scores_j)[::-1][:top_per_cat]
        top_cts  = [(CT_NAMES[i], float(scores_j[i])) for i in top_idx if scores_j[i] > 0.2]
        if top_cts:
            ct_str = ", ".join(f"{ct} ({s:.2f})" for ct, s in top_cts)
            lines.append(f"  {cat}: {ct_str}")
        else:
            lines.append(f"  {cat}: low signal")

    # Overall most disrupted cell types
    ct_totals = preds.sum(axis=1)  # (151,)
    top5_idx  = np.argsort(ct_totals)[::-1][:5]
    top5_cts  = [(CT_NAMES[i], float(ct_totals[i])) for i in top5_idx]
    lines.append("\nMost disrupted cell types (sum across all categories):")
    lines.append("  " + ", ".join(f"{ct} ({s:.2f})" for ct, s in top5_cts))

    return "\n".join(lines)


# ── KO detection ──────────────────────────────────────────────────────────────

PREDICTION_KEYWORDS = {
    "predict", "prediction", "forecast", "hypothetical",
    "would happen", "knocked out", "knock out", "knockout of",
    "if we ko", "novel gene", "unseen", "new gene", "what if",
}

def is_prediction_query(query: str) -> bool:
    q = query.lower()
    return any(kw in q for kw in PREDICTION_KEYWORDS)

def find_mentioned_kos(query: str) -> list[str]:
    q = query.lower()
    found = []
    for ko in sorted(KO_NAMES, key=len, reverse=True):
        if ko.lower() in q and ko not in found:
            found.append(ko)
    return found


# ── Context retrieval (known KO path) ────────────────────────────────────────

def _format_de_stats(de: "dict | None") -> str:
    if de is None or de.get("pct_de") is None:
        return "no DE stats available"
    return (f"{de['pct_de']:.1%} DE genes, "
            f"mean |LFC| = {de['mean_lfc']:.3f} "
            f"({de['n_comparisons']} powered comparisons)")

def _format_similar(similar: list[dict]) -> str:
    lines = []
    for s in similar:
        loko = f", LOKO Pearson={s['loko_pearson']:.3f}" if s["loko_pearson"] else ""
        desc = s["description"]
        if desc and len(desc) > 120:
            desc = desc[:120] + "…"
        desc = desc or "no description"
        lines.append(f"  - {s['ko']} (cosine sim={s['similarity']:.3f}{loko}): {desc}")
    return "\n".join(lines)

def retrieve_context_known_ko(query: str) -> str:
    mentioned       = find_mentioned_kos(query)
    prediction_mode = is_prediction_query(query)
    lines           = []

    if not mentioned:
        lines.append(f"ZSCAPE dataset: {len(KO_NAMES)} knockouts evaluated by LOKO.")
        lines.append(f"Available KOs: {', '.join(sorted(KO_NAMES))}")
        return "\n".join(lines)

    for ko in mentioned[:2]:
        ko_emb  = KO_EMBEDDINGS[KO_NAME_TO_IDX[ko]]
        similar = top_similar_kos(ko_emb, top_k=3, exclude=ko)
        de      = DE_STATS.get(ko)
        desc    = KO_DESCRIPTIONS.get(ko)
        loko    = LOKO_PEARSON.get(ko)

        lines.append(f"=== {ko.upper()} ===")
        if desc:
            lines.append(f"Phenotype description: {desc}")
        lines.append(f"DE summary: {_format_de_stats(de)}")
        if loko is not None:
            lines.append(
                f"LOKO Pearson (jina_ridge, ctrl-HVG): {loko:.3f}"
            )

        if prediction_mode:
            preds = predict_across_celltypes(ko_emb)
            lines.append("\n" + format_ridge_predictions(preds))

        lines.append(f"\nTop-3 most similar KOs by Jina v3 phenotype embedding:")
        lines.append(_format_similar(similar))
        lines.append("")

    return "\n".join(lines)


# ── Novel-gene context builder ────────────────────────────────────────────────

def build_novel_gene_context(emb: np.ndarray, gene_name: str,
                             gene_description: str) -> str:
    """Build full context for a novel gene given its embedding."""
    lines = [
        f"=== NOVEL GENE SIMULATION: {gene_name.upper()} ===",
        f"(FullRidge trained on {GT_N_ENTRIES} KO×cell-type pairs, 10 phenotype categories)",
        f"\nEmbedded phenotype description:",
        f"  {gene_description}",
    ]

    # Most similar known KOs by embedding similarity
    similar = top_similar_kos(emb, top_k=3)
    lines.append("\nTop-3 most similar known KOs by phenotype embedding similarity:")
    lines.append(_format_similar(similar))

    # FullRidge predictions across 151 cell types
    preds = predict_across_celltypes(emb)
    lines.append("\n" + format_ridge_predictions(preds))

    mean_p = sum(LOKO_PEARSON.values()) / max(len(LOKO_PEARSON), 1)
    lines.append(
        f"\nNote: predictions extrapolate beyond the training distribution for novel genes. "
        f"Ridge baseline mean LOKO Pearson ≈ {mean_p:.3f} (ctrl-HVG, 28 known KOs)."
    )
    return "\n".join(lines)


# ── Simulation SSE helper ─────────────────────────────────────────────────────

def _sim_event(step: int, total: int, message: str) -> str:
    return f"data: {json.dumps({'status': 'simulating', 'step': step, 'total': total, 'message': message})}\n\n"


# ── Claude system prompt ──────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are a scientific assistant with deep expertise in the ZSCAPE dataset — "
    "a large-scale zebrafish (Danio rerio) single-cell CRISPR knockout study covering 28 transcription "
    "factor knockouts across multiple developmental timepoints and 151 cell types.\n\n"
    "You have access to:\n"
    "- Pre-written phenotype descriptions for each of the 28 KOs\n"
    "- Jina v3 text embeddings (512-dim) encoding each KO's phenotype\n"
    "- A FullRidge model (1024-d input = [KO_emb | CT_emb] → 10 phenotype category scores) "
    "trained on 3,747 KO×cell-type pairs from the complement ground truth\n"
    "- Pre-computed LOKO Pearson scores\n\n"
    "The 10 phenotype categories are:\n"
    "  notochord, somitic_muscle, nmp_stalling, neural_crest, cranial_ganglia, "
    "hindbrain_seg, hedgehog_floor_plate, cardiac_lpm, pharyngeal_arch, posterior_axis\n\n"
    "Key concepts:\n"
    "- Category scores (0–2): indicate phenotype disruption strength in each developmental axis\n"
    "- LOKO Pearson: correlation between Ridge-predicted and actual expression deltas "
    "when a KO is held out from training\n"
    "- Cosine similarity: semantic proximity between KO phenotype embeddings\n\n"
    "When answering:\n"
    "- Ground your response in the retrieved data context provided\n"
    "- For novel-gene predictions, clearly distinguish predictions from observed data\n"
    "- Be concise and biologically precise; audience is computational biology researchers\n"
    "- When citing predictions, note they are from a linear Ridge model and may not capture "
    "non-linear biology"
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Jina Ridge prediction for a novel gene.

    Request:  {"gene": "shh", "description": "<optional phenotype text>"}
    Response: {"source": "ridge",
               "scores": [0,0,0,0,0,0,3,0,0,0],   # 10 categories, 0-3
               "nearest_ko": "smo",
               "nearest_sim": 0.87,
               "gene_description": "<haiku-generated description used for embedding>"}
         or:  {"source": "llm_fallback", "error": "<reason>"}  on failure (503)

    Aggregation: max across 151 cell types — surfaces peak signal per category,
    avoids understatement of sparse effects.
    """
    body = request.get_json(force=True)
    gene = (body.get("gene") or "").strip()
    desc = (body.get("description") or "").strip()

    if not gene:
        return {"error": "gene is required"}, 400

    # Generate a proper zebrafish phenotype description for embedding if the
    # caller only passed the gene name (or nothing substantive).
    if not desc or desc.lower() == gene.lower() or len(desc) < 50:
        try:
            _, desc = _generate_gene_description(gene)
        except Exception as exc:
            print(f"[zscape_chat] /api/predict: Haiku description failed: {exc}")
            desc = gene   # fall back to bare gene name

    # Embed
    try:
        emb = embed_text_local(desc)
    except Exception as exc:
        print(f"[zscape_chat] /api/predict: embedding failed: {exc}")
        return {"source": "llm_fallback", "error": f"embedding failed: {exc}"}, 503

    # FullRidge → (151, 10); aggregate with max across cell types
    try:
        preds = predict_across_celltypes(emb)                # (151, 10)
        agg   = preds.max(axis=0)                            # (10,) peak signal
        scores = [int(round(float(np.clip(v, 0, 3)))) for v in agg]
    except Exception as exc:
        print(f"[zscape_chat] /api/predict: Ridge failed: {exc}")
        return {"source": "llm_fallback", "error": f"Ridge failed: {exc}"}, 503

    # Nearest training KO by cosine similarity in phenotype embedding space
    similar = top_similar_kos(emb, top_k=1)
    nearest = similar[0] if similar else None

    return {
        "source":           "ridge",
        "scores":           scores,
        "nearest_ko":       nearest["ko"]           if nearest else None,
        "nearest_sim":      round(nearest["similarity"], 3) if nearest else None,
        "gene_description": desc,
    }


@app.route("/health")
def health():
    return {
        "status":          "ok",
        "kos_loaded":      len(KO_NAMES),
        "celltypes_loaded": len(CT_NAMES),
        "descriptions":    len(KO_DESCRIPTIONS),
        "gt_rows":         GT_N_ENTRIES,
        "jina_model_warm": _JINA_MODEL is not None,
    }


@app.route("/api/chat", methods=["POST"])
def chat():
    body     = request.get_json(force=True)
    messages: list[dict] = body.get("messages", [])
    if not messages:
        return {"error": "messages array is required"}, 400

    latest_user = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )

    mentioned  = find_mentioned_kos(latest_user)
    is_novel   = is_prediction_query(latest_user) and not mentioned
    model_warm = _JINA_MODEL is not None

    def generate():
        # ── Novel-gene path: stream simulation status events ─────────────────
        if is_novel:
            total_steps = 4
            yield _sim_event(1, total_steps, "Generating zebrafish phenotype description via Haiku…")

            gene_name, gene_desc = _generate_gene_description(latest_user)

            if not model_warm:
                yield _sim_event(2, total_steps, f"{gene_name.upper()} described — loading embedding model (one-time, ~15s)…")
            else:
                yield _sim_event(2, total_steps, f"{gene_name.upper()} described — encoding to 512-dim phenotype space…")

            emb = embed_text_local(gene_desc)   # embed the phenotype description, not the raw query

            yield _sim_event(3, total_steps, f"Running Ridge across {len(CT_NAMES)} cell-type contexts…")

            preds = predict_across_celltypes(emb)

            yield _sim_event(4, total_steps, "Scoring 10 phenotype categories…")

            context = build_novel_gene_context(emb, gene_name, gene_desc)

        # ── Known-KO path: no simulation delay ──────────────────────────────
        else:
            context = retrieve_context_known_ko(latest_user)

        system = SYSTEM_PROMPT + f"\n\n<zscape_context>\n{context}\n</zscape_context>"
        client = anthropic.Anthropic()

        try:
            with client.messages.stream(
                model    = "claude-sonnet-4-6",
                max_tokens = 1024,
                system   = system,
                messages = messages,
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port",    type=int, default=5002)
    parser.add_argument("--v4-root", default=V4_ROOT, dest="v4_root")
    args = parser.parse_args()

    V4_ROOT           = args.v4_root
    CT_EMB_FILE       = f"{V4_ROOT}/ground_truth/jina_celltype_embeddings.npy"
    CT_KEYS_FILE      = f"{V4_ROOT}/ground_truth/jina_celltype_keys.json"
    KO_EMB_FILE       = f"{V4_ROOT}/ground_truth/jina_ko_phenotype_embeddings.npy"
    KO_NAMES_FILE     = f"{V4_ROOT}/ground_truth/jina_ko_phenotype_names.npy"
    GT_FILE           = f"{V4_ROOT}/text_loko/complement_ground_truth.json"
    KO_DESC_FILE      = f"{V4_ROOT}/text_loko/ko_descriptions.json"
    DE_SUMMARY_FILE   = f"{V4_ROOT}/ground_truth/D_de_summary.csv"
    LOKO_RESULTS_FILE = f"{V4_ROOT}/results/jina_ridge.csv"

    load_data()
    app.run(host="0.0.0.0", port=args.port, threaded=True)
