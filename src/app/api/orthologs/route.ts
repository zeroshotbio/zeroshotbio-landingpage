import "server-only";
export const runtime = "nodejs";

import path from "path";
import { ParquetReader } from "@dsnp/parquetjs";

/* Type sent to the client */
type Edge = {
  zebrafish_id: string;
  human_id: string;
  orthology_type:
    | "ortholog_one2one"
    | "ortholog_one2many"
    | "ortholog_many2many";
  confidence: number;   // 0-1
  validated: boolean;
};

export async function GET() {
  /* 1 ─ open the Parquet under /public/data */
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "orthologs_114.parquet"
  );
  const reader = await ParquetReader.openFile(filePath);
  const cursor = reader.getCursor();

  /* 2 ─ accumulate edges and build id→index maps */
  const fishIdx = new Map<string, number>();
  const humanIdx = new Map<string, number>();
  const edges: Edge[] = [];

  let row: any;
  while ((row = await cursor.next())) {
    if (!row) break; // cursor ends with null

    const z = row.zebrafish_id as string;
    const h = row.human_id as string;

    if (!fishIdx.has(z)) fishIdx.set(z, fishIdx.size);
    if (!humanIdx.has(h)) humanIdx.set(h, humanIdx.size);

    edges.push({
      zebrafish_id: z,
      human_id: h,
      orthology_type: row.orthology_type,
      confidence: (row.confidence as number) / 100, // 0-1
      validated: row.zfin_validated as boolean,
    });
  }
  await reader.close();

  /* 3 ─ simple counts for the side panel */
  const counts = edges.reduce<Record<string, number>>((acc, e) => {
    acc[e.orthology_type] = (acc[e.orthology_type] ?? 0) + 1;
    return acc;
  }, {});

  return Response.json(
    {
      fishGenes: Array.from(fishIdx.keys()),
      humanGenes: Array.from(humanIdx.keys()),
      edges,
      counts,
    },
    { headers: { "Cache-Control": "s-maxage=3600" } } // cache 1 h
  );
}
