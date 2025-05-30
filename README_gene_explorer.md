# Gene Explorer Architecture

This document describes how the **Gene Explorer** page works from a technical perspective. It is aimed at back-end and infrastructure developers who need to understand the data flow and component setup.

## Overview

The Gene Explorer is implemented as a Next.js client component located at `src/app/gene-explorer/page.tsx`. It renders an interactive network visualization that displays gene relationships predicted by a small biological foundation model. The visualization is powered by the [vis-network](https://visjs.org/) library running entirely in the browser.

The page communicates with a separate Flask API (not included in this repository) that performs model inference. The endpoint address is configured through the `NEXT_PUBLIC_FLASK_ENDPOINT` environment variable.

## Data Flow

1. **Gene Metadata** – A list of available gene names is served from `public/gene_names.json`. When the component mounts it loads this file with `fetch` and populates a drop-down menu.
2. **User Parameters** – The user selects a gene name along with contextual metadata (developmental stage, anatomical region, maximum depth of the network and the number of top genes to include per level). These values are stored in React state.
3. **Inference Request** – Pressing “Run Inference” triggers an asynchronous POST request to `${NEXT_PUBLIC_FLASK_ENDPOINT}/api/analyze`. The request body contains the selected parameters.
4. **Inference Response** – The Flask service returns a JSON payload describing nodes and edges of the gene network. The response shape is captured in the local `VisData`, `NodeData`, and `EdgeData` TypeScript interfaces.
5. **Visualization** – The returned nodes and edges are loaded into a vis-network `DataSet`. Network physics options are mapped to UI controls so that users can experiment with gravity, spring length, damping, etc. The network is automatically fitted to the canvas and updated whenever options change.
6. **Double‑click Interaction** – Users can double‑click a node in the graph to re-run inference using that node’s gene label as the new target. This is handled by a vis-network `doubleClick` event handler which calls the same `analyzeGeneNetwork` function with an overridden gene name.

## Component Structure

```
src/app/gene-explorer/page.tsx
├─ DarkMode wrapper
├─ Sidebar
│  ├─ Gene & Context form
│  ├─ Physics controls
│  └─ Aesthetic controls
└─ Main Content
   ├─ Top header navigation
   ├─ Introductory text
   └─ Network canvas (vis-network)
```

The component is written entirely with React hooks and runs on the client (`"use client";` at the top of the file). All DOM manipulation for the network occurs in `useEffect` hooks to ensure objects are created after the page has mounted.

## API Contract

The expected response from the Flask API looks like:

```json
{
  "nodes": [
    {"id": "ENSG...", "label": "geneA", "title": "", "depth": 0, "degree": 3, "is_source": true},
    {"id": "ENSG...", "label": "geneB", "title": "", "depth": 1, "degree": 1, "is_source": false}
  ],
  "edges": [
    {"from": "id1", "to": "id2", "title": "score", "value": 12, "depth": 1}
  ],
  "summary": {
    "num_nodes": 25,
    "num_edges": 24,
    "max_depth": 3
  },
  "target_id": "id1",
  "target_gene": "geneA"
}
```

Any field names added by the API should match the interfaces defined in the component. The visualization logic assumes numerical `value` fields for edge weights and uses `depth` to color nodes and edges.

## Environment Variables

- `NEXT_PUBLIC_FLASK_ENDPOINT` – Base URL of the Flask inference service. Defaults to `http://localhost:5000` when not provided.

## Styling and Assets

The page uses Tailwind CSS for styling. Additional images such as the company logo are served from the `public/images` directory.

## Extending the Explorer

Back-end developers who modify the Flask service or the response shape should update the TypeScript interfaces and the mapping logic in `page.tsx`. The front-end assumes that node identifiers are unique strings and that edge definitions refer to these identifiers.

