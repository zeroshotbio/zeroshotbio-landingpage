// /cell_labelling_hierarchy/[slug] — drill-down audit for one cell/tissue category.
//
// Shows every ground-truth-judged node that falls in this category, per dataset, with the
// fuzzy judge's per-tier verdict + written justification (Z/C/D) or the expert-GT crosswalk
// scores (MiniFin) — so the calls behind the summary table can be hand-audited. INTERNAL, noindex.

import { notFound } from "next/navigation";
import { DETAILS } from "../details";
import CategoryAuditClient from "./CategoryAuditClient";

export function generateStaticParams() {
  return Object.keys(DETAILS).map((slug) => ({ slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = DETAILS[slug];
  return {
    title: d ? `${d.category} · judge audit` : "Category audit",
    description: "Hand-audit the individual fuzzy-judge calls per ground-truth dataset.",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = DETAILS[slug];
  if (!detail) notFound();
  return <CategoryAuditClient detail={detail} />;
}
