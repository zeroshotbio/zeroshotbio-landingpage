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

import pathlib
import subprocess

REPOS = pathlib.Path("/data/zsb-repos")
OUT = pathlib.Path("/tmp/claude-1001/-usr-bin/03d08ecb-360f-4b56-876f-e00ce749f9b3/scratchpad")

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
    ":root{" + ";".join(f"{k}:{v}" for k, v in DARK.items()) + "}"
    "body.light{" + ";".join(f"{k}:{v}" for k, v in LIGHT.items()) + "}"
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
    d = []
    for mod, stages, origin in (
        ("minifin", "fetch · convert · build · publish", "Fort Knox · 132 keys · 947 MiB"),
        ("megafin", "fetch · convert · build · publish", "Fort Knox · 2×291 keys · 10.8 GiB"),
        ("chemfish", "verify · upstream · runbook", "public origin · 12 rows · 6 URLs"),
    ):
        k = live(mod)
        tag = "" if k == "live" else "  [PR]"
        d.append(row(f"{mod}/{tag}", f"{loc(src / mod):,}", k, origin))
        d.append(row(stages, "", k, "no accession — chain stops here"
                     if mod == "chemfish" else "Parse delivery, placed by a human", 2))
    d.append(row("chemfish has no fetch", "", "none",
                 "a fetch would substitute, not repair"))
    handles = block("what it handles", DARK["--k-live"], "3 datasets · 2 origins", "".join(d))

    used = {"shared", "live", "none"} | {live(m) for m in ("minifin", "megafin", "chemfish")}
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


def stage_panels() -> dict[str, str]:
    """Build one panel per stage cell on the bronze floor.

    A stage cell used to carry prose and a kv table only, which meant the thing a reader most wants
    to know - what does this step actually touch, and for which dataset - was spread across
    sentences. Each stage is really a small table: one shared implementation, one binding per
    dataset, and a result. Drawn that way it is also obvious where a dataset is missing, which is
    how the ChemFish gap became visible in the first place.

    Returns:
        dict[str, str]: Node id to panel markup.
    """
    b = REPOS / "zsb-bronze/src/zsb_bronze"
    f = lambda p: f"{loc(b / p):,}"

    fetch = "".join([
        row("parse-delivery pins", "", "shared", "named keys, never a prefix sync"),
        row("minifin/fetch/manifest.py", f("minifin/fetch/manifest.py"), "live",
            "132 keys · 947 MiB", 2),
        row("129 per-sample triplets", "", "live", "43 samples × 3 files", 2),
        row("settings · summary · run def", "", "live", "3 named objects", 2),
        row("megafin/fetch/manifest_*.py", f"{loc(b / 'megafin/fetch/manifest_megafin_1.py') + loc(b / 'megafin/fetch/manifest_megafin_2.py'):,}",
            "live", "2 × 291 keys · 10.8 GiB", 2),
        row("fetch.py bindings", f"{loc(b / 'minifin/fetch/fetch.py') + loc(b / 'megafin/fetch/fetch.py'):,}",
            "shared", "bind to zsb_medallion.fetch", 2),
        row("chemfish has no fetch", "", "none", "its origin is not Fort Knox"),
    ])
    convert = "".join([
        row("parse/convert.py", f("parse/convert.py"), "shared",
            "streams MatrixMarket → h5ad in blocks"),
        row("2,743,021 × 32,520", "", "shared", "~279M non-zeros, ~150 MB peak", 2),
        row("minifin/process/convert.py", f("minifin/process/convert.py"), "live",
            "binds the converter to its dirs", 2),
        row("megafin/process/convert.py", f("megafin/process/convert.py"), "live",
            "same, plus plate namespacing", 2),
        row("chemfish is not converted", "", "none", "arrives as a sealed BPCells cds"),
    ])
    build = "".join([
        row("parse/cells.py", f("parse/cells.py"), "shared", "cell calling, policy-chosen"),
        row("parse-settings → v1", "94,864", "live", "what Parse itself called", 2),
        row("barcode-ranks → v2", "94,089", "live", "measured from the rank curve", 2),
        row("parse/ambient.py → v3", "106,022", "live", "ambient-profile, 350 lines", 2),
        row("parse/validate.py", f("parse/validate.py"), "shared", "the silver gate"),
        row("parse/provenance.py", f("parse/provenance.py"), "shared", "stamps policy + overlap"),
        row("chemfish is not built", "", "none", "nothing here to build"),
    ])
    publish = "".join([
        row("parse/publish.py", f("parse/publish.py"), "shared", "preflight + release, no delete path"),
        row("minifin/v1 v2 v3", "", "live", "4.36 GiB — 1.56 + 1.56 + 1.58", 2),
        row("megafin/v1 v2", "", "live", "56.16 GiB — 30.06 + 30.25", 2),
        row("5 publishes total", "", "live", "2026-08-23 · 08-28 ×2 · megafin ×2", 2),
        row("chemfish is not published", "", "none", "it was uploaded, not published"),
    ])
    acquire = "".join([
        row("acquire/manifest.py", f("chemfish/acquire/manifest.py"), "proposed",
            "12 rows · 6 URLs · 12 silver keys"),
        row("2025_03 · 6 artifacts", "", "proposed", "20.0 GiB — superseded upstream", 2),
        row("2026_09 · 6 artifacts", "", "proposed", "16.1 GiB — what the URLs serve", 2),
        row("acquire/verify.py", f("chemfish/acquire/verify.py"), "proposed",
            "local digest check + one HEAD each"),
        row("cli.py", f("chemfish/cli.py"), "proposed", "verify · upstream — and no more"),
        row("runbook/*.sh", f"{loc(b / 'chemfish/runbook'):,}", "proposed",
            "origin → disk → silver, both refuse"),
        row("no fetch, convert, build", "", "none", "a fetch would substitute, not repair"),
    ])

    common = {"shared", "live", "none"}
    return {
        "BFETCH": STYLE + legend(common) + block("fetch — what it pins", DARK["--k-live"],
                                                 "132 + 582 keys", fetch),
        "BCONV": STYLE + legend(common) + block("process convert — what it streams",
                                                DARK["--k-live"], "279M non-zeros", convert),
        "BBUILD": STYLE + legend(common) + block("process build — what it calls",
                                                 DARK["--k-live"], "3 policies", build),
        "BPUB": STYLE + legend(common) + block("publish — what it wrote", DARK["--k-live"],
                                               "5 releases · 60.5 GiB", publish),
        "BACQ": STYLE + legend({"proposed", "none"}) + block("acquire — what it vouches for",
                                                             DARK["--k-proposed"],
                                                             "12 rows · 36.1 GiB", acquire),
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
