import pandas as pd

df = pd.read_parquet("public/data/orthologs_114.parquet")

# core signals you will need for the visual
cols_of_interest = [
    "drerio_gene_id",  # zebrafish Ensembl ID
    "hsapiens_gene_id",  # human Ensembl ID
    "confidence",  # 0-1 score you computed
    "evidence_code",
]  # “ortholog_one2one”, “ortholog_one2many”, …

print(df.head())
print(df["evidence_code"].value_counts())
