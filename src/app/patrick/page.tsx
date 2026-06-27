// /patrick — R4b constitutive-anchor decision dashboard (prototype, human-in-the-loop).
//
// Patrick makes 3 marker-annotation decisions for the R4b patch by SEEING the biology
// (cluster confusion + live gene evidence), then approves/edits a pre-filled proposal and
// exports his calls as JSON. Self-contained subroute — does NOT touch the root build.
//
// Data (real, in /public/patrick/): cells.json = per-cell UMAP of the v2 recursive PCA
// embedding (94,616 cells / 151 leaves); stats.json = timestamped snapshot of the live
// minifin_v2 :5007 slot (Vercel cannot reach the EC2 loopback at view-time); contradictions.json
// = tag-vs-evidence flags. See REPORT for provenance.
//
// noindex: this surface carries proprietary cluster + gene data. Robots disallowed + meta
// noindex. Real auth (basic-auth / Vercel password) is a pending decision for Steven before
// any public exposure at zeroshot.bio/patrick.

import PatrickClient from "./PatrickClient";

export const metadata = {
  title: "R4b decision dashboard · Patrick",
  description: "Constitutive-anchor marker annotation — review the biology, approve or edit, export.",
  robots: { index: false, follow: false, nocache: true,
    googleBot: { index: false, follow: false } },
};

export default function PatrickPage() {
  return <PatrickClient />;
}
