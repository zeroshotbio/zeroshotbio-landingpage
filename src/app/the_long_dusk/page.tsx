// /the_long_dusk — "The Long Dusk", a Zeroshot fable.
// A cinematic, single-file, zero-dependency procedural pixel-art adventure.
// The game is a self-contained static HTML bundle in /public/the_long_dusk/.
// (Same iframe-to-static pattern as minifin_annotation_wizard.)

export const metadata = {
  title: "The Long Dusk — a Zeroshot fable",
  description:
    "A cinematic, single-file, zero-dependency medieval pixel-art adventure. Walk one road through five chapters — village, forest, moor, river, castle — where every cryptic warning is secretly about training AI on single-cell RNA-seq data.",
};

export default function TheLongDuskPage() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0a12" }}>
      <iframe
        src="/the_long_dusk/index.html"
        title="The Long Dusk — a Zeroshot fable"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
        allow="autoplay"
      />
    </div>
  );
}
