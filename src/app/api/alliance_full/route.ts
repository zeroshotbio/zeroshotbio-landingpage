// src/app/api/alliance_full/route.ts
import "server-only";
import path from "path";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";

export async function GET() {
  // absolute path to …/public/data/alliance_full.json
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "alliance_full.json"
  );

  const json = await fs.readFile(filePath, "utf-8");

  return NextResponse.json(JSON.parse(json), {
    headers: { "Cache-Control": "s-maxage=3600" },
  });
}
