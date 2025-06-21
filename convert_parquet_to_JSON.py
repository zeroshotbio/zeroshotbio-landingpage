#!/usr/bin/env python3
"""
Convert ZSTD-compressed parquet to JSON for Next.js compatibility
"""

import pandas as pd
import json
from pathlib import Path


def convert_parquet_to_json():
    # Paths
    parquet_path = "public/data/orthologs_114.parquet"
    json_path = "public/data/orthologs_114.json"

    print(f"Reading {parquet_path}...")

    try:
        # Read the parquet file
        df = pd.read_parquet(parquet_path)
        print(f"Loaded {len(df)} rows")
        print(f"Columns: {list(df.columns)}")

        # Convert to records format (list of objects)
        records = df.to_dict("records")

        # Write to JSON
        print(f"Writing to {json_path}...")
        with open(json_path, "w") as f:
            json.dump(records, f, indent=2)

        print(f"✅ Successfully converted to {json_path}")
        print(f"File size: {Path(json_path).stat().st_size / 1024 / 1024:.1f} MB")

    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nTry installing required dependencies:")
        print("pip install pandas pyarrow fastparquet")


if __name__ == "__main__":
    convert_parquet_to_json()
