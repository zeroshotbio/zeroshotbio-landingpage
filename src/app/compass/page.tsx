// /compass — ChemFish Response Atlas V0.
//
// Interactive view over the FROZEN Phase 3-5 results of
// /data/experiments/chemfish_response_programs/. Nothing is recomputed here: every number is
// read from src/app/compass/data/*.json, which is written only by
// /data/experiments/chemfish_response_atlas/scripts/export_atlas_json.py and documented
// value-by-value in that project's DATA_MAP.md.

import CompassClient from "./CompassClient";

export const metadata = {
  title: "compass · ChemFish response atlas",
  description:
    "Click a drug, see how much of its whole-organism response is captured by a handful of reusable biological programs, and what drug-specific biology is left over.",
};

export default function CompassPage() {
  return <CompassClient />;
}
