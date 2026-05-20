// Hosts the self-contained MiniFin cluster annotation wizard for expert review.
// The wizard itself is a static HTML bundle in /public/minifin_annotation_wizard/.

export const metadata = {
  title: "MiniFin cluster annotation — zeroshot bio",
  description:
    "Expert review wizard for MiniFin single-cell clusters: marker-led screens with DEG stats, UMAP, drug composition, and decision capture.",
};

export default function MiniFinAnnotationWizardPage() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#fafafa" }}>
      <iframe
        src="/minifin_annotation_wizard/wizard.html"
        title="MiniFin cluster annotation wizard"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
        allow="clipboard-write"
      />
    </div>
  );
}
