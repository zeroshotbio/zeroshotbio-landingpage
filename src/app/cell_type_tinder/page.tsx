// /cell_type_tinder — expert label-binning UI ("Cell Type Tinder").
// Experts (Patrick / Harsha) bin blinded predicted<->GT label pairs on a 5-point
// same<->different spectrum. Verdicts persist to DynamoDB (see api/cell_type_tinder).
// Server component (metadata) wrapping the client wizard, matching the POC_workflow pattern.
import TinderClient from "./TinderClient";

export const metadata = {
  title: "Cell Type Tinder — zeroshot bio",
  description:
    "Expert binning of cell-type label pairs along a same↔different spectrum, for judge calibration.",
};

export default function CellTypeTinderPage() {
  return <TinderClient />;
}
