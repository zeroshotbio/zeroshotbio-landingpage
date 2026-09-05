// /compass — ChemFish "biological flotilla". One fullscreen isometric river scene.
//
// Explanatory, not an embedding: the river is the metaphor's geometry. The only real quantities the
// scene consumes are, per drug × tissue, the gene-space loading on the selected program (r·u), the
// response norm ‖r‖, the residual √(‖r‖²−(r·u)²) and program membership — all from
// ./data/flotilla.json, written by chemfish_response_atlas/scripts/export_flotilla_json.py from
// frozen Phase-5 results.
import { Inter } from "next/font/google";
import Flotilla from "./Flotilla";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata = {
  title: "ChemFish · biological flotilla",
  description: "One drug, many tissue responses: a flotilla carried partly by a shared biological current, each boat with its own residual drift.",
};

export default function CompassPage() {
  return <Flotilla fontClass={inter.className} />;
}
