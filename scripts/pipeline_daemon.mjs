#!/usr/bin/env node
/* The listener behind "Edit visual" on /pipeline.
 *
 * Polls the prompt queue. When something is waiting it marks it working, hands
 * the request to a headless Claude Code run inside this repo, and then judges
 * the result on one objective question: did a commit reach origin/main? If it
 * did, the prompt is marked done — every open copy of the page notices and the
 * one that asked reloads itself. If it did not, the prompt is marked dropped
 * with the reason, which the page shows.
 *
 *   node scripts/pipeline_daemon.mjs                 poll forever
 *   node scripts/pipeline_daemon.mjs --once          drain what is waiting, exit
 *   node scripts/pipeline_daemon.mjs --dry           do everything except run Claude
 *   node scripts/pipeline_daemon.mjs --every 10      seconds between polls
 *
 * ANTHROPIC_API_KEY is stripped from the child: on this box it takes precedence
 * over the claude.ai login and has no credit, so the run would fail instantly.
 *
 * NOTE ON TRUST. The queue is a public unauthenticated endpoint, and this turns
 * anything posted to it into a commit on main. That is the point — it is what
 * closes the loop from the page — but it is only reasonable because the site is
 * an unlisted preview. The guards here are blast radius, not authentication:
 * one prompt at a time, a cap per hour, a hard timeout, and the agent is told
 * to touch nothing outside public/pipeline. Anyone who finds the endpoint can
 * still spend tokens and land a commit. Put a key on the POST before this maps
 * to anything real.
 */
import { spawn, execSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qurl = (m) => BASE.replace(/\/$/, "") + m.queue;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const ONCE = flag("--once");
const DRY = flag("--dry");
/* PRINT IS NOT DRY. --dry runs the whole handler and marks the prompt dropped,
   which is a destructive way to ask "what would you send?" — it cost somebody's
   request once. --print reads the queue, prints the task for the first thing
   waiting, and touches nothing. */
const PRINT = flag("--print");
const EVERY = Math.max(5, Number(val("--every", 10))) * 1000;

const BASE = process.env.BASE || "https://www.zeroshot.bio";

/* ---- THE MAPS THIS SERVES -------------------------------------------------
   There is more than one now, and each has its OWN queue: /pipeline and
   /molecular_pipe, which is row 2 on its own bench. Polling one queue and
   editing one directory was fine while there was one map; with two it means a
   request made from the second page sits at "queued" for ever and nobody is
   told why.

   `dirs` is what the agent may touch and what "did anything ship" is measured
   over. It is more than one directory on purpose: every map draws through the
   SHARED public/pipeline/pipeline-shapes.js, so a new drawing for the bench
   lands there while the node that names it lives in the bench's own data file.
   Scope the agent to one of those and it can write a shape it cannot wire up. */
const MAPS_DEF = [
  { id: "pipeline", queue: "/api/pipeline_prompts",
    dir: path.join(REPO, "public", "pipeline"),
    data: "public/pipeline/pipeline-data.js",
    dirs: ["public/pipeline"],
    verify: ["node scripts/pipeline_test/validate.js",
             "node scripts/pipeline_test/runview.js",
             "REDUCE=1 node scripts/pipeline_test/runview.js",
             "node scripts/pipeline_test/realdom.js",
             "cd public/pipeline && ./build.sh"] },
  { id: "molecular_pipe", queue: "/api/molecular_prompts",
    dir: path.join(REPO, "public", "molecular_pipe"),
    data: "public/molecular_pipe/mol-data.js",
    dirs: ["public/pipeline", "public/molecular_pipe"],
    /* the bench runs the big map's engine, so the big map's suite is what
       proves a new shape works; validate --map checks the bench's own data */
    verify: ["node scripts/pipeline_test/validate.js",
             "node scripts/pipeline_test/validate.js --map molecular_pipe",
             "node scripts/pipeline_test/runview.js",
             "node scripts/pipeline_test/realdom.js"] },
]; 
/* every map, for looking a shape up; MAPS is what this run polls */
const MAPS_ALL = MAPS_DEF;
const MAPS = MAPS_DEF.filter((m) => { const only = val("--map", ""); return !only || m.id === only; });

/* 15 minutes was not enough: the first rich request — a sequencer with moving
   parts — was still verifying when the kill landed, with the drawing finished
   and uncommitted. A drawing is allowed to take as long as a drawing takes. */
const TIMEOUT = Math.max(60, Number(val("--timeout", 1500))) * 1000;
const MODEL = val("--model", "opus");
const MAX_PER_HOUR = Number(val("--max-per-hour", 12));

const LOGDIR = path.join(REPO, ".pipeline-daemon");
mkdirSync(LOGDIR, { recursive: true });
const LOG = path.join(LOGDIR, "daemon.log");

const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);
function log(...a) {
  const line = `[${stamp()}] ${a.join(" ")}`;
  console.log(line);
  try { appendFileSync(LOG, line + "\n"); } catch {}
}

const sh = (cmd) => execSync(cmd, { cwd: REPO, encoding: "utf8" }).trim();
const head = () => sh("git rev-parse HEAD");
/* what this request is allowed to have touched — its own directories plus the
   test harness, which an agent may legitimately have had to extend */
const SCOPE = (map) => map.dirs.concat(["scripts/pipeline_test"]).join(" ");

async function api(map, opt) {
  const u = qurl(map);
  const r = await fetch(opt ? u : u + "?open=1", opt || { cache: "no-store" });
  const body = await r.text();
  try { return JSON.parse(body); }
  catch { throw new Error(`${map.id} queue answered HTTP ${r.status}, not JSON`); }
}
const move = (map, id, status, note) =>
  api(map, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status, note: note ? String(note).slice(0, 900) : undefined }) });

/* CLAIMING IS NOT THE SAME AS MOVING, and the difference is the whole reason
   more than one of these can be running. A claim says "queued -> working, and
   only if it is still queued". Two daemons polling the same queue both see the
   row; the queue lets exactly one of them through and answers the other
   already_claimed, and the loser leaves it alone instead of running a second
   agent over the same repo and pushing on top of the first.

   An older queue that does not know about `from` simply moves the row and
   answers ok — which is the behaviour there has always been, so a daemon
   deployed ahead of the route still works, it just is not protected. */
async function claim(map, id) {
  const r = await api(map, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, status: "working", from: "queued" }),
  });
  return !!(r && r.ok);
}

/* What the agent is told. The rules are the ones this map has accumulated;
   every one of them is here because breaking it broke something. */
/* HOW MANY NODES WEAR THIS SHAPE. A drawing is registered as DRAW.<shape> and
   every node naming that shape gets it — `tile` is worn by ten of them and
   `miniplate` by three on each map. Telling an agent to "edit DRAW.miniplate"
   when the person selected one round of barcoding would rewrite all three
   rounds, and rounds two and three are ligation rather than reverse
   transcription. So the count is worked out first and the instruction changes
   with it. This was invisible while the only request that ever succeeded
   targeted the sequencer, whose shape is worn once. */
function sharers(shape) {
  const out = [];
  for (const m of MAPS_ALL) {
    let src = ""; try { src = readFileSync(path.join(REPO, m.data), "utf8"); } catch { continue; }
    /* ONE RECORD AT A TIME. A single regex over the whole file walks straight
       past the end of a record and pairs one node's id with the next node's
       shape — it reported the three rounds of barcoding as "R1p, B1, B2", which
       are the pool-and-splits between them. Records start at column 0 with
       {id:", so split on that and ask each one what shape it wears. */
    for (const rec of src.split(/\n(?=\{id:")/)) {
      const id = /^\{id:"([^"]+)"/.exec(rec);
      if (id && new RegExp('shape:"' + shape + '"').test(rec.split(/\n\}/)[0]))
        out.push(m.id + ":" + id[1]);
    }
  }
  return out;
}

/* ============================================================
   TWO JOBS, NOT ONE
   "Edit visual" asks for a new drawing of a station that exists: the shape file
   changes and nothing else. "Add a module" asks for a station that does not
   exist, in a named gap — and that is a change to the DATA file as well, which
   is a different job with different ways to go wrong. It gets its own brief.
   ============================================================ */
function insertTask(p, map) {
  const at = p.insert || {};
  const where = at.beforeLabel
    ? `between ${at.afterLabel} and ${at.beforeLabel}`
    : `at the end of the row, after ${at.afterLabel}`;
  const dataFile = map.data.split("/").pop();
  return `A request has come in from the ${"/" + map.id} map's own "Add a module" button.
Somebody wants a NEW STATION on the row, ${where}. Carry it out.

WHAT THEY ASKED FOR
${p.text}

WHERE IT GOES
  after   ${at.afterLabel}   (node id ${at.afterId})
  ${at.beforeId ? `before  ${at.beforeLabel}   (node id ${at.beforeId})`
                 : `before  nothing — this is the new end of the row`}

THIS IS NOT A REDRAW. A new station is four changes and the drawing is only one
of them. Do all four or the map ends up with a shape nothing wears, or a node
standing on top of its neighbour.

1. THE NODE, in ${map.data}
   Add a record to NODES, positioned in the array where it belongs in reading
   order. It needs: a unique id, a key, a group, a shape, a name, x, y, w, d, h,
   and a sub. Copy the field order and the voice from the records either side.
   - y is the row constant the others on this lane use.
   - x IS SEED ORDER ONLY. layoutRows() throws it away and recomputes it. Give
     it a value between its two neighbours' x so it SORTS into the right place,
     and do not try to make it the real position — it is not.
   - THE KEY IS A SUFFIX, NOT A RENUMBER. If it lands between B3 and B4 it is
     "B3a". Do NOT renumber B4 onward: thirteen of these stations are lifted
     verbatim from pipeline-data.js so the two maps stay diffable, the keys are
     part of what is lifted, and the prose cross-references them by key.
     Renumbering to make room is a re-write of the whole row to add one thing.
   - group: take the group of the station it follows, unless the request plainly
     puts it in the next one.

2. THE PROSE — and this is the one that matters most
   does / built / cond are claims about a real laboratory protocol on a real
   instrument. YOU DO NOT KNOW THEM. Write does/built from what the request
   actually says and nothing more; if the request does not say, write the short
   true thing rather than a plausible long one. Never copy a neighbour's built:
   text and adjust it — that invents a manual section number, and this file's
   whole discipline is that every claim is traceable.
   Add the new key to the UNVERIFIED set in ${dataFile}. It is a station somebody
   asked for, not one read off an artefact, and the map says so out loud.

3. THE TRACKS, in ${map.data}
   ${at.beforeId
     ? `EDGES currently has {a:"${at.afterId}", b:"${at.beforeId}", kind:...}.
   REPLACE that one edge with two:
     {a:"${at.afterId}", b:"<new id>", kind:<the same kind>}
     {a:"<new id>", b:"${at.beforeId}", kind:<the same kind>}
   Keep the kind it had unless the request is explicitly about a change of
   material — the kind is what the dots on the track are carrying.`
     : `Add one edge {a:"${at.afterId}", b:"<new id>", kind:<the kind the last
   edge on the row uses>}. Nothing follows it.`}
   The row must stay a single unbroken chain. check-rows.mjs asserts no edge
   spans two rows and every lane reads one way; it does not assert the chain is
   whole, so read EDGES and confirm it yourself.

4. THE ROOM IT NEEDS — do NOT do this arithmetic by hand
   layoutRows() re-spaces a lane to fill its own x0..x1 span, scaling every gap
   by one factor. So you do not move the stations after the new one along: you
   GROW THE LANE, and the engine re-places everything. Grow it by the wrong
   amount and nothing looks broken — the row still fills the span — but all the
   existing gaps quietly resize, which is a re-layout of the whole row, and it
   is invisible in a diff.

   Run this and it will tell you the exact numbers, and prove they leave every
   existing gap where it is:

     node scripts/pipeline_lane.mjs --map ${map.id} --after ${at.afterId} --w <the width you chose>

   Apply the LANES x1 and BANDS x1 it prints. Its "k stays" line must say every
   existing gap is unchanged; if it does not, the width or the gap is wrong, not
   the tool. Update the comment above LANES to name the new station and what it
   cost, the way the existing note accounts for C5 — that note is how the next
   person knows the span was grown rather than guessed.

5. THE DRAWING, in public/pipeline/pipeline-shapes.js
   A new station gets a NEW shape function — never point it at a shape another
   node already wears. Add drawX(g, n) and register DRAW.x = drawX. Everything
   in the shape rules below applies to it, in particular reading every dimension
   off n.w / n.d / n.h.

THE INDEX AND THE STRIP UPDATE THEMSELVES. Both are built from NODES at load, so
there is nothing to add there, and adding something is how they end up listing a
station twice.

`;
}

function task(p, map) {
  if (p.kind === "insert" && p.insert && p.insert.afterId)
    return insertTask(p, map) + tail(p, map);
  const t = p.target;
  /* qualified by map, because the same id exists on both — /pipeline's R1p and
     the bench's R1p are two different nodes wearing one shape, and an agent told
     to leave "R1p" alone would not know which. */
  const me = map.id + ":" + (t ? t.id : "");
  const also = t ? sharers(t.shape).filter((x) => x !== me) : [];
  return `A request has come in from the ${"/" + map.id} map's own "Edit visual" button. Carry it out.

THE REQUEST
${p.text}

${t ? `THE TARGET
The person had "${t.key} · ${t.name}" selected — node id ${t.id}, currently drawn by
DRAW.${t.shape}.
${also.length ? `
DO NOT EDIT DRAW.${t.shape}. ${also.length + 1} nodes wear that shape — ${[map.id + ":" + t.id].concat(also).join(", ")}
— so rewriting it changes every one of them,
and the request is about one. Write a NEW shape function instead and point this one
node at it:
  1. add drawSomething(g, n) to public/pipeline/pipeline-shapes.js and register it
     as DRAW.something = drawSomething
  2. change ONLY node ${t.id}'s shape: field, in ${map.data}, to "something"
The other nodes keep the shape they have and must look exactly as they do now.`
: `That shape is worn by this node alone, so editing DRAW.${t.shape} in
public/pipeline/pipeline-shapes.js changes this node and nothing else. Either edit it
in place or replace it with a new registered shape — whichever is cleaner.`}`
     : `THE TARGET
Nothing was selected, so work out from the request which step is meant. If it is
genuinely ambiguous, do not guess — stop and explain, and do not commit.`}

${tail(p, map)}`;
}

/* THE HALF BOTH JOBS SHARE. Where the files are, the rules that hold for any
   change to them, how to verify, and how to ship. A redraw and an insertion
   differ entirely in what they ask for and not at all in what they are allowed
   to touch or what has to pass before it lands — and when this text lived only
   inside the redraw brief, the obvious way to add a second job was to copy it,
   which is how one of the two ends up quietly missing a rule. */
function tail(p, map) {
  return `WHERE THINGS ARE — you may touch ${map.dirs.join(" and ")} and nothing else
  pipeline-iso.js     the isometric projection and shared primitives. Do not change.
  pipeline-shapes.js  every drawing. This is almost certainly the file to edit.
  ${map.data.split("/").pop()}${" ".repeat(Math.max(1,18-map.data.split("/").pop().length))}this map's nodes, edges, lanes, prose, OFFSETS and TEXT.
                      EVERY MAP SHARES pipeline-shapes.js and pipeline-view.js, so a
                      drawing added for one is loaded by all of them. That is the point,
                      and it is why the verify list below runs the big map's suite even
                      for a change made on a bench.
  pipeline-view.js    assembly and interaction.
  index.html          the page shell and all CSS.
Load order is iso -> shapes -> data -> view, as plain classic scripts sharing one
scope. There is no build step and no bundler.

RULES, all of them load-bearing
- Never merge these files back into one, and never add a dependency or a build step.
- Never replace the hand-rolled projection in pipeline-iso.js with a library.
- Never change label geometry in pipeline-view.js, and do not touch MIRROR, ROWS,
  GAP_MINOR or GAP_MAJOR. They were tuned over many iterations and interact.
- Colours come from CSS custom properties — var(--fg), var(--water), SKIN.* and so
  on. Never write a hex value into a shape.
- A new shape is a function drawX(g, n) registered as DRAW.x = drawX.
- Anything that animates registers a ticker: TICKERS.push((dt, now, k) => ...).
  Never start your own requestAnimationFrame loop.
- Anything the ticker will move must still be BORN somewhere: give every element
  real coordinates when you create it, even if it starts invisible. An element
  with no cx/cy (or points, or x/y) sits at the SVG origin, and the selection
  halo is a CSS filter whose region is the group's bounding box — so one loose
  circle stretches the halo across the map. validate.js fails on this.
- EVERY DIMENSION A SHAPE DRAWS MUST BE READ OFF n.w, n.d AND n.h. Not a world
  constant that happens to look right beside them: write n.x + n.w*0.5, never
  n.x + 0.30. A resize is the one edit that redraws a shape, so a hardcoded
  number draws correctly at exactly the size the node is authored and comes
  apart the moment somebody drags a corner — the body grows and the part on
  constants stays put, at its old size, in its old place. That shipped once and
  was reported as "the vial didn't move and the pipette didn't grow". If part of
  the shape is authored in screen pixels (a glyph, a tip, a needle), it cannot
  scale by reading w, so scale it by being scaled: put it in a group carrying
  scale(n.w / <the width it was drawn for>). validate.js draws every node at its
  own size and again at double and fails any shape whose points come out at
  identical coordinates both times.
- Positions are world units. P(x, y, z) projects them. S = 42 px per unit.
- Keep the existing comment voice: explain why, not what.

SOMEBODY IS WAITING ON THIS. The request was made from the page and that page is
showing a progress pill until you finish, so keep the change tight and shippable
rather than opening it out into a redesign. Do the thing that was asked.

VERIFY, in this order, and do not skip any of it
${map.verify.map((c) => "  " + c).join("\n")}
If a harness cannot start because a module is missing: npm install --no-save playwright jsdom
(install BOTH in one command — with --no-save, a second install replaces the first).
Every one of those passes on a clean tree right now, so a failure is yours. If any
fails, fix the cause; do not commit failing work and do not "fix" a check by
loosening it. Nothing under public/ is compiled by Next, so npx next build cannot
tell you anything about a shape and costs minutes the person is watching tick by —
only run it if you changed something outside public/.
You have a shell for exactly these — node, npx, git, cd, ls, cat, grep, sed and
build.sh. Nothing else is available, so do not plan around anything else.

THEN SHIP IT
Commit only files under ${map.dirs.join(" and ")} and push to main. Vercel deploys from main. Do not touch anything
else in the repo. Do not revert or amend other people's commits.

Write the commit message in the style of the recent history: a short subject in the
imperative, then a body explaining why, wrapped at about 74 columns.

If you decide the request cannot be done safely, do not commit — just explain why,
and say so clearly in your final message.`;
}

function runClaude(prompt) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY; // takes precedence over the claude.ai login, and is dry
    /* acceptEdits auto-approves file edits and nothing else, so a headless run
       stalls the moment it needs a shell — which is immediately, because it is
       required to verify before committing. The allowlist is the commands the
       task actually needs. It is not a security boundary (this daemon already
       grants "commit and push to main") but it does keep an odd request from
       casually reaching for the network or for anything outside the repo. */
    const TOOLS = ["Edit", "Write", "Read", "Glob", "Grep",
                   "Bash(node:*)", "Bash(npx:*)", "Bash(git:*)", "Bash(cd:*)",
                   "Bash(ls:*)", "Bash(cat:*)", "Bash(grep:*)", "Bash(sed:*)",
                   "Bash(./build.sh)", "Bash(public/pipeline/build.sh)"];
    const child = spawn("claude",
      ["-p", prompt, "--permission-mode", "acceptEdits", "--model", MODEL,
       "--allowedTools", ...TOOLS],
      { cwd: REPO, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const kill = setTimeout(() => { child.kill("SIGKILL"); }, TIMEOUT);
    child.on("close", (code) => { clearTimeout(kill); resolve({ code, out, err }); });
    child.on("error", (e) => { clearTimeout(kill); resolve({ code: -1, out, err: String(e) }); });
  });
}

const recent = [];
function overRate() {
  const cut = Date.now() - 3600_000;
  while (recent.length && recent[0] < cut) recent.shift();
  return recent.length >= MAX_PER_HOUR;
}

async function handle(map, p) {
  log(`--- [${map.id}] ${p.id}  ${p.target ? p.target.key + " · " + p.target.name : "no target"}`);
  log(`    "${p.text.replace(/\s+/g, " ").slice(0, 140)}"`);

  if (overRate()) {
    log(`    over ${MAX_PER_HOUR}/hour — dropping`);
    await move(map, p.id, "dropped", `More than ${MAX_PER_HOUR} requests in an hour; this one was not run.`);
    return;
  }
  recent.push(Date.now());

  // start clean, so "did anything ship" is an honest question
  let dirty = "";
  try { dirty = sh(`git status --porcelain -- ${SCOPE(map)}`); } catch {}
  if (dirty) {
    /* Somebody is working in the repo. That is not this request's fault and it
       is usually over in minutes, so hold it in the queue rather than throwing
       it away — the page keeps showing it as waiting. Only give up if the tree
       has been busy for long enough that nobody is coming back to it. */
    const held = Date.now() - p.at;
    log(`    working tree is dirty — holding ${p.id} in the queue (${Math.round(held / 60000)}m)`);
    if (held > 20 * 60_000) {
      await move(map, p.id, "queued");   // clear "working" if we ever set it
      await move(map, p.id, "dropped", "Somebody was working in the repo for twenty minutes; send it again.");
    }
    return;
  }
  const before = head();
  if (!(await claim(map, p.id))) {
    log(`    ${p.id} was claimed by somebody else — leaving it to them`);
    return;
  }

  if (DRY) {
    log("    --dry, not running claude");
    await move(map, p.id, "dropped", "Daemon is in dry mode.");
    return;
  }

  const t0 = Date.now();
  const { code, out, err } = await runClaude(task(p, map));
  const secs = Math.round((Date.now() - t0) / 1000);
  const tail = (out || err || "").trim().split("\n").slice(-6).join(" ").slice(0, 700);
  log(`    claude exited ${code} after ${secs}s`);

  let after = before, pushed = false;
  try {
    after = head();
    sh("git fetch -q origin main");
    pushed = sh("git rev-list --count origin/main..HEAD") === "0";
  } catch (e) { log("    git check failed: " + e.message); }

  if (after === before) {
    /* Nothing shipped — but the run may have left a half-written file behind,
       and a dirty tree blocks every request after it. Keep the work as a patch
       (the first timeout killed a finished drawing, which was worth having) and
       put the tree back. */
    let left = "";
    try { left = sh(`git status --porcelain -- ${SCOPE(map)}`); } catch {}
    if (left) {
      const patch = path.join(LOGDIR, `${p.id}.patch`);
      try {
        appendFileSync(patch, sh(`git diff -- ${SCOPE(map)}`));
        sh(`git checkout -- ${SCOPE(map)}`);
        log(`    left the tree dirty — kept it at ${patch} and reset`);
      } catch (e) { log("    could not clear the tree: " + e.message); }
    }
    const why = code === null
      ? `It ran past the ${Math.round(TIMEOUT / 60000)}-minute limit and was stopped` +
        (left ? ", with unfinished work kept on the instance" : "") + "."
      : (tail || "Nothing was changed. See the daemon log.");
    log("    nothing committed");
    await move(map, p.id, "dropped", why);
    return;
  }
  if (!pushed) {
    log("    committed but not pushed — pushing");
    try { sh("git push -q origin main"); pushed = true; }
    catch (e) { log("    push failed: " + e.message); }
  }
  if (!pushed) {
    await move(map, p.id, "dropped", "The change was committed here but could not be pushed.");
    return;
  }

  const subject = sh("git log -1 --pretty=%s");
  log(`    shipped: ${subject}`);
  await move(map, p.id, "done", subject);
}

async function tick() {
  if (PRINT) {
    for (const map of MAPS) {
      let rows = []; try { rows = (await api(map)).prompts || []; } catch { continue; }
      const p = rows.filter((r) => r.status === "queued").sort((a, b) => a.at - b.at)[0];
      if (!p) { console.log(`\n=== ${map.id}: nothing queued ===`); continue; }
      console.log(`\n=== ${map.id} · ${p.id} · ${p.target ? p.target.key + " " + p.target.name : "no target"} ===\n`);
      console.log(task(p, map));
    }
    return;
  }
  for (const map of MAPS) await tickOne(map);
}
async function tickOne(map) {
  let rows;
  try { rows = (await api(map)).prompts || []; }
  catch (e) { log(`${map.id} queue unreachable: ` + e.message); return; }
  const queued = rows.filter((r) => r.status === "queued").sort((a, b) => a.at - b.at);
  for (const p of queued) {
    try { await handle(map, p); }
    catch (e) {
      log("handler blew up: " + e.message);
      try { await move(map, p.id, "dropped", "The daemon errored: " + e.message); } catch {}
    }
  }
}

log(`watching ${MAPS.map((m) => m.queue).join(" + ")} every ${EVERY / 1000}s  ·  model ${MODEL}  ·  repo ${REPO}` +
    (DRY ? "  ·  DRY" : "") + (ONCE ? "  ·  once" : ""));
await tick();
if (!ONCE) for (;;) {
  await new Promise((r) => setTimeout(r, EVERY));
  await tick();
}
