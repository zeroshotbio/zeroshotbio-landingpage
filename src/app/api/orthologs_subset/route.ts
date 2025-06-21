import "server-only";
export const runtime = "nodejs";

import path from "path";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";

/* identical Edge type to the full-data route */
type Edge = {
  zebrafish_id: string;
  human_id: string;
  orthology_type:
    | "ortholog_one2one"
    | "ortholog_one2many"
    | "ortholog_many2one"
    | "ortholog_many2many";
  confidence: number;
  validated: boolean;
};

export async function GET() {
  try {
    /* serve the 5000-edge file the script just generated */
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "orthologs_114_subset_5k.json"
    );
    const json = await fs.readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(json), {
      headers: { "Cache-Control": "s-maxage=3600" },
    });
  } catch (err) {
    console.error("orthologs_subset API:", err);
    return NextResponse.json(
      { error: "Failed to load ortholog subset" },
      { status: 500 }
    );
  }
}
