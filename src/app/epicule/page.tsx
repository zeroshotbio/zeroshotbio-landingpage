// /epicule — grounding visual for the Epicule / MiniEpi v2 GNN world-model.
// Self-contained static bundle in /public/epicule/index.html
// (same iframe-to-static pattern as the_long_dusk / minifin_annotation_wizard).

export const metadata = {
  title: "Epicule — the GNN world-model (MiniEpi v2)",
  description:
    "A grounding visual of the graph neural network behind Epicule: a 20-gene regulatory network with 75 signed edges, read by an edge-conditioned message-passing GNN that predicts how every gene shifts under a perturbation.",
};

export default function EpiculePage() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#f6f4f2" }}>
      <iframe
        src="/epicule/index.html"
        title="Epicule — the GNN world-model (MiniEpi v2)"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
      />
    </div>
  );
}
