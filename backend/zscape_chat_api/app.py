#!/usr/bin/env python3
"""
ZSCAPE Chat API  —  Flask SSE backend for the ZSCAPE chat interface.

At startup:
  - Loads pre-computed Jina v5 phenotype embeddings (28 × 512) for the known KOs
  - Loads 25 plain-text KO phenotype descriptions
  - Aggregates DE summary stats per KO from the ZSCAPE CSV files
  - Trains a lightweight SummaryRidge (PCA-10 → Ridge) to predict
    [pct_de, mean_lfc] for novel / unseen genes
  - Pre-indexes LOKO Pearson scores from jina_ridge.csv (ctrl_hvg gene set)

At query time:
  - Detects KO mentions and prediction intent
  - For known KOs  → cosine similarity lookup, pulls description + LOKO stats
  - For novel genes → calls Jina REST API to embed, runs SummaryRidge, reports
    top similar KOs as analogues
  - Passes the assembled context to Claude and streams the response via SSE

Usage:
  ANTHROPIC_API_KEY=sk-...  [JINA_API_KEY=jina_...]  python app.py --port 5002
"""

from __future__ import annotations

import os
import csv
import json
import argparse
import urllib.request
from collections import defaultdict
from typing import Optional
from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
import numpy as np
from sklearn.decomposition import PCA
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
import anthropic

app = Flask(__name__)
CORS(app)

# ── Paths ───────────────────────────────────────────────────────────────────

DATA_DIR = os.environ.get("ZSCAPE_DATA_DIR", "/data/ZSCAPE_complements_v3/data")
V4_ROOT  = "/data/ZSCAPE_complements_v4"

PHENOTYPE_EMB_FILE   = f"{V4_ROOT}/ground_truth/jina_ko_phenotype_embeddings.npy"
PHENOTYPE_NAMES_FILE = f"{V4_ROOT}/ground_truth/jina_ko_phenotype_names.npy"
KO_DESC_FILE         = f"{V4_ROOT}/text_loko/ko_descriptions.json"
LOKO_RESULTS_FILE    = f"{V4_ROOT}/results/jina_ridge.csv"

# ── Global state ────────────────────────────────────────────────────────────

# Loaded at startup
KO_EMBEDDINGS:   np.ndarray          # (28, 512) Jina phenotype embeddings
KO_NAMES:        list[str]           # 28 canonical KO names (same order as embeddings)
KO_DESCRIPTIONS: dict[str, str]      # canonical_name → phenotype description text
DE_STATS:        dict[str, dict]     # ko → {pct_de, mean_lfc, n_comparisons}
LOKO_PEARSON:    dict[str, float]    # ko → mean LOKO Pearson (jina_ridge, ctrl_hvg)

# Trained at startup
SUMMARY_PCA:     PCA
SUMMARY_SCALER:  StandardScaler
SUMMARY_RIDGE:   Ridge               # predicts [pct_de, mean_lfc] from PCA-reduced embedding
SUMMARY_TARGETS: np.ndarray          # (28, 2) ground-truth [pct_de, mean_lfc]


# ── Name normalisation ───────────────────────────────────────────────────────

# ko_descriptions.json uses semicolons; ZSCAPE uses hyphens
_DESC_KEY_MAP = {
    "tbx16;msgn1":   "tbx16-msgn1",
    "tbx16;tbx16l":  "tbx16-tbx16l",
    "cdx4;cdx1a":    "cdx4-cdx1a",
    "tfap2a;foxd3":  "tfap2a-foxd3",
    "wnt3a;wnt8a":   "wnt3a-wnt8",
    "foxa2;foxa3":   None,           # not in the 28 ZSCAPE KOs
}

def _canonical(name: str) -> "str | None":
    """Return the canonical ZSCAPE KO name, or None if not mappable."""
    name = name.strip()
    return _DESC_KEY_MAP.get(name, name)


# ── Data loading ─────────────────────────────────────────────────────────────

def load_data() -> None:
    global KO_EMBEDDINGS, KO_NAMES, KO_DESCRIPTIONS, DE_STATS, LOKO_PEARSON
    global SUMMARY_PCA, SUMMARY_SCALER, SUMMARY_RIDGE, SUMMARY_TARGETS

    # ── Jina phenotype embeddings ───────────────────────────────────────────
    KO_EMBEDDINGS = np.load(PHENOTYPE_EMB_FILE).astype(np.float32)          # (28, 512)
    raw_names     = np.load(PHENOTYPE_NAMES_FILE, allow_pickle=True).tolist()
    KO_NAMES      = [str(n) for n in raw_names]
    print(f"[zscape_chat] Jina embeddings: {KO_EMBEDDINGS.shape}, {len(KO_NAMES)} KOs")

    # ── Phenotype descriptions ──────────────────────────────────────────────
    with open(KO_DESC_FILE) as f:
        raw_desc = json.load(f)

    KO_DESCRIPTIONS = {}
    for raw_key, text in raw_desc.items():
        if text is None:
            continue
        canon = _canonical(raw_key)
        if canon and canon in KO_NAMES:
            KO_DESCRIPTIONS[canon] = text
    print(f"[zscape_chat] Descriptions loaded: {len(KO_DESCRIPTIONS)} / {len(KO_NAMES)}")

    # ── DE summary stats per KO ─────────────────────────────────────────────
    pct_de_acc  = defaultdict(list)
    mean_lfc_acc = defaultdict(list)
    with open(f"{DATA_DIR}/D_de_summary.csv") as f:
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
            "pct_de":         sum(pcts) / len(pcts) if pcts else None,
            "mean_lfc":       sum(lfcs) / len(lfcs) if lfcs else None,
            "n_comparisons":  len(pcts),
        }

    # ── LOKO Pearson scores (jina_ridge, ctrl_hvg) ─────────────────────────
    pearson_acc = defaultdict(list)
    with open(LOKO_RESULTS_FILE) as f:
        for row in csv.DictReader(f):
            if row["model"] == "jina_ridge" and row["gene_set"] == "ctrl_hvg":
                pearson_acc[row["knockout"]].append(float(row["pearson"]))

    LOKO_PEARSON = {
        ko: sum(v) / len(v)
        for ko, v in pearson_acc.items()
    }
    print(f"[zscape_chat] LOKO Pearson loaded for {len(LOKO_PEARSON)} KOs, "
          f"mean = {sum(LOKO_PEARSON.values()) / len(LOKO_PEARSON):.3f}")

    # ── Train SummaryRidge at startup ───────────────────────────────────────
    # Build target matrix: [pct_de, mean_lfc] for each KO (in KO_NAMES order)
    targets = []
    valid_mask = []
    for ko in KO_NAMES:
        s = DE_STATS[ko]
        if s["pct_de"] is not None and s["mean_lfc"] is not None:
            targets.append([s["pct_de"], s["mean_lfc"]])
            valid_mask.append(True)
        else:
            targets.append([0.0, 0.0])
            valid_mask.append(False)

    SUMMARY_TARGETS = np.array(targets, dtype=np.float32)

    # PCA: 28 × 512 → 28 × 10 (reduce dimensionality before Ridge)
    SUMMARY_PCA = PCA(n_components=10)
    X_pca = SUMMARY_PCA.fit_transform(KO_EMBEDDINGS)   # (28, 10)

    SUMMARY_SCALER = StandardScaler()
    X_sc = SUMMARY_SCALER.fit_transform(X_pca)          # (28, 10)

    # Train Ridge on all 28 points (used for novel gene extrapolation)
    SUMMARY_RIDGE = Ridge(alpha=10.0)
    SUMMARY_RIDGE.fit(X_sc, SUMMARY_TARGETS)

    # LOO validation to report expected accuracy
    loo_errors = []
    for i in range(len(KO_NAMES)):
        if not valid_mask[i]:
            continue
        mask = np.ones(len(KO_NAMES), dtype=bool)
        mask[i] = False
        r = Ridge(alpha=10.0)
        r.fit(X_sc[mask], SUMMARY_TARGETS[mask])
        pred = r.predict(X_sc[i:i+1])[0]
        loo_errors.append(np.abs(pred - SUMMARY_TARGETS[i]))

    loo_errors = np.array(loo_errors)
    print(f"[zscape_chat] SummaryRidge LOO MAE — "
          f"pct_de={loo_errors[:, 0].mean():.3f}, "
          f"mean_lfc={loo_errors[:, 1].mean():.4f}")


# ── Embedding utils ──────────────────────────────────────────────────────────

def _l2_norm(v: np.ndarray) -> np.ndarray:
    return v / (np.linalg.norm(v) + 1e-8)

def cosine_similarities(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """(D,), (N, D) → (N,) cosine similarities."""
    q = _l2_norm(query_vec)
    M = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-8)
    return M @ q

def embed_text_jina(text: str) -> np.ndarray | None:
    """
    Call Jina REST API to embed text (jina-embeddings-v3, 512-dim).
    Returns (512,) float32 or None if JINA_API_KEY is not set / call fails.
    """
    api_key = os.environ.get("JINA_API_KEY", "")
    if not api_key:
        return None

    payload = json.dumps({
        "input": [text],
        "model": "jina-embeddings-v3",
        "dimensions": 512,
        "task": "text-matching",
    }).encode()

    req = urllib.request.Request(
        "https://api.jina.ai/v1/embeddings",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return np.array(data["data"][0]["embedding"], dtype=np.float32)
    except Exception as exc:
        print(f"[zscape_chat] Jina API error: {exc}")
        return None

def run_summary_ridge(emb: np.ndarray) -> dict:
    """
    Run SummaryRidge on a (512,) embedding.
    Returns {'pct_de': float, 'mean_lfc': float}.
    """
    x_pca = SUMMARY_PCA.transform(emb.reshape(1, -1))
    x_sc  = SUMMARY_SCALER.transform(x_pca)
    pred  = SUMMARY_RIDGE.predict(x_sc)[0]
    return {"pct_de": float(pred[0]), "mean_lfc": float(pred[1])}


# ── KO detection ─────────────────────────────────────────────────────────────

PREDICTION_KEYWORDS = {
    "predict", "prediction", "forecast", "hypothetical",
    "would happen", "knocked out", "knock out", "knockout of",
    "if we ko", "novel gene", "unseen", "new gene",
}

def is_prediction_query(query: str) -> bool:
    q = query.lower()
    return any(kw in q for kw in PREDICTION_KEYWORDS)

def find_mentioned_kos(query: str) -> list[str]:
    """Return canonical KO names mentioned in the query (longest match first)."""
    q = query.lower()
    found = []
    for ko in sorted(KO_NAMES, key=len, reverse=True):
        if ko.lower() in q and ko not in found:
            found.append(ko)
    return found

def top_similar_kos(emb: np.ndarray, top_k: int = 3, exclude: str | None = None) -> list[dict]:
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


# ── Context retrieval ─────────────────────────────────────────────────────────

def _format_de_stats(de: dict | None) -> str:
    if de is None or de.get("pct_de") is None:
        return "no DE stats available"
    return (f"{de['pct_de']:.1%} DE genes, "
            f"mean |LFC| = {de['mean_lfc']:.3f} "
            f"({de['n_comparisons']} powered comparisons)")

def _format_similar(similar: list[dict]) -> str:
    lines = []
    for s in similar:
        loko = f", LOKO Pearson={s['loko_pearson']:.3f}" if s['loko_pearson'] else ""
        desc = s['description'][:120] + "…" if s['description'] and len(s['description']) > 120 else (s['description'] or "no description")
        lines.append(
            f"  - {s['ko']} (cosine sim={s['similarity']:.3f}{loko}): {desc}"
        )
    return "\n".join(lines)

def retrieve_context(query: str) -> str:
    mentioned = find_mentioned_kos(query)
    prediction_mode = is_prediction_query(query)
    lines = []

    if prediction_mode and not mentioned:
        # Novel gene prediction: try to embed the query itself
        lines.append("=== NOVEL GENE PREDICTION MODE ===")
        emb = embed_text_jina(query)
        if emb is not None:
            ridge_pred = run_summary_ridge(emb)
            similar    = top_similar_kos(emb, top_k=3)
            lines.append(
                f"Jina v5 embedding retrieved. "
                f"SummaryRidge prediction (trained on 28 known KOs, LOO-validated):\n"
                f"  Predicted % DE genes: {ridge_pred['pct_de']:.1%}\n"
                f"  Predicted mean |LFC|: {ridge_pred['mean_lfc']:.3f}"
            )
            lines.append(f"\nMost similar known KOs by embedding similarity:")
            lines.append(_format_similar(similar))
            lines.append(
                f"\nNote: mean LOKO Pearson for jina_ridge baseline across 28 KOs = 0.385 "
                f"(ctrl-HVG gene set). Predictions for truly novel genes extrapolate beyond "
                f"the training distribution."
            )
        else:
            lines.append(
                "JINA_API_KEY not set — embedding novel genes requires the Jina REST API. "
                "Falling back to dataset overview."
            )
            ko_list = ", ".join(KO_NAMES[:20]) + "…"
            lines.append(f"Known KOs: {ko_list}")
        return "\n".join(lines)

    if not mentioned:
        # General exploration: return dataset overview
        lines.append(f"ZSCAPE dataset: {len(KO_NAMES)} knockouts, each held out in LOKO evaluation.")
        lines.append(f"Available KOs: {', '.join(sorted(KO_NAMES))}")
        if prediction_mode:
            lines.append(
                "To make a prediction for a novel gene, set JINA_API_KEY and describe the gene in your query."
            )
        return "\n".join(lines)

    # ── Known KO(s) ─────────────────────────────────────────────────────────
    for ko in mentioned[:2]:
        ko_emb  = KO_EMBEDDINGS[KO_NAMES.index(ko)]
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
                f"LOKO Pearson (jina_ridge, ctrl-HVG): {loko:.3f} — this is how well "
                f"Ridge regression predicted this KO's expression deltas when held out."
            )

        if prediction_mode:
            # Also run SummaryRidge on this KO's own embedding as a sanity check
            ridge_pred = run_summary_ridge(ko_emb)
            lines.append(
                f"SummaryRidge prediction from embedding: "
                f"pct_de={ridge_pred['pct_de']:.1%}, mean_lfc={ridge_pred['mean_lfc']:.3f} "
                f"(actual: pct_de={de['pct_de']:.1%}, mean_lfc={de['mean_lfc']:.3f})"
                if de and de.get("pct_de") else
                f"SummaryRidge prediction: pct_de={ridge_pred['pct_de']:.1%}, "
                f"mean_lfc={ridge_pred['mean_lfc']:.3f}"
            )

        lines.append(f"\nTop-3 most similar KOs by Jina v5 phenotype embedding:")
        lines.append(_format_similar(similar))
        lines.append("")

    return "\n".join(lines)


# ── Claude system prompt ──────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are a scientific assistant with deep expertise in the ZSCAPE dataset — "
    "a large-scale zebrafish (Danio rerio) single-cell CRISPR knockout study covering 28 transcription "
    "factor knockouts across multiple developmental timepoints and cell types.\n\n"
    "You have access to:\n"
    "- Pre-written phenotype descriptions for 25 of the 28 KOs\n"
    "- Jina v5 text embeddings (512-dim) encoding each KO's phenotype\n"
    "- A SummaryRidge model (PCA-10 → Ridge) trained on the 28 KO embeddings to predict "
    "% DE genes and mean |LFC| for novel genes\n"
    "- Pre-computed LOKO (leave-one-KO-out) Pearson scores from the jina_ridge baseline "
    "(mean Pearson ≈ 0.385 on ctrl-HVG gene set)\n\n"
    "Key concepts:\n"
    "- % DE genes: fraction of genes significantly differentially expressed in the KO vs control\n"
    "- mean |LFC|: average magnitude of log-fold-change for significant genes\n"
    "- LOKO Pearson: correlation between Ridge-predicted and actual expression deltas "
    "when the KO was held out from training\n"
    "- Cosine similarity: semantic similarity between KO phenotype embeddings\n\n"
    "When answering:\n"
    "- Ground your response in the retrieved data context provided\n"
    "- For prediction queries, clearly distinguish observed data from Ridge-predicted values\n"
    "- Be concise and biologically precise; audience is computational biology researchers\n"
    "- When quoting predictions, note model uncertainty (LOO MAE ~ 0.17 for pct_de)"
)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return {
        "status": "ok",
        "kos_loaded": len(KO_NAMES),
        "descriptions": len(KO_DESCRIPTIONS),
        "embedding_shape": list(KO_EMBEDDINGS.shape),
        "jina_api": bool(os.environ.get("JINA_API_KEY")),
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
    context = retrieve_context(latest_user)
    system  = SYSTEM_PROMPT + f"\n\n<zscape_context>\n{context}\n</zscape_context>"

    client = anthropic.Anthropic()

    def generate():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system,
                messages=messages,
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
    parser.add_argument("--port",     type=int, default=5002)
    parser.add_argument("--data-dir", default=DATA_DIR, dest="data_dir")
    args = parser.parse_args()

    DATA_DIR = args.data_dir
    load_data()

    app.run(host="0.0.0.0", port=args.port)
