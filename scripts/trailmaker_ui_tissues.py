"""Coarse tissue groups for the /trailmaker_UI heatmap.

The DanioType MegaFin labelling gives 123 consolidated cell-type nodes and no tissue axis (its 21
compartments are unnamed clustering blocks). This maps each node to one of a dozen tissues by the
words in its label, with explicit overrides for the labels a keyword would misfile. It is a
PROVISIONAL display grouping for filtering the page, not an ontology call; the page says so.

Patterns are regular expressions matched on whole-word starts: substring matching filed
"post-mitotic" under ear (otic) and "secreting" under eye (retin).
"""
import re

# Checked in order; the first rule with a pattern found in the lower-cased label wins.
RULES = [
    ("Unresolved", [r"unresolved tissue", r"heat-shock", r"mesenchymal/ecm-associated cell — subtype-unresolved"]),
    ("Blood & immune", [r"\berythr", r"red blood", r"\bmacrophage", r"\bneutrophil", r"\bblood\b"]),
    ("Pigment", [r"\bmelanophore", r"\bxanthophore", r"\biridophore", r"\bpigment cell"]),
    ("Ear", [r"\botic\b"]),
    ("Kidney", [r"\bpronephr", r"\bpodocyte"]),
    ("Endocrine", [r"\bendocrine tissue", r"\bthyroid", r"\bstannius", r"\blactotroph"]),
    ("Gut & liver", [r"\bintestin", r"\bhepat", r"\bliver\b"]),
    ("Vasculature", [r"\bvascular endothelial"]),
    ("Neural", [r"\bpineal"]),
    ("Eye", [r"\bretin", r"\blens\b", r"\bphotoreceptor", r"\brpe\b"]),
    ("Muscle & heart", [r"\bskeletal muscle", r"\bmyocyte", r"\bcardiomyocyte", r"\bmuscle cell"]),
    ("Neural", [r"\bneur", r"\bglia", r"\bradial", r"brain", r"\bspinal", r"\bthalam", r"\bhabenul",
                r"\bhypothal", r"\btelenceph", r"\bdienceph", r"\bpallial", r"\bsubpallial", r"\bfloor plate",
                r"\broof plate", r"\bpurkinje", r"\bganglion", r"\bisthmic", r"\bchoroid plexus", r"\bcns\b",
                r"\brohon-beard", r"\bneural"]),
    ("Epidermis & epithelia", [r"\bperiderm", r"\bepiderm", r"\bkeratinocyte", r"\bionocyte", r"\bmucous",
                               r"\bhatching gland", r"\bchemosensory", r"\bmulticiliated", r"\bepitheli"]),
    ("Mesenchyme & skeleton", [r"mesenchyme", r"\bfibroblast", r"\btenocyte", r"\bchondrocyte", r"\bconnective",
                               r"\bnotochord", r"\bhypochord", r"\bstroma"]),
]
RULES = [(t, [re.compile(p) for p in pats]) for t, pats in RULES]

# Labels where the first matching pattern would be wrong.
OVERRIDES = {
    "visceral mesenchyme / early intestinal smooth muscle progenitors": "Gut & liver",
    "anterior segment mesenchyme (periocular mesenchyme) progenitors": "Mesenchyme & skeleton",
    "vascular-associated mesenchyme / perivascular stroma": "Mesenchyme & skeleton",
    "enteric neural crest / early enteric neuron progenitor": "Neural",
    "neural crest-derived tissue": "Neural",
    "otp/sim1-positive hypothalamic neuroendocrine precursor neurons": "Neural",
    "posterior ciliated epithelial/ventral-rod-associated population — subtype-unresolved": "Epidermis & epithelia",
}

ORDER = ["Neural", "Eye", "Epidermis & epithelia", "Pigment", "Muscle & heart",
         "Mesenchyme & skeleton", "Blood & immune", "Vasculature", "Gut & liver", "Kidney",
         "Endocrine", "Ear", "Unresolved"]


def tissue_of(label: str) -> str:
    if label in OVERRIDES:
        return OVERRIDES[label]
    low = label.lower()
    for tissue, pats in RULES:
        if any(p.search(low) for p in pats):
            return tissue
    return "Unresolved"
