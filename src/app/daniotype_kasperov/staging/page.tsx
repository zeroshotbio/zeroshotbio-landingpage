// daniotype_kasperov / STAGING — review-only variant of the labelling wizard.
//
// Identical to the live wizard (../KasperovClient) but with `staging` enabled, which
// turns on two judgement-workflow changes under review BEFORE they touch the live New Run:
//   1. an "Inputs" judgement step that exposes the full server-assembled system
//      instructions + briefing + first prompt, critiquable before the first call;
//   2. the per-step judgement popup replaced by a persistent, draggable JUDGEMENT panel
//      that lives alongside World Map / Top Markers / Tier Confidence and updates per step.
//
// URL: /daniotype_kasperov/staging  (covered by the existing Basic-Auth middleware matcher
// `/daniotype_kasperov/:path*`). The live route /daniotype_kasperov is unaffected.

import KasperovClient from "../KasperovClient";

// The judgement workflow (pre-run Inputs popup + persistent draggable JUDGEMENT box)
// is now promoted to the live New Run, so this route is just an alias of the live
// wizard — kept so existing /staging links still resolve.
export const metadata = {
  title: "daniotype · kasperov — human-in-the-loop cell-type labelling",
  description:
    "Alias of the live wizard. The judgement workflow now ships on the live New Run.",
};

export default function DaniotypeKasperovStagingPage() {
  return <KasperovClient />;
}
