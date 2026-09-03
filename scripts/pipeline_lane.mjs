#!/usr/bin/env node
/* pipeline_lane.mjs — what it costs to put a station into a row.
 *
 *   node scripts/pipeline_lane.mjs --map molecular_pipe
 *   node scripts/pipeline_lane.mjs --map molecular_pipe --after B1 --w 0.6 --d 0.6
 *
 * WHY THIS IS A TOOL AND NOT A SUM DONE BY HAND. The x values in a data file
 * are SEED ORDER ONLY — layoutRows() throws them away and re-spaces each lane
 * so it exactly fills its own x0..x1 span, scaling every gap by one factor k.
 * The consequence is the opposite of the obvious one: you do not move the
 * stations after the new one along. You grow the lane, and every station takes
 * its own new place.
 *
 * Grow it by the wrong amount and NOTHING looks broken — the row still fills
 * the span, because that is what the engine guarantees. What changes is k, so
 * all fourteen existing gaps quietly resize. That is a re-layout of the whole
 * row to add one thing, and it is invisible in a diff.
 *
 * The amount that leaves every existing gap exactly where it is:
 *
 *     k      = (x1 - x0 - Σw) / Σgaps          … before the change
 *     Δgaps  = gap(A,N) + gap(N,B) - gap(A,B)  … one gap becomes two
 *     x1'    = x1 + w(N) + k · Δgaps
 *
 * and the mat under the row grows by the same amount, because a band is as
 * long as its row. Appending at the end is the same formula with no B: the
 * file's own note says C5 cost 1.46, and this prints 1.464 for it.
 */
import { readFileSync } from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };

const MAPS = {
  molecular_pipe: "public/molecular_pipe/mol-data.js",
  pipeline: "public/pipeline/pipeline-data.js",
  data_structures: "public/data_structures/ds-data.js",
};
const mapId = arg("--map", "molecular_pipe");
const rel = MAPS[mapId];
if (!rel) { console.error(`unknown map "${mapId}" — one of: ${Object.keys(MAPS).join(", ")}`); process.exit(1); }

const ctx = { console, window: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(repo, rel), "utf8") +
  ";\nthis.__N=typeof NODES!=='undefined'?NODES:[];" +
  "this.__L=typeof LANES!=='undefined'?LANES:[];" +
  "this.__B=typeof BANDS!=='undefined'?BANDS:[];", ctx);
const NODES = ctx.__N, LANES = ctx.__L, BANDS = ctx.__B;

/* layoutRows()' own rule, copied because this tool has to agree with it exactly.
   If it ever changes in pipeline-iso.js it has to change here in the same
   commit — a tool that disagrees with the engine is worse than no tool. */
const BIG = (n) => n.anchor || n.shape === "works" || n.shape === "machine";
const gapFor = (a, b, L) =>
  b.gap !== undefined ? b.gap : L.even ? 1 : BIG(a) || BIG(b) ? 1.5 : 0.6;

function laneOf(id) {
  const L = LANES.find((l) => l.id === id) || LANES[0];
  const on = NODES.filter((n) => n.lane === L.id && !n.follow).sort((a, b) => a.x - b.x);
  let sw = on[0].w;
  const gaps = [];
  for (let i = 1; i < on.length; i++) { gaps.push(gapFor(on[i - 1], on[i], L)); sw += on[i].w; }
  const G = gaps.reduce((a, b) => a + b, 0);
  const k = Math.max(0.25, (L.x1 - L.x0 - sw) / G);
  return { L, on, gaps, sw, G, k };
}

/* the engine's placement, so the before/after can be compared for real rather
   than argued about */
function place(on, gaps, L, x1) {
  const k = Math.max(0.25, (x1 - L.x0 - on.reduce((s, n) => s + n.w, 0)) / gaps.reduce((a, b) => a + b, 0));
  const out = {};
  let cur = L.x0 + on[0].w / 2;
  out[on[0].id] = cur;
  for (let i = 1; i < on.length; i++) {
    cur += on[i - 1].w / 2 + gaps[i - 1] * k + on[i].w / 2;
    out[on[i].id] = cur;
  }
  return { pos: out, k };
}

const afterId = arg("--after");
/* a station names its own lane, so --lane is only needed to LIST one. Defaulting
   to LANES[0] and reporting "no station A5" when A5 is plainly in the file sent
   the reader looking for a typo instead of a flag. */
const named = afterId && NODES.find((n) => n.id === afterId || n.key === afterId);
const lane = laneOf(arg("--lane", named ? named.lane : undefined));
const { L, on, gaps, sw, G, k } = lane;

console.log(`\n${mapId} · lane ${L.id}   x0 ${L.x0}  x1 ${L.x1}`);
console.log(`${on.length} stations · Σw ${sw.toFixed(3)} · Σgaps ${G.toFixed(2)} · k ${k.toFixed(4)}`);

if (!afterId) {
  console.log("\nthe row as the engine lays it out:");
  const { pos } = place(on, gaps, L, L.x1);
  on.forEach((n, i) => console.log(
    `  ${String(n.key).padEnd(4)} ${String(n.id).padEnd(5)} w ${String(n.w).padEnd(5)} ` +
    `centre ${pos[n.id].toFixed(3)}` + (i ? `   gap before ${(gaps[i - 1] * k).toFixed(3)}` : "")));
  console.log(`\npass --after <id> --w <width> to price an insertion.`);
  process.exit(0);
}

const i = on.findIndex((n) => n.id === afterId || n.key === afterId);
if (i < 0) { console.error(`no station "${afterId}" on lane ${L.id}`); process.exit(1); }
const A = on[i], B = on[i + 1] || null;
const N = { id: "__new__", key: "NEW", w: Number(arg("--w", 0.6)), d: Number(arg("--d", 0.6)),
            h: Number(arg("--h", 0.3)) };
if (arg("--gap") !== undefined) N.gap = Number(arg("--gap"));

const gAN = gapFor(A, N, L);
const gNB = B ? gapFor(N, B, L) : 0;
const gAB = B ? gapFor(A, B, L) : 0;
const dGaps = gAN + gNB - gAB;
const grow = N.w + k * dGaps;

console.log(`\ninserting a ${N.w}-wide station after ${A.key} · ${A.id}` +
            (B ? ` and before ${B.key} · ${B.id}` : "  (the end of the row)"));
console.log(`  gap(A,N) ${gAN}   gap(N,B) ${gNB}   gap(A,B) ${gAB}   Δgaps ${dGaps.toFixed(2)}`);
console.log(`\n  GROW THE LANE AND THE MAT BY ${grow.toFixed(3)}`);
console.log(`    LANES  x1: ${L.x1}  ->  ${(L.x1 + grow).toFixed(3)}`);
BANDS.forEach((b, n) => console.log(
  `    BANDS[${n}] x1: ${b.x1}  ->  ${(b.x1 + grow).toFixed(3)}   (${b.name})`));
const seedLo = A.x, seedHi = B ? B.x : A.x + 1;
console.log(`    the node's own x (seed order only): anything between ${seedLo} and ${seedHi}` +
            `, e.g. ${((seedLo + seedHi) / 2).toFixed(2)}`);

/* prove it: lay the row out both ways and compare */
const on2 = on.slice(0, i + 1).concat([N], on.slice(i + 1));
const gaps2 = [];
for (let j = 1; j < on2.length; j++) gaps2.push(gapFor(on2[j - 1], on2[j], L));
const before = place(on, gaps, L, L.x1);
const after = place(on2, gaps2, L, L.x1 + grow);
console.log(`\n  k stays ${before.k.toFixed(4)} -> ${after.k.toFixed(4)}` +
            (Math.abs(before.k - after.k) < 1e-9 ? "   (every existing gap unchanged)" : "   *** GAPS RESIZED ***"));
let worst = 0;
on.forEach((n) => {
  const d = after.pos[n.id] - before.pos[n.id];
  worst = Math.max(worst, Math.abs(d) > 1e-9 && Math.abs(Math.abs(d) - grow) > 1e-9 ? 1 : 0);
});
console.log("  stations before the gap hold still; stations after it all move by " +
            `${grow.toFixed(3)}` + (worst ? "  *** NOT UNIFORM ***" : ""));
on.forEach((n, j) => {
  const d = after.pos[n.id] - before.pos[n.id];
  if (j === i || j === i + 1 || j === 0 || j === on.length - 1)
    console.log(`    ${String(n.key).padEnd(4)} ${before.pos[n.id].toFixed(3)} -> ${after.pos[n.id].toFixed(3)}  (${d >= 0 ? "+" : ""}${d.toFixed(3)})`);
});
console.log(`    ${"NEW".padEnd(4)} lands at ${after.pos["__new__"].toFixed(3)}\n`);
