// src/app/api/molecular_edits/route.ts
//
// The saved state of the /pipeline map — position nudges and wording overrides
// authored in the page's own edit modes. Stored in the existing
// zeroshot_dataroom_visitor_tracking DynamoDB table under a single fixed id,
// so no new table is provisioned.
//
// Reads and writes are both open, deliberately. This is a preview space rather
// than a production site, and Confirm is meant to be one click — so there is no
// key on the write path. The only limits are structural: one fixed record, and
// a size cap so a payload cannot exceed what DynamoDB will store.
// If this map ever goes somewhere public, put a key back on POST.

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

const ITEM_ID = "molecular_map::edits";
const MAX_BYTES = 320_000; // DynamoDB caps an item at 400KB

// GET /api/molecular_edits → { offsets, text, at, by } or nulls if nothing saved
export async function GET() {
  try {
    const resp = await ddbClient.send(
      new GetItemCommand({ TableName: TABLE_NAME, Key: marshall({ id: ITEM_ID }) })
    );
    if (!resp.Item) return NextResponse.json({ offsets: null, text: null, at: null });
    const it = unmarshall(resp.Item);
    const doc = it.state_json ? JSON.parse(it.state_json as string) : {};
    return NextResponse.json(
      { offsets: doc.offsets ?? null, text: doc.text ?? null, at: it.updated_at ?? null },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("molecular_edits GET failed", err);
    // A read failure must never take the map down — it just falls back to the
    // tables baked into the data file.
    return NextResponse.json({ offsets: null, text: null, at: null, error: "read_failed" });
  }
}

// POST /api/molecular_edits  { offsets, text }
export async function POST(request: NextRequest) {
  let body: { offsets?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const doc = { offsets: body.offsets ?? {}, text: body.text ?? {} };
  const state_json = JSON.stringify(doc);
  if (state_json.length > MAX_BYTES)
    return NextResponse.json(
      { ok: false, error: "too_large", bytes: state_json.length, limit: MAX_BYTES },
      { status: 413 }
    );

  const updated_at = Date.now();
  try {
    await ddbClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({ id: ITEM_ID, state_json, updated_at, kind: "molecular_map_edits" }),
      })
    );
  } catch (err) {
    console.error("molecular_edits POST failed", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: updated_at, bytes: state_json.length });
}
