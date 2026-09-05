// /compass — ChemFish response space. One fullscreen 3D visualization, nothing else.
//
// Data: ./data/space.json, written only by
// /data/experiments/chemfish_response_atlas/scripts/export_space_json.py from frozen Phase-5
// results. Read that file's docstring for the geometry contract: uncentered SVD (origin = vehicle
// state), biological projections computed in 23,993-gene space and only then mapped to 3D.
import SpaceLoader from "./SpaceLoader";

export const metadata = {
  title: "compass · ChemFish response space",
  description: "Drug × tissue transcriptional responses as vectors; a shared biological program direction; each response = shared component + residual.",
};

export default function CompassPage() {
  return <SpaceLoader />;
}
