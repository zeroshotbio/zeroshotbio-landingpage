import pandas as pd, numpy as np, pathlib, textwrap

p = pathlib.Path("public/data/orthologs_114.parquet")
df = pd.read_parquet(p)

# ---------- 1. quick schema and memory footprint ----------
print("\n— dtypes and memory —")
print(df.info(memory_usage="deep"))

# ---------- 2. cardinalities ----------
print("\n— row count —")
print(len(df))

print("\n— unique ID counts —")
print("unique zebrafish genes :", df["zebrafish_id"].nunique())
print("unique human genes     :", df["human_id"].nunique())

# ---------- 3. value distributions ----------
print("\n— orthology_type distribution —")
print(df["orthology_type"].value_counts())

print("\n— ZFIN validation flag —")
print(df["zfin_validated"].value_counts())

print("\n— head/tail confidence statistics (already 0–100) —")
print(df["confidence"].describe(percentiles=[0.05, 0.25, 0.5, 0.75, 0.95]))

# ---------- 4. mapping multiplicity (degree) ----------
deg_z = df.groupby("zebrafish_id")["human_id"].nunique()
deg_h = df.groupby("human_id")["zebrafish_id"].nunique()

print("\n— zebrafish gene degree (→ human genes) —")
print(deg_z.describe())

print("\n— human gene degree (← zebrafish genes) —")
print(deg_h.describe())

# ---------- 5. duplicates & missing values ----------
print("\n— duplicated rows ? —")
print(df.duplicated().any())

print("\n— missing values per column —")
print(df.isna().sum())
