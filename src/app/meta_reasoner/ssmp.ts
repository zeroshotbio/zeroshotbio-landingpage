// ssmp.ts — Shared Specific-Marker Program (SSMP): a GT-BLIND, review-time flag for
// MARKER-DISJOINT merges (the "Shape A" failure mode harvested from the ChemFish+DanioCell
// corpus). At merge time, for a proposed node, SSMP asks: do the member leaves share a
// SPECIFIC marker program, or were they merged on label-string similarity alone?
//
//   SSMP = Σ_{g∈core} idf(g)·member_fraction(g)  /  median_{leaf∈node}( Σ_{g∈S(leaf)} idf(g) )
//
//   S(leaf)          = specific markers (l2fc≥1, pct_in≥0.25, pct_out≤0.10) — the labeller's own bar
//   core             = genes present in ≥50% of members' S(leaf)
//   idf(g)=log(N/df) = log-IDF over ALL leaves; downweights promiscuous/structural genes
//                      (a shared collagen/keratin ≈ 0) WITHOUT zeroing a shared promiscuous program.
//
// A near-zero SSMP => members share no specific program => marker-disjoint (Shape A) => FLAG.
// This is ADVISORY and NEVER blocks/auto-acts. It NEVER touches labels or GT — DE evidence only.
//
// Validated head-to-head vs coherence-metric D on sealed ZSCAPE (N=7 over-merges): at τ=0.34,
// SSMP caught C5-m1 (a mild-band 0.537-purity over-merge D was blind to) with 0 false-fires on
// clean nodes and strictly better 2×2 (prec 1.00/rec 0.43 vs D 0.50/0.29). It is a NARROW-SCOPE
// flag for the genuinely-disjoint subclass — NOT a general over-merge detector.

export type MarkerStat = { g: string; l2fc?: number; p1?: number; p2?: number };
// per-leaf specific-marker SET, keyed by leaf id (string). Callers build these from the archivist
// DE (full ranked markers), NOT from a run's truncated top-K (which collapses SSMP to noise).
export type LeafSpecificSets = Record<string, Set<string>>;

export const SPECIFIC_BAR = { l2fc: 1, p1: 0.25, p2: 0.1 } as const;

// filter a leaf's archivist DE rows to the specific-marker set (the labeller's own bar).
export function specificSet(markers: MarkerStat[]): Set<string> {
  const s = new Set<string>();
  for (const m of markers || []) {
    if ((m.l2fc ?? 0) >= SPECIFIC_BAR.l2fc && (m.p1 ?? 0) >= SPECIFIC_BAR.p1 && (m.p2 ?? 1) <= SPECIFIC_BAR.p2) {
      s.add(String(m.g).toLowerCase());
    }
  }
  return s;
}

// log-IDF over all leaves' specific sets. Precompute once per dataset (it's a per-dataset asset).
export function computeIDF(sets: LeafSpecificSets): Record<string, number> {
  const N = Object.keys(sets).length || 1;
  const df: Record<string, number> = {};
  for (const s of Object.values(sets)) for (const g of Array.from(s)) df[g] = (df[g] || 0) + 1;
  const idf: Record<string, number> = {};
  for (const g in df) idf[g] = Math.log(N / df[g]);
  return idf;
}

function leafMass(s: Set<string>, idf: Record<string, number>): number {
  let m = 0;
  for (const g of Array.from(s)) m += idf[g] || 0;
  return m;
}

// SSMP for one node. Returns null if <2 members resolve to a marker set. GT-blind.
export function nodeSSMP(memberLeafIds: string[], sets: LeafSpecificSets, idf: Record<string, number>): number | null {
  const mem = memberLeafIds.map(String).filter((id) => sets[id]);
  if (mem.length < 2) return null;
  const present: Record<string, number> = {};
  for (const id of mem) for (const g of Array.from(sets[id])) present[g] = (present[g] || 0) + 1;
  let coreMass = 0;
  for (const g in present) {
    const frac = present[g] / mem.length;
    if (frac >= 0.5) coreMass += (idf[g] || 0) * frac; // majority-shared core, IDF·prevalence weighted
  }
  const masses = mem.map((id) => leafMass(sets[id], idf)).sort((a, b) => a - b);
  const mid = Math.floor(masses.length / 2);
  // TRUE median (average the two middle values for even N) — matches the validated metric; the
  // upper-middle-element shortcut inflates the denominator for even-N nodes and false-fires.
  const ref = (masses.length % 2 ? masses[mid] : (masses[mid - 1] + masses[mid]) / 2) || 1e-9;
  return Math.round((coreMass / ref) * 1000) / 1000;
}

// annotate operator merges in place with { ssmp } (null when unresolvable). Non-destructive to
// every other field; only ADDS ssmp. Caller supplies the dataset's leaf specific-sets + IDF.
export function annotateMerges(
  merges: Array<{ member_leaf_ids?: string[]; ssmp?: number | null }>,
  sets: LeafSpecificSets,
  idf: Record<string, number>,
): void {
  for (const m of merges || []) m.ssmp = nodeSSMP((m.member_leaf_ids || []).map(String), sets, idf);
}
