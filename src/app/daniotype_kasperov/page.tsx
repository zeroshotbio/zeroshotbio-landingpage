// daniotype_kasperov — human-in-the-loop cell-type labelling wizard.
//
// Named for Kasparov's thesis that the strongest systems are human–AI hybrids:
// the daniotype descent serves grounded, tool-verified evidence for every
// cluster (markers → ZFIN in-vivo expression → ZFA anatomy → a proposed
// (identity, state) name), and a human judge walks the atlas tree screen by
// screen, approving / relabelling / abstaining on each node.
//
// POC skeleton: the wizard is a client component reading a sample atlas
// (src/app/daniotype_kasperov/atlas.ts). The data shapes mirror real descent
// output so this swaps onto a live runs/<run>/hierarchy.json + decision_log.

import KasperovClient from "./KasperovClient";
import UploadSection from "./components/UploadSection";

export const metadata = {
  title: "daniotype · kasperov — human-in-the-loop cell-type labelling",
  description:
    "A human–AI hybrid wizard: the daniotype descent serves grounded marker/anatomy evidence for every zebrafish cluster; you judge each label, cluster by cluster, down the atlas tree.",
};

export default function DaniotypeKasperovPage() {
  return (
    <>
      <KasperovClient />
      <UploadSection />
    </>
  );
}
