// meta_reasoner — replay + judge a completed headless kasperov run.
//
// A fork of the daniotype_kasperov chat + judgement interface that loads a
// previously-run run and lets the curator step through every recorded chat step
// and every compartment boundary, dropping judgement notes at the "higher"
// meta-reasoner level (knowledge integration between clustering and chat) BEFORE
// the Phase-2 brain is built. No LLM is called — it replays what happened.

import MetaReasonerReplayClient from "./MetaReasonerReplayClient";

export const metadata = {
  title: "meta-reasoner · replay + judgement",
  description:
    "Step through a completed headless labelling run cluster-by-cluster and boundary-by-boundary, adding judgement notes at the meta-reasoner level.",
};

export default function MetaReasonerPage() {
  return <MetaReasonerReplayClient />;
}
