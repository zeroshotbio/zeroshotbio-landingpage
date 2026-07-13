// /cell_type_court — successor to Cell Type Tinder. Separates the TWO expert judgments the old
// binary tool conflated: ① PLACEMENT (did the resolver file a messy label on the right ontology
// node?) and ② CLOSENESS (given two correctly-placed labels, how close are they, biologically?).
// The expert never sees a number; every term carries a plain-English gloss. Front-end shell only:
// cards from public/cell_type_court/cards.json, verdicts held in localStorage + exportable.
// Server component (metadata) wrapping the client UI, matching the POC_workflow / Tinder pattern.
import CourtClient from "./CourtClient";

export const metadata = {
  title: "Cell Type Court — zeroshot bio",
  description:
    "Expert certification of cell-type label placement and closeness — two separate verdicts, no numbers shown, for resolver + score calibration.",
};

export default function CellTypeCourtPage() {
  return <CourtClient />;
}
