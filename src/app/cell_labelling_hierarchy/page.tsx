// /cell_labelling_hierarchy — INTERNAL preview (not customer-facing).
//
// A table that summarizes which cell / tissue types the labelling wizard annotates
// correctly AND confidently, ranked by consistency across every ground-truth dataset
// we score against: ZSCAPE, ChemFish, DanioCell, and the GT-covered slice of MiniFin.
//
// Data is precomputed from the four golden runs' GT scorecards and embedded in ./data.ts
// (no live fetch). noindex — internal team surface, low-security but not for indexing.

import CellLabellingHierarchyClient from "./CellLabellingHierarchyClient";

export const metadata = {
  title: "Cell-Labelling Hierarchy · internal",
  description:
    "Which cell & tissue types annotate correctly and confidently — ranked by consistency across ZSCAPE, ChemFish, DanioCell, and MiniFin ground truth.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function CellLabellingHierarchyPage() {
  return <CellLabellingHierarchyClient />;
}
