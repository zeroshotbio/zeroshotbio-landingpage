#!/usr/bin/env python3
"""
Backend-only Flask app for gene network inference on AWS EC2.

This file loads the tsGPTv207WithAttention model and exposes a JSON API
endpoint (/api/analyze) that returns network data for a specified gene.

python app.py \
  --weights_file "final_model.h5" \
  --mapping_json "combined_processed_207_gene2idx.json" \
  --initial_gene "klf3" \
  --timepoint "2dpf" \
  --dev_stage "larval-5dpf" \
  --anatomy "hematopoietic_system" \
  --port 5000


OR, to run this indefinitely even after exiting the terminal: 

nohup /home/ec2-user/gene_explorer_api/venv/bin/python app.py --weights_file "final_model.h5" --mapping_json "combined_processed_207_gene2idx.json" --initial_gene "klf3" --timepoint "2dpf" --dev_stage "larval-5dpf" --anatomy "hematopoietic_system" --port 5000 > app.log 2>&1 &


"""

import os
import json
import argparse
import warnings
import numpy as np
import tensorflow as tf
from flask_cors import CORS
from collections import defaultdict
from flask import Flask, request, jsonify

warnings.filterwarnings('ignore')

# -------------------------------------------------------------------
# Constants and global definitions
# -------------------------------------------------------------------
SEQ_LEN = 250  # Each input chunk has 250 tokens.

TIMEPOINT_OPTIONS = ["2dpf", "3dpf", "5dpf", "10dpf", "24hpf"]
DEVELOPMENTAL_STAGE_OPTIONS = [
    "0 somites", "05 somites", "10 somites", "15 somites", "20 somites",
    "30 somites", "larval-2dpf", "larval-3dpf", "larval-5dpf", "larval-10dpf"
]
ANATOMY_OPTIONS = [
    "neural_crest", "central_nervous_system", "paraxial_mesoderm",
    "lateral_mesoderm", "mesenchyme", "intermediate_mesoderm",
    "hematopoietic_system", "periderm", "notochord", "endoderm"
]

app = Flask(__name__)
CORS(app)

MODEL = None
GENE2IDX = {}
INDEX2GENE = {}
CONFIG = {}

# -------------------------------------------------------------------
# Model architecture
# -------------------------------------------------------------------
class TransformerBlockWithAttention(tf.keras.layers.Layer):
    def __init__(self, embed_dim, num_heads, ff_dim, dropout=0.1):
        super().__init__()
        self.att = tf.keras.layers.MultiHeadAttention(num_heads=num_heads, key_dim=embed_dim)
        self.ffn = tf.keras.Sequential([
            tf.keras.layers.Dense(ff_dim, activation="relu"),
            tf.keras.layers.Dense(embed_dim),
        ])
        self.norm1 = tf.keras.layers.LayerNormalization(epsilon=1e-6)
        self.norm2 = tf.keras.layers.LayerNormalization(epsilon=1e-6)
        self.dropout1 = tf.keras.layers.Dropout(dropout)
        self.dropout2 = tf.keras.layers.Dropout(dropout)
    
    def call(self, x, training=False, return_attention=False):
        if return_attention:
            attn_out, attn_weights = self.att(x, x, x, return_attention_scores=True)
        else:
            attn_out = self.att(x, x, x)
        attn_out = self.dropout1(attn_out, training=training)
        out1 = self.norm1(x + attn_out)
        ffn_out = self.ffn(out1)
        ffn_out = self.dropout2(ffn_out, training=training)
        out2 = self.norm2(out1 + ffn_out)
        if return_attention:
            return out2, attn_weights
        return out2

class tsGPTv207WithAttention(tf.keras.Model):
    def __init__(
        self,
        vocab_size,
        embed_dim=256,
        num_heads=8,
        ff_dim=768,
        num_blocks=4,
        dropout=0.1,
        metadata_dim=64,
        timepoint_classes=5,
        stage_classes=10,
        anatomy_classes=10,
    ):
        super().__init__()
        self.vocab_size = vocab_size
        self.embed_dim = embed_dim
        self.metadata_dim = metadata_dim

        self.gene_emb = tf.keras.layers.Embedding(vocab_size, embed_dim)
        self.expr_dense = tf.keras.layers.Dense(embed_dim)
        self.metadata_transform = tf.keras.layers.Dense(embed_dim, activation="relu")

        self.blocks = [
            TransformerBlockWithAttention(embed_dim, num_heads, ff_dim, dropout)
            for _ in range(num_blocks)
        ]
        self.final_norm = tf.keras.layers.LayerNormalization(epsilon=1e-6)
        self.dropout = tf.keras.layers.Dropout(dropout)

        # Output heads
        self.expr_head = tf.keras.layers.Dense(1)
        self.tp_head = tf.keras.Sequential([
            tf.keras.layers.Dense(embed_dim, activation="relu"),
            tf.keras.layers.Dense(timepoint_classes, activation="softmax"),
        ])
        self.stage_head = tf.keras.Sequential([
            tf.keras.layers.Dense(embed_dim, activation="relu"),
            tf.keras.layers.Dense(stage_classes, activation="softmax"),
        ])
        self.anat_head = tf.keras.Sequential([
            tf.keras.layers.Dense(embed_dim, activation="relu"),
            tf.keras.layers.Dense(anatomy_classes, activation="softmax"),
        ])
    
    def call(self, inputs, training=False, return_attention=False):
        gene_tokens = inputs["gene_tokens"]
        masked_expr = inputs["masked_expr"]
        meta_emb = inputs["metadata_emb"]

        # Embed gene tokens and expression
        g = self.gene_emb(gene_tokens)
        e = self.expr_dense(tf.expand_dims(masked_expr, axis=-1))
        x = g + e

        # Embed metadata
        m = self.metadata_transform(meta_emb)
        m = tf.expand_dims(m, axis=1)
        x = x + m
        
        attention_weights = []
        for block in self.blocks:
            if return_attention:
                x, attn = block(x, training=training, return_attention=True)
                attention_weights.append(attn)
            else:
                x = block(x, training=training)
        
        x = self.final_norm(x)
        x = self.dropout(x, training=training)
        
        # Expression logits across the tokens
        expr_logits = self.expr_head(x)
        expr_logits = tf.squeeze(expr_logits, axis=-1)
        
        # Classification heads (timepoint, stage, anatomy) use the "cls" token (x[:, 0, :])
        cls_token = x[:, 0, :]
        tp_out = self.tp_head(cls_token)
        stage_out = self.stage_head(cls_token)
        anat_out = self.anat_head(cls_token)
        
        outputs = {
            "expr_recon": expr_logits,
            "timepoint_head": tp_out,
            "stage_head": stage_out,
            "anatomy_head": anat_out,
        }
        if return_attention:
            return outputs, attention_weights
        return outputs
    
    def predict_with_attention(self, inputs):
        return self.call(inputs, training=False, return_attention=True)

# -------------------------------------------------------------------
# Utility / inference functions
# -------------------------------------------------------------------
def create_metadata_embedding(timepoint, dev_stage, anatomy, dim=64):
    """Create a pseudo-embedding for the context metadata, based on random seeds."""
    seed = hash(f"{timepoint}_{dev_stage}_{anatomy}") % 10000
    np.random.seed(seed)
    embedding = np.random.normal(0, 0.1, dim).astype(np.float32)
    
    # Slight modifications for each portion of the context
    timepoint_seed = hash(timepoint) % 10000
    np.random.seed(timepoint_seed)
    embedding[0:16] += np.random.normal(0, 0.5, 16)
    
    stage_seed = hash(dev_stage) % 10000
    np.random.seed(stage_seed)
    embedding[16:32] += np.random.normal(0, 0.5, 16)
    
    anatomy_seed = hash(anatomy) % 10000
    np.random.seed(anatomy_seed)
    embedding[32:48] += np.random.normal(0, 0.5, 16)
    
    # Normalize
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding /= norm
    return embedding

def create_input_data(gene_id, timepoint, dev_stage, anatomy, vocab_size=2000):
    """Assemble model input from a gene token, plus contextual embeddings."""
    gene_tokens = np.random.randint(0, vocab_size, SEQ_LEN, dtype=np.int64)
    center_pos = SEQ_LEN // 2
    gene_tokens[center_pos] = gene_id  # position the "main" gene in the center
    
    masked_expr = np.zeros(SEQ_LEN, dtype=np.float32)  # no expression data
    metadata_emb = create_metadata_embedding(timepoint, dev_stage, anatomy)
    
    inputs = {
        "gene_tokens": tf.convert_to_tensor(gene_tokens, dtype=tf.int64)[tf.newaxis, :],
        "masked_expr": tf.convert_to_tensor(masked_expr, dtype=tf.float32)[tf.newaxis, :],
        "metadata_emb": tf.convert_to_tensor(metadata_emb, dtype=tf.float32)[tf.newaxis, :],
    }
    return inputs, center_pos

def process_attention_for_gene_network(attention_weights, gene_tokens, center_pos, top_n=30):
    """
    Extract relationships from attention maps around the central "target" gene.
    Returns a dictionary of token_id -> attention score, for the top_n tokens.
    """
    num_layers = len(attention_weights)
    batch_idx = 0
    relationships = defaultdict(float)
    
    for layer_idx, layer_attention in enumerate(attention_weights):
        # shape of layer_attention: [batch, num_heads, seq_len, seq_len]
        target_from = layer_attention[batch_idx, :, center_pos, :]
        target_to = layer_attention[batch_idx, :, :, center_pos]
        
        avg_from = tf.reduce_mean(target_from, axis=0)  # average over heads
        avg_to = tf.reduce_mean(target_to, axis=0)
        
        layer_weight = (layer_idx + 1) / num_layers
        
        for pos, score_val in enumerate(avg_from.numpy()):
            if pos == center_pos:
                continue
            token_id = gene_tokens[batch_idx, pos].numpy()
            relationships[token_id] += score_val * layer_weight
        
        # We weigh the "to" side slightly differently
        for pos, score_val in enumerate(avg_to.numpy()):
            if pos == center_pos:
                continue
            token_id = gene_tokens[batch_idx, pos].numpy()
            relationships[token_id] += score_val * layer_weight * 0.8
    
    sorted_items = sorted(relationships.items(), key=lambda x: x[1], reverse=True)
    return dict(sorted_items[:top_n])

def analyze_gene_network(model, gene_id, timepoint, dev_stage, anatomy,
                         vocab_size, max_depth=2, top_genes_per_level=15):
    """
    Build a small 'network' by repeatedly sampling the model's attention
    around the central gene, expanding out to max_depth levels.
    """
    network_data = {
        "nodes": {},
        "edges": [],
        "target_id": gene_id
    }
    queue = [(gene_id, 0)]
    visited = set([gene_id])

    # If you wish, remove tqdm or simply print progress messages instead
    # for minimal server logs.
    while queue:
        current_id, current_depth = queue.pop(0)
        if current_depth > max_depth:
            continue
        
        # Insert a node if it doesn't exist
        if current_id not in network_data["nodes"]:
            network_data["nodes"][current_id] = {
                "token_id": current_id,
                "depth": current_depth,
                "degree": 0,
                "is_source": (current_depth == 0)
            }

        # If we're at max depth, don't expand more children
        if current_depth == max_depth:
            continue
        
        # Run one forward pass with attention
        inputs, center_pos = create_input_data(
            gene_id=current_id,
            timepoint=timepoint,
            dev_stage=dev_stage,
            anatomy=anatomy,
            vocab_size=vocab_size
        )
        outputs, attentions = model.predict_with_attention(inputs)

        # Extract top relationships
        top_relationships = process_attention_for_gene_network(
            attentions, inputs["gene_tokens"], center_pos, top_n=top_genes_per_level
        )
        
        # Populate edges/nodes
        for related_token_id, score in top_relationships.items():
            if related_token_id == current_id:
                continue
            
            if related_token_id not in network_data["nodes"]:
                network_data["nodes"][related_token_id] = {
                    "token_id": related_token_id,
                    "depth": current_depth + 1,
                    "degree": 0,
                    "is_source": False
                }
            
            # Check if edge already exists
            edge_exists = any(
                (e["source"] == current_id and e["target"] == related_token_id) or
                (e["source"] == related_token_id and e["target"] == current_id)
                for e in network_data["edges"]
            )
            if not edge_exists:
                network_data["edges"].append({
                    "source": current_id,
                    "target": related_token_id,
                    "score": float(score),
                    "depth": current_depth + 1
                })
                network_data["nodes"][current_id]["degree"] += 1
                network_data["nodes"][related_token_id]["degree"] += 1
            
            # Enqueue child if we have not visited it yet
            if related_token_id not in visited and (current_depth + 1) <= max_depth:
                queue.append((related_token_id, current_depth + 1))
                visited.add(related_token_id)
    
    # Add summary info
    network_data["summary"] = {
        "num_nodes": len(network_data["nodes"]),
        "num_edges": len(network_data["edges"]),
        "max_depth": max_depth
    }
    return network_data

def create_gene_label(token_id, index2gene):
    """Convert a numeric token ID back to a gene name."""
    key_str = str(token_id)
    if key_str in index2gene:
        return index2gene[key_str]
    return f"Gene_{token_id}"

def prepare_network_for_visualization(network_data):
    """
    Transform the network data for visualization by adding gene labels and
    ensuring all data types are JSON-serializable
    """
    vis_data = {
        "nodes": [],
        "edges": [],
        "summary": network_data["summary"]
    }
    
    # Process nodes
    for token_id, node_data in network_data["nodes"].items():
        gene_label = create_gene_label(token_id, INDEX2GENE)
        
        # ENHANCEMENT: Improved tooltip that encourages double-clicking
        tooltip = ""
        
        vis_data["nodes"].append({
            "id": str(token_id),
            "label": gene_label,
            "title": tooltip,
            "depth": node_data["depth"],
            "degree": node_data["degree"],
            "is_source": node_data["is_source"],
            "token_id": int(token_id)
        })
    
    # Process edges
    for edge in network_data["edges"]:
        source_label = create_gene_label(edge["source"], INDEX2GENE)
        target_label = create_gene_label(edge["target"], INDEX2GENE)
        
        vis_data["edges"].append({
            "from": str(edge["source"]),
            "to": str(edge["target"]),
            "title": f"{source_label} → {target_label}  Score: {edge['score']:.4f}",
            "value": edge["score"] * 5,  # Scale for visualization
            "depth": edge["depth"]
        })
    
    # Add the target gene ID
    vis_data["target_id"] = str(network_data["target_id"])
    vis_data["target_gene"] = create_gene_label(network_data["target_id"], INDEX2GENE)
    
    return vis_data

# -------------------------------------------------------------------
# Flask Routes
# -------------------------------------------------------------------

@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Main API endpoint: receives a JSON payload specifying 'gene_name', 
    context arguments, and the desired depth/top genes. Returns
    a JSON object with the node/edge graph for that gene's network.
    """
    data = request.json
    gene_name = data.get('gene_name')
    timepoint = data.get('timepoint', CONFIG.get('timepoint'))
    dev_stage = data.get('dev_stage', CONFIG.get('dev_stage'))
    anatomy = data.get('anatomy', CONFIG.get('anatomy'))
    max_depth = int(data.get('max_depth', CONFIG.get('network_depth', 3)))
    top_genes = int(data.get('top_genes', CONFIG.get('top_genes', 13)))
    
    if not gene_name or gene_name not in GENE2IDX:
        return jsonify({"error": f"Gene '{gene_name}' not found in mapping."}), 404
    
    gene_id = GENE2IDX[gene_name]
    
    try:
        network_data = analyze_gene_network(
            model=MODEL,
            gene_id=gene_id,
            timepoint=timepoint,
            dev_stage=dev_stage,
            anatomy=anatomy,
            vocab_size=CONFIG.get('vocab_size', 2000),
            max_depth=max_depth,
            top_genes_per_level=top_genes
        )
        # Convert to a more front-end-friendly structure
        vis_data = prepare_network_for_visualization(network_data)
        return jsonify(vis_data)
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500

@app.route("/api/get_gene_name/<token_id>")
def get_gene_name(token_id):
    """
    Optional endpoint: given a numeric token ID, returns the corresponding gene name.
    """
    try:
        gene_name = create_gene_label(token_id, INDEX2GENE)
        return jsonify({"gene_name": gene_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health_check():
    """
    Simple health check endpoint so you can confirm the server is running.
    """
    return jsonify({"status": "ok", "message": "Gene Explorer API is up and running."})

# -------------------------------------------------------------------
# Main / Initialization
# -------------------------------------------------------------------
def main():
    global MODEL, GENE2IDX, INDEX2GENE, CONFIG
    
    parser = argparse.ArgumentParser(description="Gene Network Inference Backend")
    parser.add_argument("--weights_file", required=True, help="H5 file with model weights.")
    parser.add_argument("--mapping_json", required=True, help="JSON of gene->token ID.")
    parser.add_argument("--initial_gene", default="klf3", help="Default gene.")
    parser.add_argument("--timepoint", default="2dpf", help="Default timepoint context.")
    parser.add_argument("--dev_stage", default="larval-5dpf", help="Default dev stage context.")
    parser.add_argument("--anatomy", default="hematopoietic_system", help="Default anatomy context.")
    parser.add_argument("--port", type=int, default=5000, help="Server port.")
    
    parser.add_argument("--network_depth", type=int, default=3, choices=[1, 2, 3],
                        help="Max network depth (1=primary, 2=secondary, 3=tertiary).")
    parser.add_argument("--top_genes", type=int, default=13, help="Number of top genes per level.")
    parser.add_argument("--vocab_size", type=int, default=2000)
    parser.add_argument("--embedding_dim", type=int, default=256)
    parser.add_argument("--num_heads", type=int, default=8)
    parser.add_argument("--ff_dim", type=int, default=768)
    parser.add_argument("--num_blocks", type=int, default=4)
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--metadata_dim", type=int, default=64)
    parser.add_argument("--timepoint_classes", type=int, default=5)
    parser.add_argument("--stage_classes", type=int, default=10)
    parser.add_argument("--anatomy_classes", type=int, default=10)
    args = parser.parse_args()
    
    # Store config
    CONFIG = vars(args)
    
    # Load gene mapping
    print(f"Loading gene mapping from {args.mapping_json}")
    with open(args.mapping_json, "r") as f:
        gene_map = json.load(f)
    GENE2IDX.update(gene_map)
    INDEX2GENE.update({str(v): k for k, v in gene_map.items()})
    
    # Verify initial gene
    if args.initial_gene not in GENE2IDX:
        print(f"Warning: initial_gene '{args.initial_gene}' not found in mapping.")
    
    # Initialize model
    print("Initializing tsGPTv207WithAttention model...")
    MODEL = tsGPTv207WithAttention(
        vocab_size=args.vocab_size,
        embed_dim=args.embedding_dim,
        num_heads=args.num_heads,
        ff_dim=args.ff_dim,
        num_blocks=args.num_blocks,
        dropout=args.dropout,
        metadata_dim=args.metadata_dim,
        timepoint_classes=args.timepoint_classes,
        stage_classes=args.stage_classes,
        anatomy_classes=args.anatomy_classes,
    )

    # Dummy forward pass to initialize weights
    print("Performing a dummy forward pass to build the model graph...")
    dummy_inputs = {
        "gene_tokens": tf.zeros([1, SEQ_LEN], dtype=tf.int64),
        "masked_expr": tf.zeros([1, SEQ_LEN], dtype=tf.float32),
        "metadata_emb": tf.zeros([1, args.metadata_dim], dtype=tf.float32),
    }
    _ = MODEL(dummy_inputs, training=False)

    # Load weights
    print(f"Loading weights from {args.weights_file}")
    MODEL.load_weights(args.weights_file)
    print("Model weights loaded successfully.")
    
    # Launch the Flask server
    print(f"Starting Flask server on port {args.port}...")
    app.run(host="0.0.0.0", port=args.port, debug=False)

if __name__ == "__main__":
    main()
