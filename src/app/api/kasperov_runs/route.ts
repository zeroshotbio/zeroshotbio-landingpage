// src/app/api/kasperov_runs/route.ts
//
// Server-side store for completed daniotype_kasperov runs, so a finished run
// (labels + ground-truth scores + metadata) can be reloaded later — across
// devices/browsers — for compare-and-contrast across models.
//
// Storage: the full run JSON goes to S3 (no 400KB item limit); a small metadata
// row per dataset is kept in the existing DynamoDB table for fast listing.
//   - POST  body=<run JSON>            → save (S3 put + index update) → {runId}
//   - GET   ?dataset=<id>              → list run metadata (newest first)
//   - GET   ?dataset=<id>&id=<runId>   → the full run JSON from S3
//
// Requires KASPEROV_RUNS_BUCKET (+ the AWS_* creds the app already uses).
// Degrades to {error:"not_configured"} when the bucket env var is unset.

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION;
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE_NAME || "zeroshot_dataroom_visitor_tracking";
const BUCKET = process.env.KASPEROV_RUNS_BUCKET || "";

const ddb = new DynamoDBClient({
  region: REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
});
const s3 = new S3Client({
  region: REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
});

const indexId = (datasetId: string) => `daniotype_runs::${datasetId}`;
const s3Key = (datasetId: string, runId: string) => `daniotype/${datasetId}/${runId}.json`;
const MAX_INDEX = 200; // cap the per-dataset index (newest kept)

type RunMeta = {
  runId: string;
  dataset: string;
  datasetId: string;
  model: string;
  costUsd: number;
  costEstimated: boolean;
  exportedAt: string;
  scoredAt: string | null;
  nLabelled: number;
  nValidated: number;
  hasGroundTruth: boolean;
  s3Key: string;
  source?: string; // "browser" | "server"
};

async function readIndex(datasetId: string): Promise<RunMeta[]> {
  const resp = await ddb.send(new GetItemCommand({ TableName: TABLE_NAME, Key: marshall({ id: indexId(datasetId) }) }));
  if (!resp.Item) return [];
  const it = unmarshall(resp.Item);
  return Array.isArray(it.runs) ? (it.runs as RunMeta[]) : [];
}

async function writeIndex(datasetId: string, runs: RunMeta[]) {
  await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: marshall({ id: indexId(datasetId), runs, updated_at: Date.now() }, { removeUndefinedValues: true }) }));
}

export async function POST(req: NextRequest) {
  if (!BUCKET) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  let run: any;
  try {
    run = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const datasetId = String(run?.datasetId || "");
  if (!datasetId || !Array.isArray(run?.clusters)) return NextResponse.json({ error: "bad_run" }, { status: 400 });

  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const key = s3Key(datasetId, runId);
  try {
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: JSON.stringify(run), ContentType: "application/json" }));
    const meta: RunMeta = {
      runId,
      dataset: String(run.dataset || datasetId),
      datasetId,
      model: String(run.model || "?"),
      costUsd: Number(run?.cost?.usd ?? 0),
      costEstimated: !!run?.cost?.estimated,
      exportedAt: String(run.exportedAt || new Date().toISOString()),
      scoredAt: run.scoredAt ?? null,
      nLabelled: Number(run.nLabelled ?? 0),
      nValidated: Number(run.nValidated ?? 0),
      hasGroundTruth: !!run.groundTruth,
      s3Key: key,
      source: typeof run.source === "string" ? run.source : "browser",
    };
    const runs = await readIndex(datasetId);
    runs.unshift(meta); // newest first
    await writeIndex(datasetId, runs.slice(0, MAX_INDEX));
    return NextResponse.json({ ok: true, runId });
  } catch (e: any) {
    return NextResponse.json({ error: "save_failed", detail: String(e?.message ?? e).slice(0, 200) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  if (!BUCKET) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const datasetId = url.searchParams.get("dataset") || "";
  const id = url.searchParams.get("id");
  if (!datasetId) return NextResponse.json({ error: "no_dataset" }, { status: 400 });

  try {
    if (id) {
      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key(datasetId, id) }));
      const body = await obj.Body!.transformToString();
      return new NextResponse(body, { status: 200, headers: { "content-type": "application/json" } });
    }
    const runs = await readIndex(datasetId);
    return NextResponse.json({ runs });
  } catch (e: any) {
    return NextResponse.json({ error: "read_failed", detail: String(e?.message ?? e).slice(0, 200) }, { status: 502 });
  }
}
