/* check-prompt-record.mjs — the /molecular_pipe prompt record.
   Run: node scripts/pipeline_test/check-prompt-record.mjs
   Needs nothing installed: it compiles the route with the repo's own typescript
   and runs it against an in-memory DynamoDB.

   WHY THIS EXISTS. The queue behind "Edit visual" used to keep the newest forty
   prompts and silently drop the rest, which was fine while it was only a work
   queue. It is now also the thing "View prompt history" reads, and a history
   that quietly forgets is worse than no history — nothing on screen says which
   end it was trimmed from, so it reads as complete.

   Removing the cap is not the same as keeping everything. DynamoDB items stop
   at 400KB, and an item that outgrows the ceiling fails the write — so the
   record would take the NEW prompt down rather than an old one. So the store is
   paged, and paging is fiddly in ways that are invisible until they are not.
   Each check below is a way it went wrong or could:

     the whole record survives, across page boundaries and in order;
     items stay clear of the ceiling, even at the largest prompt anyone can send;
     pages are BATCHES. A spill rule with one threshold parks the head on the
       limit and writes a fresh one-row page per prompt forever — correct, and
       it turns reading the history into a thousand reads;
     the hot paths stay one read. The map polls this, and the worker on the
       instance polls ?open=1 every ten seconds;
     an unfinished row NEVER becomes unreachable from ?open=1. If one ages into
       the archive it is invisible to the only thing that could draw it, and it
       sits on the page saying "queued" forever;
     and a record written before any of this existed still reads.
*/
import { execFileSync } from "child_process";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const out = mkdtempSync(path.join(tmpdir(), "promptrec-"));
execFileSync(
  path.join(repo, "node_modules/.bin/tsc"),
  [ path.join(repo, "src/app/api/molecular_prompts/route.ts"),
    "--outDir", out, "--module", "commonjs", "--target", "es2020",
    "--skipLibCheck", "--esModuleInterop", "--moduleResolution", "node" ],
  { cwd: repo, stdio: "inherit" }
);

/* the store, and the ceiling it must never cross */
const store = new Map();
let gets = 0;
class GetItemCommand { constructor(i) { this.i = i; this.kind = "get"; } }
class PutItemCommand { constructor(i) { this.i = i; this.kind = "put"; } }
class DynamoDBClient {
  async send(c) {
    if (c.kind === "get") {
      gets++;
      const it = store.get(c.i.Key.id);
      return it ? { Item: { ...it } } : {};
    }
    const n = JSON.stringify(c.i.Item).length;
    if (n > 400 * 1024) throw new Error("ItemSizeLimitExceeded: " + n);
    store.set(c.i.Item.id, { ...c.i.Item });
    return {};
  }
}
const stubs = {
  "@aws-sdk/client-dynamodb": { DynamoDBClient, GetItemCommand, PutItemCommand },
  "@aws-sdk/util-dynamodb": { marshall: (o) => o, unmarshall: (o) => o },
  "next/server": {
    NextRequest: class {},
    NextResponse: { json: (b, i) => ({ _body: b, status: (i && i.status) || 200 }) },
  },
};
const require_ = createRequire(pathToFileURL(path.join(out, "x.cjs")));
const Module = require_("module");
const load = Module._load;
Module._load = function (req) { return stubs[req] || load.apply(this, arguments); };
const R = require_(path.join(out, "route.js"));

const GET = (q = "") => R.GET({ url: "https://x/api/molecular_prompts" + q }).then((r) => r._body);
const POST = (b) => R.POST({ json: async () => b }).then((r) => ({ ...r._body, _status: r.status }));
const biggest = () => Math.max(...[...store.values()].map((v) => JSON.stringify(v).length));

let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("  FAIL  " + m); } else console.log("  ok    " + m); };

/* the real cycle: sent, claimed, finished */
async function cycle(text, target = null) {
  const p = await POST({ text, target });
  await POST({ id: p.prompt.id, status: "working" });
  await POST({ id: p.prompt.id, status: "done", note: "drawn" });
  return p.prompt.id;
}

console.log("\nthe record as it stands, and as it grows");

// ---- reads what is already there, written before paging existed ----
const legacy = Array.from({ length: 27 }, (_, i) => ({
  id: "old" + i, text: "legacy prompt " + i, target: null,
  status: "done", at: 1e12 - i * 1000, updated: 1e12 - i * 1000,
}));
store.set("molecular_map::prompts",
  { id: "molecular_map::prompts", state_json: JSON.stringify(legacy) });

let g = await GET("?all=1");
ok(g.prompts.length === 27, "an item written before paging reads as-is");
ok(g.pages === 0, "and reports no archive pages");

const t = { id: "n5", key: "B5", name: "Pool and split", shape: "plate" };
const first = await POST({ text: "draw me a heater", target: t });
ok(first.ok && first.prompt.status === "queued", "a new prompt queues");
g = await GET("?all=1");
ok(g.prompts.length === 28 && g.prompts[0].id === first.prompt.id,
   "it lands on top and nothing is trimmed");
await POST({ id: first.prompt.id, status: "done", note: "heater added" });
g = await GET("?all=1");
ok(g.prompts[0].status === "done" && g.prompts[0].note === "heater added",
   "status and note stick");

// ---- past the old cap of forty, and past a page boundary ----
console.log("\npast the old cap, at the sizes actually being sent");
for (let i = 0; i < 900; i++) await cycle("bulk " + i + " " + "x".repeat(600), t);
g = await GET("?all=1");
ok(g.prompts.length === 928, `all 928 rows present (got ${g.prompts.length})`);
ok(g.pages > 0, `spilled into ${g.pages} archive page(s)`);
ok(new Set(g.prompts.map((r) => r.id)).size === g.prompts.length, "no row appears twice");
ok(legacy.every((r) => g.prompts.some((x) => x.id === r.id)), "the original 27 are still there");
const at = g.prompts.map((r) => r.at);
ok(at.every((v, i) => i === 0 || at[i - 1] >= v), "newest first across page boundaries");
ok(g.pages < 20, `pages are batches, not one per prompt (${g.pages} for 928 rows)`);
ok(biggest() < 400 * 1024, `largest item ${Math.round(biggest() / 1024)}KB is under the ceiling`);

// ---- the hot paths stay cheap however long it gets ----
console.log("\nthe hot paths");
gets = 0; const recent = await GET("");
ok(gets === 1, `the map's poll is one read (${gets})`);
ok(recent.prompts.length >= 40, `and covers a ${recent.prompts.length}-row window`);
gets = 0; await GET("?open=1");
ok(gets === 1, `the worker's ?open=1 poll is one read (${gets})`);
gets = 0; await POST({ text: "another", target: t });
ok(gets === 1, `queueing is one read (${gets})`);

// ---- an archived row can still be corrected ----
console.log("\nlate corrections, and rows that never finished");
const old = g.prompts[g.prompts.length - 1];
const mv = await POST({ id: old.id, status: "dropped", note: "never drawn" });
ok(mv.ok, "a row that has been archived can still be moved");
g = await GET("?all=1");
const back = g.prompts.find((r) => r.id === old.id);
ok(back.status === "dropped" && back.note === "never drawn", "the archived row kept the change");
ok((await GET("?id=" + old.id)).prompts.length === 1, "?id= finds it inside its page");
const miss = await POST({ id: "nope", status: "done" });
ok(!miss.ok && miss._status === 404, "an unknown id is still a 404");

// ---- THE ONE THAT MATTERS: an open row must never go invisible ----
const reopened = g.prompts[300];
await POST({ id: reopened.id, status: "queued" });
for (let i = 0; i < 300; i++) await cycle("later " + i + " " + "y".repeat(600), t);
ok((await GET("?all=1")).prompts.find((r) => r.id === reopened.id).status === "queued",
   "a re-opened row survives 300 more prompts");
ok((await GET("?open=1")).prompts.some((r) => r.id === reopened.id),
   "and ?open=1 still finds it — the worker can see it");
ok(biggest() < 400 * 1024, `no item burst holding it (${Math.round(biggest() / 1024)}KB)`);

// ---- an insertion carries where it goes, and a redraw stays a redraw ----
console.log("\ntwo kinds of request");
const ins = await POST({
  text: "a magnetic rack with six tubes",
  target: { id: "B1", key: "B3", name: "Pool and split", shape: "poolsplit" },
  kind: "insert",
  insert: { afterId: "B1", beforeId: "R2p", afterLabel: "B3 · Pool and split",
            beforeLabel: "B4 · Round 2 — ligation" },
});
ok(ins.ok && ins.prompt.kind === "insert", "an insertion is stored as one");
ok(ins.prompt.insert.afterId === "B1" && ins.prompt.insert.beforeId === "R2p",
   "with the gap it names");
const end = await POST({ text: "one more at the end", target: null, kind: "insert",
  insert: { afterId: "HND", beforeId: null, afterLabel: "C5 · Hand off the reads", beforeLabel: null } });
ok(end.prompt.insert.beforeId === null, "the end of the row is a slot with nothing after it");
const plain = await POST({ text: "thicker lines", target: { id: "THW", key: "B1", name: "Thaw", shape: "thawplate" } });
ok(plain.prompt.kind === "visual" && plain.prompt.insert === null,
   "a request that says nothing is a redraw, as every existing row was");
/* an insertion with nowhere to go is the one shape the worker cannot act on */
const nowhere = await POST({ text: "add something", kind: "insert", insert: { afterId: "", beforeId: null } });
ok(nowhere.ok && nowhere.prompt.kind === "visual",
   "an insertion with no slot falls back to a redraw rather than reaching the worker unusable");
const readBack = (await GET("?all=1")).prompts.find((r) => r.id === ins.prompt.id);
ok(readBack.kind === "insert" && readBack.insert.afterLabel === "B3 · Pool and split",
   "and all of it survives a round trip through the store");

// ---- and the worst case: every prompt at the 4000-char maximum ----
console.log("\nthe largest prompt anyone can send, four hundred times");
const HUGE = "H".repeat(6000);
for (let i = 0; i < 400; i++) await cycle(HUGE + i, t);
const all = await GET("?all=1");
ok(all.prompts.every((r) => r.text.length <= 4000), "each is clipped to the maximum");
ok(biggest() < 400 * 1024, `largest item ${Math.round(biggest() / 1024)}KB still under the ceiling`);
ok(all.pages < 60, `still batched (${all.pages} pages for ${all.prompts.length} rows)`);
ok(store.size - 1 === all.pages, `${store.size} items = 1 head + ${all.pages} pages`);
const window_ = await GET("");
ok(window_.prompts.length >= 40,
   `the head still covers the default window at max size (${window_.prompts.length})`);

console.log(bad ? `\n${bad} FAILED` : "\nprompt record: nothing is ever dropped, and the hot paths stay one read");
process.exit(bad ? 1 : 0);
