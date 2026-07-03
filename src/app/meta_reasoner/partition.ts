// partition.ts — pure structural guard for the fine-then-consolidate operator.
//
// Contract: every input leaf_id must be accounted for EXACTLY ONCE across the
// proposed merges + set_aside. This is the safety floor under everything the
// operator emits — a malformed / regex-empty operator response fails this check
// (all leaves reported missing) instead of silently vanishing downstream as an
// empty node set.
//
// No imports on purpose: stays loadable under `node --test src/.../partition.test.ts`
// (Node strips TS types natively; extensionless relative imports would not resolve).

export type PartitionDiff = { missing: string[]; duplicated: string[]; extra: string[] };

// numeric-aware id sort so [2, 10] reads naturally; falls back to string compare.
function sortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const na = Number(a), nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b);
  });
}

// Compare the ids actually assigned (across merges + set_aside) against the input
// leaf-id set. Pure — returns the diff, never throws.
export function diffPartition(assignedIds: string[], expectedLeafIds: string[]): PartitionDiff {
  const expected = new Set(expectedLeafIds.map(String));
  const counts = new Map<string, number>();
  for (const raw of assignedIds) {
    const id = String(raw);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const duplicated = Array.from(counts.entries()).filter(([, n]) => n > 1).map(([id]) => id);
  const extra = Array.from(counts.keys()).filter((id) => !expected.has(id));
  const missing = Array.from(expected).filter((id) => !counts.has(id));
  return { missing: sortIds(missing), duplicated: sortIds(duplicated), extra: sortIds(extra) };
}

export class PartitionError extends Error {
  code = "partition_violation";
  diff: PartitionDiff;
  constructor(message: string, diff: PartitionDiff) {
    super(message);
    this.name = "PartitionError";
    this.diff = diff;
  }
}

// Throw PartitionError (naming the offending ids) unless merges + set_aside form
// an exact partition of expectedLeafIds. Only structural — knows nothing of GT.
export function assertPartition(
  parts: { merges: { member_leaf_ids: string[] }[]; set_aside: { leaf_id: string }[] },
  expectedLeafIds: string[],
): void {
  const assigned = [
    ...parts.merges.flatMap((m) => m.member_leaf_ids ?? []),
    ...parts.set_aside.map((s) => s.leaf_id),
  ];
  const d = diffPartition(assigned, expectedLeafIds);
  if (d.missing.length || d.duplicated.length || d.extra.length) {
    const bits: string[] = [];
    if (d.missing.length) bits.push(`${d.missing.length} missing [${d.missing.join(", ")}]`);
    if (d.duplicated.length) bits.push(`${d.duplicated.length} duplicated [${d.duplicated.join(", ")}]`);
    if (d.extra.length) bits.push(`${d.extra.length} not-in-input [${d.extra.join(", ")}]`);
    throw new PartitionError(
      `operator partition violation: ${bits.join("; ")}. ` +
        `Every input leaf_id must appear exactly once across merges + set_aside.`,
      d,
    );
  }
}
