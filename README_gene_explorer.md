# Gene-Explorer System Architecture

This document explains—at source-code level—how the Gene-Explorer front-end pages and the accompanying Flask back-end service fit together. It is intended for back-end, infra, and full-stack contributors who need to read or extend the code.

---

## 1 Repository layout

```
zeroshotbio-landingpage/
├─ backend/                      # NEW – self-contained Flask micro-service
│  └─ gene_explorer_api/
│     ├─ app.py                 # model + HTTP API
│     ├─ combined_processed_207_gene2idx.json
│     ├─ gene_names.json
│     ├─ requirements.txt
│     └─ README.md              # back-end-specific details
├─ src/app/
│  ├─ gene-explorer/            # “Gene-Explorer 1.0”             (calls port 5000)
│  └─ gene-explorer-perturbation/  # “Gene-Explorer Perturbation” (calls port 5001)
└─ …
```

*The only artefact **not** checked into Git is **`final_model.h5`** (≈ 200 MB).
It is pulled at run-time from S3 or Git LFS; see `backend/gene_explorer_api/README.md`.*

---

## 2 High-level data flow

1. **Front-end page loads** (`/gene-explorer` or `/gene-explorer-perturbation`).
   The React component fetches `public/gene_names.json` to populate the gene dropdown.

2. **User picks context** (gene, developmental stage, anatomy, max depth, top-N per level).
   The values live in React state.

3. **POST /api/analyze** – The page sends a JSON request to the appropriate Flask base URL:

   | Page                       | Environment variable              | Default (dev)           |
   | -------------------------- | --------------------------------- | ----------------------- |
   | Gene-Explorer 1.0          | `NEXT_PUBLIC_FLASK_ENDPOINT`      | `http://localhost:5000` |
   | Gene-Explorer Perturbation | `NEXT_PUBLIC_FLASK_ENDPOINT_PERT` | `http://localhost:5001` |

4. **Flask micro-service** (`backend/gene_explorer_api/app.py`) converts that JSON into a synthetic input tensor, performs a forward pass through **tsGPT v2.0.7 With Attention**, extracts attention scores and converts them into a small gene interaction graph.

5. **JSON response** (see Section 4) returns to the browser.

6. **vis-network render** – The component loads the nodes/edges into a `DataSet`.
   Physics and styling sliders update the network in real time.

7. **Double-click** on any node triggers another `/api/analyze`, using the clicked gene as the new centre.

---

## 3 Front-end component structure

```
src/app/gene-explorer(-perturbation)/page.tsx
├─ DarkMode wrapper
├─ Sidebar
│  ├─ Gene & Context controls
│  ├─ Physics sliders (gravity, spring, damping…)
│  └─ Aesthetic sliders (node scale, edge opacity, label size)
└─ Main content
   ├─ Twin nav-bars (site-wide tabs + category header)
   ├─ Explanatory text
   └─ <div ref={networkRef}> — Vis-Network canvas
```

The two pages share 100 % of their code; the only functional difference is the base URL they read from `process.env`.

---

## 4 Back-end API contract

```jsonc
{
  "nodes": [
    {
      "id":   "193",          // token id as string
      "label":"klf3",         // human gene symbol
      "title":"",             // free-form tooltip (optional)
      "depth":0,              // 0=source, 1=primary, …
      "degree":7,             // number of incident edges
      "is_source":true
    }
  ],
  "edges": [
    {
      "from":"193",           // source id
      "to":"875",
      "title":"klf3 → sox9  Score: 0.8421",
      "value":12.6,           // width weight (any float)
      "depth":1               // same notion as node.depth
    }
  ],
  "summary": {
    "num_nodes":68,
    "num_edges":67,
    "max_depth":3
  },
  "target_id":"193",
  "target_gene":"klf3"
}
```

Front-end assumptions:

* `nodes[*].id` and `edges[*].from/to` are unique strings.
* `edge.value` is a linear weight that maps to line width.
* `depth ∈ {0,1,2,3}` colours nodes and edges.

---

## 5 Configuration

| Variable                          | Used by                    | Purpose                                                        |
| --------------------------------- | -------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_FLASK_ENDPOINT`      | gene-explorer              | URL to the v1 model (default `http://localhost:5000`)          |
| `NEXT_PUBLIC_FLASK_ENDPOINT_PERT` | gene-explorer-perturbation | URL to the perturbation model (`https://perturb.zeroshot.bio`) |
| `AWS_*` vars                      | `/api/visitors` route      | Optional visitor-logging to DynamoDB                           |

---

## 6 Local development checklist

```bash
# Front-end
cp .env.local.example .env.local
# edit to point to whichever Flask port(s) you run

npm install
npm run dev  # http://localhost:3000

# Back-end
cd backend/gene_explorer_api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py --weights_file final_model.h5 \
              --mapping_json combined_processed_207_gene2idx.json \
              --port 5001
```

The page at [http://localhost:3000/gene-explorer-perturbation](http://localhost:3000/gene-explorer-perturbation) now calls `http://localhost:5001/api/analyze`.

---

## 7 Extending the system

* **Changing the model or response shape**
  Adjust `VisData`, `NodeData`, `EdgeData` interfaces in each `page.tsx`.
  Update colour/size logic if you introduce new node attributes.

* **Adding new exploration modes**
  Duplicate `src/app/gene-explorer` into another folder, set a new env var, and wire a new tab in the header.  The shared architecture handles multiple base URLs seamlessly.

With the back-end code now under `backend/` every contributor can view, lint, or debug the exact inference logic running in production without leaving the repository.
