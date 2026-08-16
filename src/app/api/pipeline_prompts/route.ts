// src/app/api/pipeline_prompts/route.ts
//
// A queue between the /pipeline map and whoever is working on it on the EC2
// box. The page posts "make the aquarium do X"; the instance reads the queue,
// writes the shape code, and marks the entry done; the page is watching its own
// entry and reloads itself the moment that happens.
//
// Stored as one record in the existing zeroshot_dataroom_visitor_tracking
// DynamoDB table, holding the most recent prompts. Open, like the edits route:
// this is a preview space, not a production site.
//
// From the instance:
//   node scripts/pipeline_queue.mjs list
//   node scripts/pipeline_queue.mjs claim <id>
//   node scripts/pipeline_queue.mjs done  <id> "what changed"

import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const TABLE_NAME =
  process.env.AWS_DYNAMODB_TABLE_NAME || "zeroshot_dataroom_visitor_tracking";

const ITEM_ID = "pipeline_map::prompts";
const KEEP = 40; // the queue is a working log, not an archive
const MAX_PROMPT = 4000;

export type PromptStatus = "queued" | "working" | "done" | "dropped";
export interface PromptRow {
  id: string;
  text: string;
  target: { id: string; key: string; name: string; shape: string } | null;
  status: PromptStatus;
  at: number;
  updated: number;
  note?: string;
}

async function load(): Promise<PromptRow[]> {
  const resp = await ddbClient.send(
    new GetItemCommand({ TableName: TABLE_NAME, Key: marshall({ id: ITEM_ID }) })
  );
  if (!resp.Item) return [];
  const it = unmarshall(resp.Item);
  try {
    const rows = JSON.parse((it.state_json as string) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function save(rows: PromptRow[]) {
  await ddbClient.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall({
        id: ITEM_ID,
        state_json: JSON.stringify(rows.slice(0, KEEP)),
        updated_at: Date.now(),
        kind: "pipeline_map_prompts",
      }),
    })
  );
}

// GET /api/pipeline_prompts            → every row, newest first
// GET /api/pipeline_prompts?id=<id>    → just that one (what the page polls)
// GET /api/pipeline_prompts?open=1     → only what still needs doing
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const one = url.searchParams.get("id");
    const openOnly = url.searchParams.get("open");
    let rows = await load();
    if (one) rows = rows.filter((r) => r.id === one);
    else if (openOnly) rows = rows.filter((r) => r.status === "queued" || r.status === "working");
    return NextResponse.json({ prompts: rows }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("pipeline_prompts GET failed", err);
    return NextResponse.json({ prompts: [], error: "read_failed" });
  }
}

// POST /api/pipeline_prompts
//   { text, target? }                     → queue a new prompt, returns its id
//   { id, status, note? }                 → move one along (the instance)
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  let rows: PromptRow[];
  try {
    rows = await load();
  } catch (err) {
    console.error("pipeline_prompts load failed", err);
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
  }

  const now = Date.now();

  // a status move, from whoever is doing the work
  if (typeof body.id === "string" && typeof body.status === "string") {
    const row = rows.find((r) => r.id === body.id);
    if (!row) return NextResponse.json({ ok: false, error: "no_such_prompt" }, { status: 404 });
    const status = body.status as PromptStatus;
    if (!["queued", "working", "done", "dropped"].includes(status))
      return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
    row.status = status;
    row.updated = now;
    if (typeof body.note === "string") row.note = body.note.slice(0, 2000);
    try {
      await save(rows);
    } catch (err) {
      console.error("pipeline_prompts save failed", err);
      return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, prompt: row });
  }

  // a new prompt, from the page
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const row: PromptRow = {
    id: "p" + now.toString(36) + Math.random().toString(36).slice(2, 7),
    text: text.slice(0, MAX_PROMPT),
    target: (body.target as PromptRow["target"]) ?? null,
    status: "queued",
    at: now,
    updated: now,
  };
  rows.unshift(row);
  try {
    await save(rows);
  } catch (err) {
    console.error("pipeline_prompts save failed", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, prompt: row, queued: rows.filter((r) => r.status === "queued").length });
}
