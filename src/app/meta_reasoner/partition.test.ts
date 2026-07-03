// partition.test.ts — run with:  node --test src/app/meta_reasoner/partition.test.ts
// (Node 24 strips TS types natively; no test-runner dependency. Pure module, no
//  relative imports, so it loads standalone unlike operator.ts.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPartition, diffPartition, PartitionError } from "./partition.ts";

// helper: a merges/set_aside pair from compact specs
function parts(merges: string[][], aside: string[] = []) {
  return {
    merges: merges.map((ids) => ({ member_leaf_ids: ids })),
    set_aside: aside.map((id) => ({ leaf_id: id })),
  };
}

test("valid exact partition: merges + set_aside cover every input once", () => {
  const p = parts([["1", "2", "3"], ["4", "5"]], ["6"]);
  assert.doesNotThrow(() => assertPartition(p, ["1", "2", "3", "4", "5", "6"]));
});

test("valid with numeric-string ids and out-of-order input", () => {
  const p = parts([["10", "2"]], ["1"]);
  assert.doesNotThrow(() => assertPartition(p, ["1", "2", "10"]));
});

test("MISSING leaf throws PartitionError naming the missing id", () => {
  const p = parts([["1", "2"]], []); // 3 never assigned
  assert.throws(
    () => assertPartition(p, ["1", "2", "3"]),
    (e: any) => {
      assert.ok(e instanceof PartitionError);
      assert.equal(e.code, "partition_violation");
      assert.deepEqual(e.diff.missing, ["3"]);
      assert.match(e.message, /1 missing \[3\]/);
      return true;
    },
  );
});

test("DUPLICATED leaf (across a merge and a set_aside) throws naming the dup", () => {
  const p = parts([["1", "2"]], ["2"]); // 2 appears twice
  assert.throws(
    () => assertPartition(p, ["1", "2"]),
    (e: any) => {
      assert.deepEqual(e.diff.duplicated, ["2"]);
      assert.match(e.message, /1 duplicated \[2\]/);
      return true;
    },
  );
});

test("EXTRA / hallucinated id not in the input throws naming it", () => {
  const p = parts([["1", "2", "99"]], []); // 99 was never an input leaf
  assert.throws(
    () => assertPartition(p, ["1", "2"]),
    (e: any) => {
      assert.deepEqual(e.diff.extra, ["99"]);
      assert.match(e.message, /not-in-input \[99\]/);
      return true;
    },
  );
});

test("SILENT-EMPTY case: a malformed block (no merges, no set_aside) throws, not returns empty", () => {
  const p = parts([], []); // what parseOperatorOutput yields on unparseable JSON
  assert.throws(
    () => assertPartition(p, ["1", "2", "3"]),
    (e: any) => {
      assert.equal(e.code, "partition_violation");
      assert.deepEqual(e.diff.missing, ["1", "2", "3"]);
      return true;
    },
  );
});

test("diffPartition is pure and reports all three failure classes at once", () => {
  // assigned: 1 (dup), 2, 88 (extra); expected: 1,2,3  -> missing 3
  const d = diffPartition(["1", "1", "2", "88"], ["1", "2", "3"]);
  assert.deepEqual(d.missing, ["3"]);
  assert.deepEqual(d.duplicated, ["1"]);
  assert.deepEqual(d.extra, ["88"]);
});

test("number-typed ids are coerced to strings before comparison", () => {
  const p = { merges: [{ member_leaf_ids: [1 as any, 2 as any] }], set_aside: [] };
  assert.doesNotThrow(() => assertPartition(p, ["1", "2"]));
});
