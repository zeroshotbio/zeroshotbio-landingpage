#!/usr/bin/env node
/* The instance side of the /pipeline "Edit visual" queue.
 *
 *   node scripts/pipeline_queue.mjs list            every row, newest first
 *   node scripts/pipeline_queue.mjs open            only what still needs doing
 *   node scripts/pipeline_queue.mjs watch [secs]    poll until something lands
 *   node scripts/pipeline_queue.mjs claim <id>      mark it working (page shows a spinner)
 *   node scripts/pipeline_queue.mjs done  <id> [note]   mark it done — the page reloads itself
 *   node scripts/pipeline_queue.mjs drop  <id> [why]    mark it dropped, no reload
 *
 * BASE defaults to production; override for a local server:
 *   BASE=http://localhost:3000 node scripts/pipeline_queue.mjs list
 */
const BASE = process.env.BASE || "https://www.zeroshot.bio";
const API = BASE.replace(/\/$/, "") + "/api/pipeline_prompts";

const [, , cmd = "list", arg, ...rest] = process.argv;
const note = rest.join(" ");

const age = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  return Math.round(s / 3600) + "h ago";
};

/* the route answers JSON or it is not there yet — say which, rather than
   letting a 404 page arrive at JSON.parse */
async function json(url, opt) {
  const r = await fetch(url, opt);
  const body = await r.text();
  try {
    return JSON.parse(body);
  } catch {
    console.error(
      `${API} did not answer JSON (HTTP ${r.status}).` +
        (r.status === 404 ? "  The route is not deployed yet — wait for Vercel." : "")
    );
    process.exit(1);
  }
}
async function get(qs = "") {
  const j = await json(API + qs, { cache: "no-store" });
  return j.prompts || [];
}
async function move(id, status, why) {
  const j = await json(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, status, note: why || undefined }),
  });
  if (!j.ok) {
    console.error("failed:", j.error || "unknown");
    process.exit(1);
  }
  console.log(`${id} -> ${status}${why ? " (" + why + ")" : ""}`);
}

function show(rows) {
  if (!rows.length) return console.log("nothing in the queue");
  for (const p of rows) {
    const t = p.target ? `${p.target.key} · ${p.target.name} [${p.target.shape}]` : "no target selected";
    console.log(
      `\n${"─".repeat(72)}\n${p.id}   ${p.status.toUpperCase()}   ${age(p.at)}\n` +
        `target: ${t}\n\n${p.text}\n` +
        (p.note ? `\nnote: ${p.note}\n` : "")
    );
  }
  console.log(`${"─".repeat(72)}\n${rows.length} row${rows.length === 1 ? "" : "s"}`);
}

switch (cmd) {
  case "list":
    show(await get());
    break;
  case "open":
    show(await get("?open=1"));
    break;
  case "watch": {
    const every = Math.max(5, Number(arg) || 20) * 1000;
    console.log(`watching ${API} every ${every / 1000}s — ctrl-c to stop`);
    const seen = new Set((await get("?open=1")).map((p) => p.id));
    for (;;) {
      await new Promise((r) => setTimeout(r, every));
      const rows = await get("?open=1");
      const fresh = rows.filter((p) => !seen.has(p.id));
      fresh.forEach((p) => seen.add(p.id));
      if (fresh.length) {
        console.log(`\n*** ${fresh.length} new ***`);
        show(fresh);
      }
    }
  }
  case "claim":
    if (!arg) { console.error("need an id"); process.exit(1); }
    await move(arg, "working", note);
    break;
  case "done":
    if (!arg) { console.error("need an id"); process.exit(1); }
    await move(arg, "done", note);
    break;
  case "drop":
    if (!arg) { console.error("need an id"); process.exit(1); }
    await move(arg, "dropped", note);
    break;
  default:
    console.error(`unknown command "${cmd}" — try list, open, watch, claim, done, drop`);
    process.exit(1);
}
