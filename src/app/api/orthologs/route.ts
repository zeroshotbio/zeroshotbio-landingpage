import "server-only";
export const runtime = "nodejs";

import path from "path";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";

/* Type sent to the client */
type Edge = {
  zebrafish_id: string;
  human_id: string;
  orthology_type:
    | "ortholog_one2one"
    | "ortholog_one2many"
    | "ortholog_many2one"
    | "ortholog_many2many";
  confidence: number;        // 0‒1
  validated: boolean;
};

export async function GET() {
  try {
    /* 1 ─ read the full-dataset JSON under /public/data */
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "orthologs_114.json"
    );

    const raw = await fs.readFile(filePath, "utf-8");
    const rawData = JSON.parse(raw);

    /* 2 ─ accumulate edges and build id→index maps */
    const fishIdx = new Map<string, number>();
    const humanIdx = new Map<string, number>();
    const edges: Edge[] = [];

    for (const row of rawData) {
      const z = row.zebrafish_id as string;
      const h = row.human_id as string;

      if (!fishIdx.has(z)) fishIdx.set(z, fishIdx.size);
      if (!humanIdx.has(h)) humanIdx.set(h, humanIdx.size);

      const rawConf = row.confidence as number;

      edges.push({
        zebrafish_id: z,
        human_id: h,
        orthology_type: row.orthology_type,
        confidence: rawConf > 1 ? rawConf / 100 : rawConf, // guard 0–100 input
        validated: Boolean(row.zfin_validated),
      });
    }

    /* 3 ─ simple counts for the side panel */
    const counts = edges.reduce<Record<string, number>>((acc, e) => {
      acc[e.orthology_type] = (acc[e.orthology_type] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json(
      {
        fishGenes: Array.from(fishIdx.keys()),
        humanGenes: Array.from(humanIdx.keys()),
        edges,
        counts,
      },
      { headers: { "Cache-Control": "s-maxage=3600" } } // cache 1 h on Vercel edge
    );
  } catch (error) {
    console.error("orthologs API:", error);
    return NextResponse.json(
      { error: "Failed to load ortholog data" },
      { status: 500 }
    );
  }
}
