"""Generate the repo reader panels from the checked-out repositories themselves.

The S3 panels are generated from a live bucket listing so a refresh is a re-run rather than a hand
edit. The repo panels had no equivalent and drifted: the page claimed MiniFin pinned eight keys long
after the manifest had grown to 132. This reads the working copies under /data/zsb-repos, so the same
property holds on this side of the map.

Colour is the same encoding as the warehouse tree, on a palette that passes the categorical checks -
lightness band, chroma floor, CVD separation and normal-vision separation - in both themes. The one
it replaces did not: legacy magenta against pre-repo grey separated by dE 2.0 for a deutan reader,
which is no encoding at all. Steps are the reference theme's slots 1-4, and they switch on body.light
through custom properties rather than being burnt into each row.
"""

import os
import pathlib
import subprocess

REPOS = pathlib.Path("/data/zsb-repos")
# scratchpads are per-session and get cleaned up, so the output dir is overridable
OUT = pathlib.Path(os.environ.get("PANEL_OUT", "/tmp/claude-1001/-usr-bin/03d08ecb-360f-4b56-876f-e00ce749f9b3/scratchpad"))

# Reference-theme categorical slots 1-4, dark and light. Validated as a set, not picked by eye.
KINDS = [
    ("shared", "--k-shared", "Shared stage — one implementation every Parse dataset binds to"),
    ("live", "--k-live", "On main — implemented, tested, merged"),
    ("proposed", "--k-proposed", "Proposed — on a branch, awaiting review, NOT on main"),
    ("none", "--k-none", "Deliberately absent — the stage does not apply to this dataset"),
]
DARK = {"--k-shared": "#c98500", "--k-live": "#199e70", "--k-proposed": "#3987e5", "--k-none": "#d95926"}
LIGHT = {"--k-shared": "#eda100", "--k-live": "#1baf7a", "--k-proposed": "#2a78d6", "--k-none": "#eb6834"}
VAR = {k: v for k, v, _ in KINDS}

STYLE = (
    "<style>"
    # the palette itself lives in index.html, so it is defined with no panel on
    # screen and the LIGHT toggle switches it in one place
    ".rkw{margin:.3rem 0 0;font-family:var(--mono,ui-monospace,monospace);"
    "font-size:clamp(9px,calc(var(--reader-w,360px)*0.0145),12px)}"
    ".rkl{display:flex;flex-direction:column;gap:.2rem;margin:.1rem 0 .55rem;"
    "font-size:clamp(9px,calc(var(--reader-w,360px)*0.014),11.5px);color:var(--fg2)}"
    ".rkl b{display:flex;align-items:center;gap:.45rem;font-weight:400}"
    ".rkl i{width:1.9em;height:.8em;border-radius:2px;flex:0 0 auto}"
    ".rkds{border:2px solid var(--acc);border-radius:5px;overflow:hidden;margin-bottom:1rem}"
    ".rkds h5{margin:0;padding:.4em .6em;font-family:var(--sans,system-ui);font-size:1.15em;"
    "font-weight:700;color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,transparent);"
    "display:flex;justify-content:space-between;align-items:baseline;gap:.5em}"
    ".rkds h5 s{text-decoration:none;font-size:.62em;font-weight:600;opacity:.75}"
    ".rk{display:grid;grid-template-columns:minmax(0,1.25fr) 4.2em minmax(0,1.25fr);gap:0 .7em;"
    "padding:.16em .5em;line-height:1.5;border-left:3px solid var(--c);align-items:baseline;"
    "background:color-mix(in srgb,var(--c) 13%,transparent);color:var(--c)}"
    ".rk .p{white-space:pre;overflow:hidden;text-overflow:ellipsis}"
    ".rk .n{text-align:right;font-variant-numeric:tabular-nums;opacity:.85}"
    ".rk .t{font-family:var(--sans,system-ui);font-size:.88em;opacity:.6;overflow:hidden;"
    "text-overflow:ellipsis;white-space:nowrap}"
    ".rk.d1 .p{font-size:1.12em;font-weight:700}.rk.d2{opacity:.85}.rk.d2 .p{font-size:.94em}"
    ".rk.rkh{font-size:.76em;letter-spacing:.09em;text-transform:uppercase;opacity:.5;"
    "border-left-color:transparent;background:none;color:var(--fg2,#9a9a94);"
    "border-bottom:1px solid var(--rule,#2a2a2e);padding:.3em .6em}"
    "</style>"
)


def esc(t: str) -> str:
    """Escape a string for embedding inside a double-quoted JavaScript literal.

    Args:
        t (str): Raw text.

    Returns:
        str: Text safe to place inside the panel string in ds-data.js.
    """
    return t.replace("\\", "\\\\").replace('"', '\\"')


def row(path: str, num: str, kind: str, note: str, depth: int = 1) -> str:
    """Render one line of a panel tree.

    Args:
        path (str): Left column, the name.
        num (str): Middle column, already formatted.
        kind (str): One of the KINDS names; picks the colour custom property.
        note (str): Right column, what it is.
        depth (int, optional): 1 for a top-level entry, 2 for a child.

    Returns:
        str: A div, escaped for the JS literal.
    """
    pad = "├── " if depth > 1 else ""
    return (
        f'<div class=\\"rk d{depth}\\" style=\\"--c:var({VAR[kind]})\\">'
        f'<span class=\\"p\\">{esc(pad + path)}</span>'
        f'<span class=\\"n\\">{esc(num)}</span>'
        f'<span class=\\"t\\" title=\\"{esc(note)}\\">{esc(note)}</span></div>'
    )


def block(name: str, acc: str, right: str, body: str) -> str:
    """Wrap rows in a titled block.

    Args:
        name (str): Block heading.
        acc (str): Accent colour for the border and heading.
        right (str): Small right-aligned summary in the heading.
        body (str): Concatenated rows.

    Returns:
        str: The block markup, escaped for the JS literal.
    """
    return (
        f'<div class=\\"rkds\\" style=\\"--acc:{acc}\\"><h5>{esc(name)}<s>{esc(right)}</s></h5>'
        f'<div class=\\"rkw\\"><div class=\\"rk rkh\\" style=\\"--c:transparent;background:none\\">'
        f'<span>module</span><span class=\\"n\\">LOC</span><span>what it is</span></div>{body}</div></div>'
    )


def legend(used: set[str]) -> str:
    """Render the colour key for the kinds a panel actually uses.

    A legend listing categories the panel does not contain is not a key, it is noise: the reader
    scans the tree for a colour that is not there.

    Args:
        used (set[str]): Kind names appearing in this panel.

    Returns:
        str: The legend markup, escaped for the JS literal. Empty below two kinds, since a
            single-colour tree needs no key.
    """
    rows = [(v, t) for k, v, t in KINDS if k in used]
    if len(rows) < 2:
        return ""
    out = "".join(
        f'<b><i style=\\"background:linear-gradient(90deg,var({v}) 0 50%,'
        f'color-mix(in srgb,var({v}) 13%,transparent) 50%)\\"></i>{esc(t)}</b>'
        for v, t in rows
    )
    return f'<div class=\\"rkl\\">{out}</div>'


def loc(path: pathlib.Path) -> int:
    """Count lines across a module's source files.

    Args:
        path (Path): Directory to walk.

    Returns:
        int: Total lines in .py and .sh files, 0 if the directory is absent.
    """
    if not path.exists():
        return 0
    if path.is_file():
        return len(path.read_text(errors="replace").splitlines())
    total = 0
    for pattern in ("*.py", "*.sh"):
        for f in path.rglob(pattern):
            if "__pycache__" in f.parts:
                continue
            total += len(f.read_text(errors="replace").splitlines())
    return total


def git(repo: str, *args: str) -> str:
    """Run git in one of the repositories and return trimmed stdout.

    Args:
        repo (str): Repository directory name under /data/zsb-repos.
        *args (str): Arguments after `git`.

    Returns:
        str: Standard output with surrounding whitespace removed, empty on failure.
    """
    try:
        return subprocess.run(
            ["git", "-C", str(REPOS / repo), *args], capture_output=True, text=True, check=True
        ).stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def bronze_panel() -> str:
    """Build the zsb-bronze panel: what the repo runs, and what it handles.

    Two blocks, because they answer different questions. The first is the code: one shared
    implementation of the Parse stages plus the per-dataset modules that bind to it. The second is
    the custody question - which datasets this repo is responsible for and where their bytes come
    from - which is the thing the warehouse tree cannot show, because by the time bytes are in
    silver the origin is no longer visible.

    Returns:
        str: The panel markup, escaped for the JS literal.
    """
    src = REPOS / "zsb-bronze/src/zsb_bronze"
    on_main = set(git("zsb-bronze", "ls-tree", "-d", "--name-only", "origin/main", "src/zsb_bronze/").split())
    live = lambda mod: "live" if f"src/zsb_bronze/{mod}" in on_main else "proposed"

    # ---- what it runs
    b = [row("parse/", f"{loc(src / 'parse'):,}", "shared",
             "stages every Parse delivery shares")]
    for f, note in (
        ("convert.py", "MatrixMarket → h5ad, ~150 MB peak"),
        ("cells.py", "cell calling · 3 policies"),
        ("ambient.py", "the ambient-profile policy"),
        ("publish.py", "publish preflight and release"),
        ("provenance.py", "stamps what built the artifact"),
        ("validate.py", "the silver gate a release must pass"),
    ):
        n = loc(src / "parse" / f) if (src / "parse" / f).exists() else 0
        if n:
            b.append(row(f, f"{n:,}", "shared", note, 2))
    runs = block("what it runs", DARK["--k-shared"],
                 f"{loc(src / 'parse'):,} LOC shared", "".join(b))

    # ---- what it handles, and where those bytes come from
    # chemfish/ left this block on 2026-09-11: its custody branch, with the other eighteen, was
    # closed unmerged once open-source datasets got their own bucket (s3://zsb-open-source).
    d = []
    for mod, stages, origin in (
        ("minifin", "fetch · convert · build · publish", "Fort Knox · 132 keys · 947 MiB"),
        ("megafin", "fetch · convert · build · publish", "Fort Knox · 2×291 keys · 10.8 GiB"),
    ):
        k = live(mod)
        tag = "" if k == "live" else "  [PR]"
        d.append(row(f"{mod}/{tag}", f"{loc(src / mod):,}", k, origin))
        d.append(row(stages, "", k, "no accession — chain stops here"
                     if mod == "chemfish" else "Parse delivery, placed by a human", 2))
    handles = block("what it handles", DARK["--k-live"], "2 datasets · 1 origin", "".join(d))

    used = {"shared"} | {live(m) for m in ("minifin", "megafin")}
    return STYLE + legend(used) + runs + handles


def simple_panel(repo: str, pkg: str, mods: list[tuple[str, str]], acc: str, right: str) -> str:
    """Build a one-block panel for a repository with no custody story of its own.

    Args:
        repo (str): Repository directory name.
        pkg (str): Package directory under src/.
        mods (list[tuple[str, str]]): (module, note) pairs to list.
        acc (str): Accent colour.
        right (str): Heading summary.

    Returns:
        str: The panel markup, escaped for the JS literal.
    """
    src = REPOS / repo / "src" / pkg
    b = []
    for mod, note in mods:
        n = loc(src / mod)
        if n:
            b.append(row(f"{mod}/" if (src / mod).is_dir() else mod, f"{n:,}", "live", note))
    return STYLE + legend({"live"}) + block(f"{repo}", acc, right, "".join(b))


def boxes(groups: list[tuple[str, str, list[tuple[str, str]]]]) -> str:
    """Render grouped callout boxes in the reader's process style.

    The same markup the reader's default body uses - .pg / .pgh / .pgi - so a stage entry and the
    overview that lists it look like one thing rather than two. The classes and the palette live in
    index.html, so nothing here carries a colour literal.

    Args:
        groups (list[tuple[str, str, list[tuple[str, str]]]]): (heading, colour var, items), where
            each item is (name, explanation). Explanation may carry inline markup.

    Returns:
        str: The markup, escaped for the JS literal.
    """
    out = []
    for head, var, items in groups:
        out.append(f'<div class=\\"pgh\\" style=\\"--c:var({var})\\">{esc(head)}</div>')
        for name, what in items:
            out.append(
                f'<div class=\\"pgi\\" style=\\"--c:var({var})\\">'
                f'<div class=\\"pgn\\">{esc(name)}</div>'
                f'<div class=\\"pgw\\">{esc(what)}</div></div>'
            )
    return f'<div class=\\"pg\\">{"".join(out)}</div>'


def stage_panels() -> dict[str, str]:
    """Build one boxed entry per stage cell.

    Every stage answers the same two questions and they are worth separating: what it does, and what
    it refuses to do. The refusals are the half that is usually undocumented and is the reason these
    steps can be re-run without fear - a step that overwrites on a retry and a step that stops are
    indistinguishable until the day it matters.

    Returns:
        dict[str, str]: Node id to panel markup.
    """
    S, L, N, P = "--k-shared", "--k-live", "--k-none", "--k-proposed"
    return {
        "BFETCH": boxes([
            ("What it does", S, [
                ("the manifest", "132 S3File rows for MiniFin and 2 × 291 for MegaFin, each pinning a key to an exact byte count and an exact ETag. 129 of MiniFin's are the per-sample triplets - 43 samples × all_genes, cell_metadata, count_matrix - and three are settings.txt, the sample summary and the run definition."),
                ("plan_downloads", "Pairs every pinned object with its local destination and returns the plan before any byte moves, so --dry-run is a real answer rather than a rehearsal. Guards the prefix, rejects a key that escapes its root, and rejects two sources that would land on one path."),
                ("fetch_all", "Runs the plan through zsb_medallion.io.S3IO with a running byte callback. A complete local copy is skipped unless --overwrite is given, so an interrupted fetch resumes instead of restarting 947 MiB."),
                ("pins", "The same identities checked without downloading anything: one head-object per key, returning a PinDrift per object rather than a single boolean. Answers \u201cis Fort Knox still what we pinned\u201d in seconds."),
            ]),
            ("What it refuses", N, [
                ("a prefix sync", "Never syncs a prefix. minifin/ is 562 GiB and the pinned set is 947 MiB - 0.16% - because named keys are what conversion and cell-calling actually read. The rest is FASTQ and split-pipe intermediates nobody downloads."),
                ("an object that moved", "A size or ETag that disagrees with its pin stops the fetch. It will not quietly take a newer object with the same key, which is exactly how the superseded a354c053 delivery was caught."),
            ]),
        ]),
        "BCONV": boxes([
            ("What it does", S, [
                ("streams, never loads", "Parse ships one MatrixMarket triplet per sample, cell-major over a shared gene axis. Conversion appends consecutive cell blocks straight into one on-disk CSR - default 100,000 rows a block, --chunk-cells to change it - so ~279 million non-zeros across 2,743,021 × 32,520 cost ~150 MB of memory instead of tens of gigabytes."),
                ("preserves empty rows", "Block boundaries keep row alignment even where a barcode has no counts at all, so the unfiltered matrix still has one row per barcode Parse emitted. Cell calling later needs exactly that: the empty rows are the evidence."),
                ("concatenates in declared order", "Samples are concatenated in the order the dataset declares, not in whatever order the filesystem returns, so the same delivery converts to the same matrix on any machine."),
            ]),
            ("What it refuses", N, [
                ("a mismatched gene axis", "Every triplet is validated against the first: same genes, same columns, same labels. all_genes.csv.gz is byte-for-byte the same 251,854 bytes in all 43 directories but each was gzipped separately, so the ETags differ - gene identity is asserted after load rather than trusted from the pin."),
                ("a malformed triplet", "Dimensions are read from the MatrixMarket header and checked against the obs and var frames before a single entry is streamed."),
            ]),
        ]),
        "BBUILD": boxes([
            ("Three ways to call a cell", S, [
                ("parse-settings \u2014 v1", "Reads the per-sample minCellSize Parse recorded in settings.txt: the threshold Trailmaker itself applied. Reproduces the delivered population exactly - 94,864 cells, jaccard 1.0000, a set match rather than a count match. The only policy that takes Parse's answer as input."),
                ("barcode-ranks \u2014 v2", "A port of DropletUtils' barcodeRanks knee search, computing the threshold here and taking no Parse threshold at all. 94,089 cells. The R original it follows is kept at tests/reference/barcodeRanks_reference.R so the port can be re-checked against it."),
                ("ambient-profile \u2014 v3", "emptyDrops (Lun et al. 2019) with the sublibrary as the unit: pool barcodes at or under a low total into an ambient profile, score every barcode between 100 transcripts and the sublibrary inflection by log-probability under that multinomial, get a p-value from a seeded Monte Carlo null, and correct with Benjamini-Hochberg. 106,022 cells. It exists because low-yield wells have no cliff to draw a line on - there a 150-transcript ambient barcode and a 700-transcript small cell differ only in what they express."),
            ]),
            ("What else it does", S, [
                ("mandatory corrections", "The judgment-free fixes only: control and typo sample renames, recovery of the five double-loaded samples split-pipe collapsed, and the sublibrary column rename. Each is a pure frame transform so it can be tested alone."),
                ("stamps provenance", "Writes the delivery facts, code versions, the cell-count transition, the policy and the input it read, and the pinned manifest into .uns. PROVENANCE_KEYS is the vocabulary, and the validator imports that same set to check the stamp is complete."),
                ("the silver gate", "validate_silver checks obs, var, uns and the X matrix before anything is written. The schema half runs on a backed file, which is why the publish pre-flight can re-use it without loading the matrix."),
            ]),
        ]),
        "BPUB": boxes([
            ("What it does", S, [
                ("a release, not a file", "Uploads the validated h5ad, the dataset README and the changelog as one set. The ledger is rewritten last, every time, so a half-finished publish never leaves a changelog describing an artifact that is not there."),
                ("separate from the build", "The build validates and writes locally; publishing is a second, explicit act. --dry-run prints the release plan without ever constructing an S3 client."),
                ("has run five times", "minifin/v1\u2013v3 and megafin/v1\u2013v2: 60.5 GiB in silver, each version publishing its own policy's build."),
            ]),
            ("What it refuses", N, [
                ("the wrong policy", "A build stamped barcode-ranks cannot be published as the parse-settings version. All three are valid Silver artifacts so the schema check cannot tell them apart - only the .uns stamp can, and publishing the wrong one would put a population in the warehouse its own changelog describes wrongly."),
                ("a silent overwrite", "--overwrite exists for retrying a failed or abandoned publish, not for correcting a result: a corrected result is a new version. Without it, an occupied key stops the run."),
                ("a short upload", "S3ObjectExistsError, S3ObjectMismatchError, S3ShortUploadError and S3PublishPermissionError are distinct types, so a truncated transfer, an occupied key and a missing grant are never reported as the same failure."),
                ("a delete", "There is no delete path anywhere in this step."),
            ]),
        ]),
        "BACQ": boxes([
            ("What it does", P, [
                ("the custody record", "Twelve rows over six URLs: origin URL, byte count, SHA-256, silver key and upstream state, one per artifact per release. Flat across both releases rather than one table each, so the fact that the origin serves both from the same six addresses is the first thing a reader sees."),
                ("verify --release", "Holds the local package against its pins. No network. --digest reads every byte, including a 17 GB tarball, and --no-digest gives the weaker size-only answer explicitly rather than by omission."),
                ("upstream --release", "One HEAD per distinct URL, no payload, read against every release that claims it - so one response reports unchanged for the current package and superseded for the one it replaced."),
                ("runbook/", "The two scripts that actually moved the 38 GB: acquire-release.sh from the origin to disk, publish-release.sh from disk to silver. They were in /data/scratch until this branch, which meant the record of what is in silver lived in the repo and the procedure that put it there did not."),
            ]),
            ("What it does not cover", N, [
                ("ZSCAPE", "24 objects and 14.46 GiB of GEO GSE202639 went into silver on 2026-09-08 with no manifest, no verifier and no module in any repo - not written, not proposed. The acquisition ran from scripts in /data/scratch. It is the strongest argument that this stage should be shared rather than per-dataset: the generalised acquire script ran against GEO unchanged, and only discovery - how you learn the file list - differed."),
            ]),
            ("What it refuses", N, [
                ("a fetch", "There is no fetch command and there must not be one. These URLs carry no version and the origin overwrites in place - it replaced five of six artifacts on 2026-09-03 without announcement - so a fetch aimed at the archived release would substitute the current one and every result computed against those bytes would quietly stop matching its inputs."),
                ("a re-acquisition over an existing one", "acquire-release.sh refuses a non-empty destination. A directory precondition rather than a --force flag, so it cannot be waved through in a hurry."),
                ("an overwrite in silver", "publish-release.sh treats a key holding the right byte count as done and stops on one holding different bytes. It reads success from the bucket's own head-object, never from the uploader's exit status."),
                ("the authors' authority", "The SHA-256 values are ours, computed at acquisition. The origin publishes no checksum file - every candidate path returns 403 - so a passing verify proves the copy is unchanged since we took it, not that it is what the authors intended."),
            ]),
        ]),
    }


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    panels = {
        "BREPO": bronze_panel(),
        "SREPO": simple_panel(
            "zsb-silver", "zsb_silver",
            [("transform", "the shared silver→gold steps"),
             ("minifin", "binds the transform for MiniFin"),
             ("megafin", "binds the transform for MegaFin")],
            DARK["--k-live"], "reads silver · writes gold"),
        "GREPO": simple_panel(
            "zsb-gold", "zsb_gold",
            [("minifin", "release keys and the reader"),
             ("megafin", "release keys and the reader")],
            DARK["--k-live"], "reads gold · writes nothing"),
        "MED": simple_panel(
            "zsb-medallion", "zsb_medallion",
            [("io", "S3File, S3IO — the only boto3 in the architecture"),
             ("fetch", "plan_downloads, fetch_all — the shared transfer loop"),
             ("release", "the release and version contract"),
             ("card", "the ingest card model"),
             ("console", "shared console presentation")],
            DARK["--k-proposed"], "the contract all three import"),
    }
    panels.update(stage_panels())
    for node, html in panels.items():
        (OUT / f"panel_{node}.txt").write_text(html)
        print(f"{node}: {len(html):,} chars")
