// zfa_mapping — Stage 1 ZSCAPE→ZFA mechanical mapping review.
//
// Static precomputed asset (stage1.v1.json, built by
// /data/scratch/zlabel/stage1_zscape_zfa.py) rendered as a filterable review
// table. No LLM, no server calls — every binding decision is deterministic and
// the JSON is bundled at build time. Everything not auto-bound is an explicit
// PROPOSAL / UNMATCHED for Stage 2 curation, never a silent bind.
import ZfaMappingClient from "./ZfaMappingClient";

export const metadata = {
  title: "ZSCAPE → ZFA · Stage 1 mapping",
  description:
    "Deterministic ZSCAPE label → ZFA term binding cascade with CARO category checks; auto-binds, proposals, and explicit gaps for Stage 2 review.",
};

export default function ZfaMappingPage() {
  return <ZfaMappingClient />;
}
