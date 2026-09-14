#!/usr/bin/env python3
"""Stock-stability triage for every drug on /trailmaker_UI -> public/trailmaker_UI/data/stability.json.

How likely is each drug's DMSO stock to lose potency through freeze-thaw cycles and storage time?
A QUICK TRIAGE, not a measurement: each tier is read from the molecule's chemistry (groups known to
hydrolyse as thawed DMSO takes up water, to oxidise, to open, or to change in light) and from common
handling guidance for the compound. Background on what drives loss in DMSO stocks:
  Kozikowski et al. 2003, J Biomol Screen 8:205 and 8:210 (room-temperature storage; freeze-thaw)
  Cheng et al. 2003, J Biomol Screen 8:292 (water uptake, temperature and time in DMSO)
Most library compounds survive freeze-thaw well; water uptake and time matter more, and the labile
chemotypes below are the usual exceptions. Nothing here was measured on the MegaFin / MiniFin stocks.

Tiers:  low = robust  ·  some = some risk  ·  high = likely to lose potency
Usage:  python3 scripts/trailmaker_stability.py   (checks every drug on the page is rated)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, "..", "public", "trailmaker_UI", "data"))

R = {
    "17-AAG KOS953": ("high", "Benzoquinone ansamycin: the quinone is redox-labile and light-sensitive."),
    "Abiraterone": ("low", "Stable steroid scaffold (the free drug, not the acetate prodrug)."),
    "ABT-888 Veliparib": ("low", "Stable benzimidazole carboxamide."),
    "Amiodarone HCl": ("some", "Light-sensitive (photo-deiodination); otherwise stable."),
    "Amlodipine Besylate": ("some", "Dihydropyridine: light-sensitive, though slower than nifedipine."),
    "Apixaban": ("low", "Stable amide; no labile groups."),
    "Aripiprazole": ("low", "Stable; at most mild light sensitivity."),
    "Aspirin Acetylsalicylic acid": ("high", "The acetyl ester hydrolyses to salicylic acid as DMSO takes up water."),
    "Atorvastatin Calcium": ("some", "Hydroxy acid can lactonise and oxidise in solution."),
    "Axitinib": ("some", "Styryl double bond isomerises in light; poorly soluble, can fall out on thaw."),
    "Bicalutamide": ("low", "Stable anilide."),
    "BMS-708163 Avagacestat": ("low", "Stable sulfonamide."),
    "Budesonide": ("some", "Corticosteroid side chain oxidises slowly in solution."),
    "CAL-101 Idelalisib": ("low", "Stable quinazolinone."),
    "Carbamazepine": ("low", "Stable in DMSO."),
    "Carfilzomib PR-171": ("high", "Peptide epoxyketone: the epoxide warhead opens with water; made up fresh."),
    "Celecoxib": ("low", "Stable sulfonamide."),
    "Citalopram hydrobromide": ("low", "Stable."),
    "Clopidogrel": ("some", "Methyl ester hydrolyses and the thiophene oxidises in solution."),
    "Clozapine": ("low", "Stable; mild light sensitivity."),
    "Colchicine": ("some", "Light turns it into inactive lumicolchicines."),
    "Curcumin": ("high", "Degrades quickly in solution by autoxidation; light-sensitive."),
    "Cyclosporin A": ("low", "Robust cyclic peptide (can stick to plastic, which is not decay)."),
    "Dapagliflozin": ("low", "Stable C-glycoside."),
    "DAPT GSI-IX": ("some", "Dipeptide tert-butyl ester: slow hydrolysis in wet DMSO."),
    "Dexamethasone DHP": ("low", "Stable fluorinated corticosteroid."),
    "Diltiazem HCl": ("some", "Acetyl ester hydrolyses to the weaker desacetyl-diltiazem."),
    "Dinaciclib SCH727965": ("low", "Stable pyrazolopyrimidine."),
    "Diphenhydramine HCl": ("low", "Stable."),
    "Dofetilide": ("low", "Stable sulfonamide."),
    "Enalapril": ("some", "Ethyl-ester prodrug: hydrolyses and cyclises (diketopiperazine) in solution."),
    "Entinostat MS-275": ("low", "Stable benzamide."),
    "Epothilone B": ("some", "Epoxide macrolactone: sensitive to acid, water and heat."),
    "Everolimus RAD001": ("high", "Triene macrolide that oxidises in solution; supplied with antioxidant."),
    "Famotidine": ("low", "Stable in DMSO; hydrolyses only slowly in water."),
    "Finasteride": ("low", "Stable aza-steroid."),
    "Fluorouracil Adrucil": ("low", "Stable."),
    "Fluoxetine HCl": ("low", "Stable."),
    "Ganetespib STA-9090": ("low", "Resorcinol triazolone; reasonably stable in DMSO."),
    "GDC-0449 Vismodegib": ("low", "Stable."),
    "Genistein": ("low", "Isoflavone; oxidises only slowly."),
    "Glibenclamide": ("low", "Stable sulfonylurea."),
    "GSK2126458 Omipalisib": ("low", "Stable."),
    "Haloperidol HCl": ("low", "Stable; mild light sensitivity."),
    "Hydrocortisone": ("some", "21-hydroxy side chain oxidises in solution."),
    "Isoprenaline HCl": ("high", "Catecholamine: oxidises quickly in solution (turns pink, then brown)."),
    "LDE225 Erismodegib": ("low", "Stable (sonidegib)."),
    "LEE011 Ribociclib": ("low", "Stable."),
    "Leflunomide": ("some", "Isoxazole ring opens to teriflunomide with water and base."),
    "Lidocaine": ("low", "Stable amide."),
    "Loratadine": ("low", "Stable carbamate."),
    "Losartan potassium": ("low", "Stable."),
    "Lovastatin": ("some", "Lactone prodrug hydrolyses to its hydroxy acid."),
    "MDV3100 Enzalutamide": ("low", "Stable."),
    "Mercaptopurine 6-MP": ("some", "Thiol oxidises to disulfides in solution."),
    "Metformin HCl": ("low", "Stable."),
    "Metoprolol Tartrate": ("low", "Stable."),
    "MK-4827 Niraparib": ("low", "Stable."),
    "MLN2238 Ixazomib": ("high", "Boronic acid: oxidative deboronation in solution; made up fresh."),
    "Nifedipine": ("high", "Dihydropyridine that degrades within hours in light."),
    "Olanzapine": ("some", "Thienobenzodiazepine oxidises in solution."),
    "Olaparib AZD2281": ("low", "Stable."),
    "Orlistat": ("high", "The beta-lactone warhead hydrolyses with water."),
    "Paclitaxel Taxol": ("some", "Ester-rich taxane: epimerises and hydrolyses; can fall out on thaw."),
    "Palbociclib PD0332991 Isethionate": ("low", "Stable."),
    "Panobinostat": ("some", "Hydroxamic acid: slow hydrolysis in wet DMSO."),
    "Paroxetine HCl": ("low", "Stable."),
    "Pazopanib": ("low", "Stable."),
    "Pimecrolimus": ("some", "Macrolactam like tacrolimus; slow degradation in solution."),
    "Pioglitazone HCl": ("low", "Stable thiazolidinedione."),
    "Pravastatin sodium": ("some", "Hydroxy acid lactonises and isomerises, fastest in acid."),
    "Prednisone": ("low", "Stable corticosteroid."),
    "Propranolol HCl": ("low", "Stable; mild light sensitivity."),
    "Quercetin": ("high", "Polyphenol that autoxidises in DMSO and in light."),
    "R S-Atenolol": ("low", "Stable."),
    "Ramipril": ("some", "Ester prodrug: hydrolyses and cyclises (diketopiperazine) in solution."),
    "Rapamycin Sirolimus": ("high", "Macrolide that degrades in solution (ring opening, oxidation), faster warm."),
    "Resveratrol": ("some", "Light turns trans- into weaker cis-resveratrol; oxidises."),
    "Rivaroxaban": ("low", "Stable oxazolidinone."),
    "Romidepsin FK228": ("some", "Disulfide prodrug: sensitive to reducing conditions."),
    "Roscovitine Seliciclib": ("low", "Stable purine."),
    "Rucaparib AG-014699": ("low", "Stable."),
    "Sertraline HCl": ("low", "Stable."),
    "Simvastatin Zocor": ("some", "Lactone prodrug hydrolyses to its hydroxy acid."),
    "Sorafenib": ("low", "Stable urea; poorly soluble in water but fine in DMSO."),
    "Sunitinib malate": ("some", "Light-sensitive: Z/E isomerisation in solution."),
    "Tacrolimus FK506": ("some", "Macrolide: epimerises and degrades slowly in solution."),
    "Ticagrelor": ("low", "Stable."),
    "Valsartan": ("low", "Stable."),
    "Verapamil HCl": ("low", "Stable."),
    "Vinblastine sulfate": ("some", "Vinca alkaloid: sensitive to light and oxidation; kept cold."),
    "Vorinostat SAHA": ("some", "Hydroxamic acid: slow hydrolysis in wet DMSO."),
}

if __name__ == "__main__":
    drugs = set()
    for ds in ["minifin", "megafin", "megafin2"]:
        m = json.load(open(os.path.join(DATA, f"{ds}.json")))
        drugs |= {c["drug"] for c in m["conds"] if not c["control"]}
    missing, extra = sorted(drugs - set(R)), sorted(set(R) - drugs)
    assert not missing, f"unrated drugs on the page: {missing}"
    assert all(t in ("low", "some", "high") for t, _ in R.values())
    out = {
        "method": "Quick triage from each molecule's chemistry and common handling guidance; not measured on these plates.",
        "sources": ["Kozikowski et al. 2003, J Biomol Screen 8:205 and 8:210", "Cheng et al. 2003, J Biomol Screen 8:292"],
        "drugs": {d: {"tier": t, "why": w} for d, (t, w) in sorted(R.items()) if d in drugs},
    }
    json.dump(out, open(os.path.join(DATA, "stability.json"), "w"), indent=1)
    tiers = {t: sum(1 for v in out["drugs"].values() if v["tier"] == t) for t in ("low", "some", "high")}
    print(f"rated {len(out['drugs'])} drugs: {tiers}" + (f" (unused ratings: {extra})" if extra else ""))
