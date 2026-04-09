#!/usr/bin/env python3
"""
ZSCAPE Chat API  —  Flask SSE backend for the ZSCAPE chat interface.

Loads ZSCAPE distributional/DE summary CSVs at startup, retrieves relevant
context for user queries, then streams a Claude response via Server-Sent Events.

Usage:
  ANTHROPIC_API_KEY=sk-... python app.py --port 5002

Or to keep running after terminal exit:
  nohup ANTHROPIC_API_KEY=sk-... python app.py --port 5002 > app.log 2>&1 &
"""

import os
import csv
import json
import argparse
from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
import anthropic

app = Flask(__name__)
CORS(app)

# ── Data loaded at startup ──────────────────────────────────────────────────

DE_SUMMARY: list[dict] = []        # D_de_summary.csv
DIST_SUMMARY: list[dict] = []      # D_distributional_summary.csv
KNOCKOUT_INDEX: dict[str, list[dict]] = {}  # lowercase knockout → de_summary rows

DATA_DIR = os.environ.get(
    "ZSCAPE_DATA_DIR",
    "/data/ZSCAPE_complements_v3/data",
)


def load_data() -> None:
    global DE_SUMMARY, DIST_SUMMARY, KNOCKOUT_INDEX

    with open(os.path.join(DATA_DIR, "D_de_summary.csv")) as f:
        DE_SUMMARY = list(csv.DictReader(f))

    with open(os.path.join(DATA_DIR, "D_distributional_summary.csv")) as f:
        DIST_SUMMARY = list(csv.DictReader(f))

    for row in DE_SUMMARY:
        ko = row["knockout"].lower()
        KNOCKOUT_INDEX.setdefault(ko, []).append(row)

    print(
        f"[zscape_chat] Loaded {len(DE_SUMMARY)} DE comparisons, "
        f"{len(DIST_SUMMARY)} distributional records, "
        f"{len(KNOCKOUT_INDEX)} unique knockouts."
    )


# ── Context retrieval ───────────────────────────────────────────────────────

def retrieve_context(query: str) -> str:
    """Return a plain-text data snippet relevant to the user's query."""
    q = query.lower()

    matched_ko = [ko for ko in KNOCKOUT_INDEX if ko in q]

    if not matched_ko:
        knockouts = sorted(KNOCKOUT_INDEX.keys())
        return (
            f"The ZSCAPE dataset contains {len(KNOCKOUT_INDEX)} unique knockouts across "
            f"{len(DE_SUMMARY)} DE comparisons.\n"
            f"Available knockouts (first 40): {', '.join(knockouts[:40])}."
        )

    lines = []
    for ko in matched_ko[:3]:
        de_rows = KNOCKOUT_INDEX[ko]
        powered = [r for r in de_rows if r["has_power"] == "True"]
        if powered:
            avg_pct = sum(float(r["pct_de_genes"]) for r in powered) / len(powered)
            avg_lfc = sum(float(r["mean_abs_lfc_sig"]) for r in powered) / len(powered)
            lines.append(
                f"Knockout '{ko}': {len(de_rows)} comparisons total, "
                f"{len(powered)} with sufficient power. "
                f"Mean % DE genes: {avg_pct:.1%}, mean |LFC| of sig. genes: {avg_lfc:.3f}."
            )

        dist_rows = [r for r in DIST_SUMMARY if r["knockout"].lower() == ko]
        # Sort by energy distance descending to surface most-affected contexts first
        dist_rows.sort(key=lambda r: float(r["energy_distance"]), reverse=True)
        for r in dist_rows[:5]:
            lines.append(
                f"  {r['knockout']} in '{r['cell_type_sub']}' "
                f"(t={r['timepoint']}hpf, group={r['group']}): "
                f"energy_dist={float(r['energy_distance']):.3f}, "
                f"n_DE={r['n_de_genes']}, "
                f"separation_ratio={float(r['separation_ratio']):.3f}"
            )

    return "\n".join(lines)


# ── Claude system prompt ────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are a scientific assistant with deep expertise in the ZSCAPE dataset — "
    "a large-scale zebrafish (Danio rerio) single-cell CRISPR knockout study. "
    "You help researchers explore how transcription factor and gene perturbations "
    "affect cell populations across developmental timepoints and cell types.\n\n"
    "Key concepts:\n"
    "- Comparisons are subpopulations: one (knockout, cell-type, timepoint) triple.\n"
    "- Energy distance and separation ratio measure transcriptome-wide divergence.\n"
    "- LFC (log fold-change) and % DE genes summarise differential expression.\n"
    "- 'has_power=True' means the comparison had enough cells for reliable statistics.\n\n"
    "When answering, ground your response in the retrieved data context. "
    "Be concise, biologically precise, and appropriate for a computational biology audience."
)


# ── Routes ──────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return {
        "status": "ok",
        "knockouts_loaded": len(KNOCKOUT_INDEX),
        "de_comparisons": len(DE_SUMMARY),
    }


@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json(force=True)
    messages: list[dict] = body.get("messages", [])
    if not messages:
        return {"error": "messages array is required"}, 400

    # Retrieve context from the latest user turn
    latest_user = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )
    context = retrieve_context(latest_user)
    system = SYSTEM_PROMPT + f"\n\n<zscape_context>\n{context}\n</zscape_context>"

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

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
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable Nginx buffering for SSE
        },
    )


# ── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5002)
    parser.add_argument("--data-dir", default=DATA_DIR, dest="data_dir")
    args = parser.parse_args()

    DATA_DIR = args.data_dir
    load_data()

    app.run(host="0.0.0.0", port=args.port)
