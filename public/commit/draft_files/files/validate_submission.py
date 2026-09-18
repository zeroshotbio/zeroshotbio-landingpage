#!/usr/bin/env python3
"""Validate a Commit challenge submission against submission_format.v0.md.

    python validate_submission.py rubric.json answers.jsonl [zfa_menu.v1.enriched.json]

Standard library only. Prints one line per problem and exits 1 if there are any.
"""
import json, os, re, sys

CLUSTERS = [f"C{i:03d}" for i in range(1, 113)]


def load_menu(path):
    terms = {t["id"]: t for t in json.load(open(path))["terms"]}
    return terms


def ancestors(t, terms, memo={}):
    """Every is_a / part_of ancestor of t (the full DAG, all parents at every level)."""
    if t not in memo:
        out = set()
        for p in terms[t]["is_a"] + terms[t]["part_of"]:
            if p in terms:
                out |= {p} | ancestors(p, terms)
        memo[t] = out
    return memo[t]


def validate(rubric, answers, terms):
    """rubric: dict; answers: list of dicts; terms: menu id -> term. Returns a list of problems."""
    errs = []
    tiers, signals = set(rubric.get("tiers") or []), set(rubric.get("signals") or [])
    if not tiers:
        errs.append("rubric: 'tiers' must be a non-empty list")
    seen = {}
    for n, a in enumerate(answers, 1):
        cid = a.get("cluster_id")
        where = f"line {n} ({cid})"
        if cid not in CLUSTERS:
            errs.append(f"{where}: unknown cluster_id")
            continue
        if cid in seen:
            errs.append(f"{where}: duplicate of line {seen[cid]}")
        seen[cid] = n
        z = a.get("zfa_id")
        if z not in terms:
            errs.append(f"{where}: zfa_id missing or not on the menu")
        for axis, want in (("identity_zfa_id", "cell"), ("anatomy_zfa_id", "structure")):
            v = a.get(axis)
            if v is not None and (v not in terms or terms[v]["kind"] != want):
                errs.append(f"{where}: {axis} must be a menu {want} term or null")
        chain = a.get("ancestor_chain") or []
        if not chain or chain[0] != z:
            errs.append(f"{where}: ancestor_chain must start at zfa_id")
        elif z in terms:
            want = ancestors(z, terms)
            if len(chain) - 1 != len(set(chain[1:])) or set(chain[1:]) != want:
                errs.append(f"{where}: ancestor_chain must list every is_a/part_of ancestor of zfa_id exactly once "
                            f"({len(want)} expected, {len(set(chain[1:]) & want)} present)")
        c = a.get("confidence") or {}
        if not isinstance(c.get("score"), (int, float)) or not 0 <= c["score"] <= 1:
            errs.append(f"{where}: confidence.score must be a number in [0, 1]")
        if c.get("tier") not in tiers:
            errs.append(f"{where}: confidence.tier not in the rubric")
        sig = c.get("signals") or {}
        if set(sig) - signals or not all(isinstance(v, (int, float)) for v in sig.values()):
            errs.append(f"{where}: confidence.signals must use rubric signal names with numeric values")
        refs = a.get("references") or []
        keys = {r.get("key") for r in refs if isinstance(r, dict)}
        if not refs or any(not all(r.get(k) for k in ("key", "source", "id")) for r in refs):
            errs.append(f"{where}: references must be a non-empty list of {{key, source, id}}")
        ev = a.get("evidence") or ""
        cited = set(re.findall(r"\[([^\[\]]+)\]", ev))
        if not ev.strip() or not cited:
            errs.append(f"{where}: evidence must cite at least one reference as [key]")
        elif cited - keys:
            errs.append(f"{where}: evidence cites unknown reference keys {sorted(cited - keys)}")
    missing = [c for c in CLUSTERS if c not in seen]
    if missing:
        errs.append(f"missing clusters: {len(missing)} (first: {missing[0]})")
    return errs


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    menu = argv[3] if len(argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "zfa_menu.v1.enriched.json")
    rubric = json.load(open(argv[1]))
    answers = [json.loads(line) for line in open(argv[2]) if line.strip()]
    errs = validate(rubric, answers, load_menu(menu))
    for e in errs:
        print(e)
    print(f"{len(answers)} answers, {len(errs)} problems")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main(sys.argv)
