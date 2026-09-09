/* What the Edit-visual daemon does with a repo, tested against a real one.
 *
 *   node scripts/pipeline_test/daemon.js
 *
 * The daemon's job is to turn a queued request into a commit on main, and the
 * ways it goes wrong are all about the TREE it runs in rather than about the
 * drawing: it used to run in the shared checkout, where a person's uncommitted
 * work stopped it dead and its own work could be swept into their commit. That
 * is now a worktree per run, and this harness is the thing that says so — it
 * builds a throwaway repo with its own origin, leaves a dirty file lying in it
 * on purpose, stands a fake queue in front of the daemon and a fake `claude`
 * behind it, and then asks the only questions that matter: did the commit reach
 * origin/main, was the person's work left alone, and was the checkout cleaned
 * up afterwards.
 *
 * `claude` is stubbed because none of this is about what the model writes. The
 * stub commits (or does not) exactly the way a run does, which is the whole of
 * what the daemon reads.
 */
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const { execFileSync, spawn } = require("child_process");

const DAEMON = path.join(__dirname, "..", "pipeline_daemon.mjs");
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "daemon-test-"));
const ORIGIN = path.join(ROOT, "origin.git");
const REPO = path.join(ROOT, "repo");
const BIN = path.join(ROOT, "bin");
const WORK = path.join(ROOT, "work");

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
let failures = 0, checks = 0;
function ok(cond, what) {
  checks++;
  if (cond) console.log("  ok   " + what);
  else { failures++; console.log("  FAIL " + what); }
}

/* ---- the world ---------------------------------------------------------- */
function build() {
  fs.mkdirSync(BIN, { recursive: true });
  fs.mkdirSync(path.join(REPO, "public", "pipeline"), { recursive: true });
  fs.mkdirSync(path.join(REPO, "public", "molecular_pipe"), { recursive: true });
  fs.mkdirSync(path.join(REPO, "scripts", "pipeline_test"), { recursive: true });
  /* the one thing the daemon must never delete: it links this into every
     worktree rather than copying 719 MB, and a recursive remove that follows
     the link instead of unlinking it would take the real one with it */
  fs.mkdirSync(path.join(REPO, "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(REPO, "node_modules", "SENTINEL"), "do not delete\n");
  fs.writeFileSync(path.join(REPO, ".gitignore"), "node_modules\n.pipeline-daemon/\n");
  fs.writeFileSync(path.join(REPO, "README.md"), "out of scope\n");
  fs.writeFileSync(path.join(REPO, "public", "pipeline", "pipeline-shapes.js"), "// shapes\n");
  fs.writeFileSync(path.join(REPO, "public", "pipeline", "pipeline-data.js"), "// nodes\n");
  fs.writeFileSync(path.join(REPO, "public", "molecular_pipe", "mol-data.js"), "// bench nodes\n");
  fs.copyFileSync(DAEMON, path.join(REPO, "scripts", "pipeline_daemon.mjs"));

  git(["init", "-q", "--bare", "--initial-branch=main", ORIGIN]);
  git(["init", "-q", "--initial-branch=main"], REPO);
  git(["config", "user.email", "harness@example.com"], REPO);
  git(["config", "user.name", "harness"], REPO);
  git(["add", "-A"], REPO);
  git(["commit", "-qm", "base"], REPO);
  git(["remote", "add", "origin", ORIGIN], REPO);
  git(["push", "-q", "-u", "origin", "main"], REPO);

  fs.writeFileSync(path.join(BIN, "claude"), `#!/usr/bin/env node
/* stands in for a headless run: does what the mode says, in the cwd it is given */
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
const cwd = process.cwd();
const git = (...a) => execFileSync("git", a, { cwd, encoding: "utf8" });
const mode = process.env.FAKE_MODE || "ship";
const bench = path.join(cwd, "public", "molecular_pipe", "mol-data.js");
if (mode === "nothing") { fs.appendFileSync(bench, "// half written\\n"); process.exit(0); }
if (mode === "race") {
  /* somebody else lands on main while this run is working */
  const other = path.join(cwd, "..", "..", "other-" + Date.now());
  execFileSync("git", ["clone", "-q", process.env.TEST_ORIGIN, other]);
  execFileSync("git", ["config", "user.email", "other@example.com"], { cwd: other });
  execFileSync("git", ["config", "user.name", "other"], { cwd: other });
  fs.appendFileSync(path.join(other, "public", "pipeline", "pipeline-data.js"), "// theirs\\n");
  execFileSync("git", ["commit", "-qam", "somebody else"], { cwd: other });
  execFileSync("git", ["push", "-q", "origin", "main"], { cwd: other });
}
fs.appendFileSync(bench, "// drawn by the run\\n");
if (mode === "stray") fs.appendFileSync(path.join(cwd, "README.md"), "// reached outside\\n");
git("config", "user.email", "run@example.com");
git("config", "user.name", "run");
git("add", "-A");
git("commit", "-qm", "molecular_pipe: a drawing");
if (mode === "push") { try { git("push", "-q", "origin", "main"); } catch {} }
`);
  fs.chmodSync(path.join(BIN, "claude"), 0o755);
}

/* ---- a queue that answers like the real one ------------------------------ */
async function queue(rows, refuseClaim) {
  const state = new Map(rows.map((r) => [r.id, { ...r, status: "queued", at: Date.now() }]));
  const server = http.createServer((req, res) => {
    if (req.method === "GET") {
      const open = req.url.includes("open=1");
      const out = [...state.values()].filter((r) => !open || r.status === "queued");
      res.end(JSON.stringify({ prompts: out }));
      return;
    }
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const m = JSON.parse(body);
      const row = state.get(m.id);
      if (m.from && (refuseClaim || row.status !== m.from)) {
        res.end(JSON.stringify({ ok: false, error: "already_claimed" })); return;
      }
      row.status = m.status;
      if (m.note) row.note = m.note;
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, state, port: server.address().port };
}

/* NOT spawnSync. The queue the daemon is about to read is served from THIS
   process, and a synchronous child blocks the event loop that would answer it:
   the daemon then sits out its whole timeout on a fetch nobody can reply to,
   which reads exactly like the daemon hanging. */
function runDaemon(port, mode) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath,
      [path.join(REPO, "scripts", "pipeline_daemon.mjs"), "--once", "--map", "molecular_pipe"],
      { cwd: REPO,
        env: { ...process.env, BASE: `http://127.0.0.1:${port}`, PIPELINE_WORKROOT: WORK,
               FAKE_MODE: mode, TEST_ORIGIN: ORIGIN, PATH: BIN + ":" + process.env.PATH } });
    let stdout = "", stderr = "";
    /* DEBUG=1 streams the daemon's own log as it runs — the only way to see
       where it stopped when it never gets as far as answering. */
    const echo = (tag) => (d) => { if (process.env.DEBUG) process.stdout.write(tag + d); };
    child.stdout.on("data", (d) => (stdout += d)); child.stdout.on("data", echo("  | "));
    child.stderr.on("data", (d) => (stderr += d)); child.stderr.on("data", echo("  ! "));
    const kill = setTimeout(() => child.kill("SIGKILL"), 60000);
    child.on("close", () => { clearTimeout(kill); resolve({ stdout, stderr }); });
    child.on("error", (error) => { clearTimeout(kill); resolve({ error, stdout, stderr }); });
  });
}

const row = (id) => ({ id, text: "draw something", kind: "edit",
                       target: { id: "CAP", key: "B8", name: "Capture", shape: "capture" } });

async function scenario(name, mode, rows, check) {
  console.log("\n" + name);
  const q = await queue(rows);
  const r = await runDaemon(q.port, mode);
  if (r.error) { failures++; console.log("  FAIL daemon did not run: " + r.error.message); }
  if (process.env.DEBUG) console.log((r.stdout || "") + (r.stderr || ""));
  q.server.close();
  check(q.state, r);
  /* true after every scenario, whatever it did */
  ok(!fs.existsSync(WORK) || fs.readdirSync(WORK).length === 0, "no worktree left behind");
  ok(fs.existsSync(path.join(REPO, "node_modules", "SENTINEL")), "node_modules survived");
  ok(git(["worktree", "list"], REPO).split("\n").length === 1, "no stale worktree record");
}

(async function main() {
  build();
  const originHead = () => git(["rev-parse", "main"], ORIGIN);
  const benchOn = (ref) => git(["show", ref + ":public/molecular_pipe/mol-data.js"], ORIGIN);

  /* THE ONE THAT USED TO FAIL. A person's uncommitted work sits in the repo for
     the whole of this scenario; the run must ship anyway and must not touch it. */
  console.log("\n--- a person is working in the repo the whole time ---");
  const MINE = path.join(REPO, "public", "pipeline", "pipeline-shapes.js");
  fs.appendFileSync(MINE, "// half-finished, uncommitted, mine\n");

  let base = originHead();
  await scenario("ship, with the repo dirty", "ship", [row("p1")], (state) => {
    ok(state.get("p1").status === "done", "prompt is done");
    ok(originHead() !== base, "a commit reached origin/main");
    ok(/drawn by the run/.test(benchOn("main")), "the drawing is in it");
    ok(fs.readFileSync(MINE, "utf8").includes("mine"), "the person's edit is untouched");
    ok(git(["status", "--porcelain"], REPO).includes("public/pipeline/pipeline-shapes.js"),
       "and still uncommitted — the run did not sweep it up");
    ok(!git(["log", "-1", "--name-only", "--pretty=", "main"], ORIGIN).includes("pipeline-shapes"),
       "the commit does not contain it");
  });

  base = originHead();
  await scenario("a commit outside the map's directories is refused", "stray", [row("p2")], (state) => {
    ok(state.get("p2").status === "dropped", "prompt is dropped");
    ok(/README\.md/.test(state.get("p2").note || ""), "and says which file: " + state.get("p2").note);
    ok(originHead() === base, "nothing reached origin/main");
    ok(fs.existsSync(path.join(REPO, ".pipeline-daemon", "p2-out-of-scope.patch")), "the work is kept as a patch");
  });

  base = originHead();
  await scenario("a run that commits nothing keeps what it wrote", "nothing", [row("p3")], (state) => {
    ok(state.get("p3").status === "dropped", "prompt is dropped");
    ok(originHead() === base, "nothing reached origin/main");
    ok(fs.existsSync(path.join(REPO, ".pipeline-daemon", "p3.patch")), "the half-written file is kept");
  });

  base = originHead();
  await scenario("main moves while the run works", "race", [row("p4")], (state) => {
    ok(state.get("p4").status === "done", "prompt is done");
    const log = git(["log", "--pretty=%s", base + "..main"], ORIGIN);
    ok(/somebody else/.test(log) && /a drawing/.test(log), "both commits are on main: " + log.replace(/\n/g, " + "));
    ok(/drawn by the run/.test(benchOn("main")), "the drawing survived the rebase");
  });

  base = originHead();
  await scenario("the agent pushing the wrong ref does not matter", "push", [row("p5")], (state) => {
    ok(state.get("p5").status === "done", "prompt is done");
    ok(/drawn by the run/.test(benchOn("main")), "the daemon's HEAD:main push landed it");
  });

  /* A row another daemon wins must cost this one nothing — no checkout, and no
     slot out of the hourly budget, which is what it used to spend before it
     asked. The row still reads queued; the claim is what comes back refused. */
  console.log("\nsomebody else's row");
  base = originHead();
  const q = await queue([row("p6")], true);
  const r6 = await runDaemon(q.port, "ship");
  q.server.close();
  ok(/claimed by somebody else/.test(r6.stdout || ""), "the daemon stood down");
  ok(!/worktree \//.test(r6.stdout || ""), "no checkout was made for it");
  ok(originHead() === base, "and nothing was pushed");
  ok(!fs.existsSync(WORK) || fs.readdirSync(WORK).length === 0, "no worktree left behind");

  console.log(`\n${checks - failures}/${checks} checks pass`);
  if (failures) { console.log("FAILURES: " + failures); process.exit(1); }
  console.log("the daemon runs in its own tree and leaves the repo alone");

})();
