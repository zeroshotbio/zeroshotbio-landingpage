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
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "https://www.zeroshot.bio";
const API = BASE.replace(/\/$/, "") + "/api/pipeline_prompts";
const PIPE = path.join(REPO, "public", "pipeline");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const ONCE = flag("--once");
const DRY = flag("--dry");
const EVERY = Math.max(5, Number(val("--every", 10))) * 1000;
const TIMEOUT = Math.max(60, Number(val("--timeout", 900))) * 1000;
const MODEL = val("--model", "opus");
const MAX_PER_HOUR = Number(val("--max-per-hour", 6));

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

async function api(opt) {
  const r = await fetch(opt ? API : API + "?open=1", opt || { cache: "no-store" });
  const body = await r.text();
  try { return JSON.parse(body); }
  catch { throw new Error(`queue answered HTTP ${r.status}, not JSON`); }
}
const move = (id, status, note) =>
  api({ method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status, note: note ? String(note).slice(0, 900) : undefined }) });

/* What the agent is told. The rules are the ones this map has accumulated;
   every one of them is here because breaking it broke something. */
function task(p) {
  const t = p.target;
  return `A request has come in from the /pipeline map's own "Edit visual" button. Carry it out.

THE REQUEST
${p.text}

${t ? `THE TARGET
The person had "${t.key} · ${t.name}" selected. Its drawing is the function registered as DRAW.${t.shape} in public/pipeline/pipeline-shapes.js — find it by searching for "DRAW.${t.shape}" and work backwards to the function. Its data lives in the NODES entry with id "${t.id}" in public/pipeline/pipeline-data.js.`
     : `THE TARGET
Nothing was selected, so work out from the request which step is meant. If it is genuinely ambiguous, do not guess — stop and explain, and do not commit.`}

WHERE THINGS ARE — all under ${PIPE}
  pipeline-iso.js     the isometric projection and shared primitives. Do not change.
  pipeline-shapes.js  every drawing. This is almost certainly the file to edit.
  pipeline-data.js    the nodes, edges, lanes, prose, OFFSETS and TEXT tables.
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
- Positions are world units. P(x, y, z) projects them. S = 42 px per unit.
- Keep the existing comment voice: explain why, not what.

SOMEBODY IS WAITING ON THIS. The request was made from the page and that page is
showing a progress pill until you finish, so keep the change tight and shippable
rather than opening it out into a redesign. Do the thing that was asked.

VERIFY, in this order, and do not skip any of it
  node scripts/pipeline_test/validate.js     structure, every shape renders, no orphans
  node scripts/pipeline_test/runview.js      runs all four files and drives every
                                             ticker for 2400 frames; must print no FAIL
  REDUCE=1 node scripts/pipeline_test/runview.js   the same, with the browser asking
                                             for reduced motion; must print no FAIL
  node scripts/pipeline_test/realdom.js      loads the real page in jsdom and checks it
                                             animates and the camera moves; must exit 0.
                                             If jsdom is missing: npm install --no-save jsdom
  cd public/pipeline && ./build.sh           regenerates the standalone artifact
Only if you changed something OUTSIDE public/pipeline, also run `npx next build`.
Nothing under public/pipeline is compiled by Next, so that build cannot tell you
anything about a shape and costs minutes the person is watching tick by.
If any of those fail, fix the cause. Do not commit failing work.
You have a shell for exactly these — node, npx, git, cd, ls, cat, grep, sed and
build.sh. Nothing else is available, so do not plan around anything else.

THEN SHIP IT
Commit only files under public/pipeline (plus scripts/pipeline_test if you genuinely
had to touch it) and push to main. Vercel deploys from main. Do not touch anything
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

async function handle(p) {
  log(`--- ${p.id}  ${p.target ? p.target.key + " · " + p.target.name : "no target"}`);
  log(`    "${p.text.replace(/\s+/g, " ").slice(0, 140)}"`);

  if (overRate()) {
    log(`    over ${MAX_PER_HOUR}/hour — dropping`);
    await move(p.id, "dropped", `More than ${MAX_PER_HOUR} requests in an hour; this one was not run.`);
    return;
  }
  recent.push(Date.now());

  await move(p.id, "working");

  // start clean, so "did anything ship" is an honest question
  let dirty = "";
  try { dirty = sh("git status --porcelain -- public/pipeline scripts"); } catch {}
  if (dirty) {
    log("    working tree is dirty — refusing to run on top of it");
    await move(p.id, "dropped", "The repo had uncommitted changes; the request was not run.");
    return;
  }
  const before = head();

  if (DRY) {
    log("    --dry, not running claude");
    await move(p.id, "dropped", "Daemon is in dry mode.");
    return;
  }

  const t0 = Date.now();
  const { code, out, err } = await runClaude(task(p));
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
    log("    nothing committed");
    await move(p.id, "dropped", tail || "Nothing was changed. See the daemon log.");
    return;
  }
  if (!pushed) {
    log("    committed but not pushed — pushing");
    try { sh("git push -q origin main"); pushed = true; }
    catch (e) { log("    push failed: " + e.message); }
  }
  if (!pushed) {
    await move(p.id, "dropped", "The change was committed here but could not be pushed.");
    return;
  }

  const subject = sh("git log -1 --pretty=%s");
  log(`    shipped: ${subject}`);
  await move(p.id, "done", subject);
}

async function tick() {
  let rows;
  try { rows = (await api()).prompts || []; }
  catch (e) { log("queue unreachable: " + e.message); return; }
  const queued = rows.filter((r) => r.status === "queued").sort((a, b) => a.at - b.at);
  for (const p of queued) {
    try { await handle(p); }
    catch (e) {
      log("handler blew up: " + e.message);
      try { await move(p.id, "dropped", "The daemon errored: " + e.message); } catch {}
    }
  }
}

log(`watching ${API} every ${EVERY / 1000}s  ·  model ${MODEL}  ·  repo ${REPO}` +
    (DRY ? "  ·  DRY" : "") + (ONCE ? "  ·  once" : ""));
await tick();
if (!ONCE) for (;;) {
  await new Promise((r) => setTimeout(r, EVERY));
  await tick();
}
