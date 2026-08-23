// src/app/api/bpipe_edits/route.ts
//
// The saved state of the /bioinformatics_pipe map — position nudges and
// deletions authored in the page's own Edit positions mode. Stored in the
// existing zeroshot_dataroom_visitor_tracking DynamoDB table under a single
// fixed id, so no new table is provisioned.
//
// SEPARATE ITEM_ID FROM /pipeline, AND THAT IS THE WHOLE POINT OF THIS FILE
// existing. The two maps have their own object sets and their own ids; one
// record shared between them would mean whichever page saved last erased the
// other's layout, silently, with no way to tell which had happened.
//
// Reads and writes are both open, deliberately. This is a preview space rather
// than a production site, and Save is meant to be one click — so there is no
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

// A save is read back within seconds of being written — the author reloads to
// check it took. DynamoDB's default read is eventually consistent, so that
// reload can legitimately be served the previous layout, which is
// indistinguishable from a save that never happened. Both of these say "read
// what was actually written": ConsistentRead below, and force-dynamic here so
// Next does not render this handler once at build time and serve that forever.
export const dynamic = "force-dynamic";

const ITEM_ID = "bioinformatics_pipe::edits";
const MAX_BYTES = 320_000; // DynamoDB caps an item at 400KB

// GET /api/bpipe_edits → { offsets, at } or nulls if nothing saved
export async function GET() {
  try {
    const resp = await ddbClient.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ id: ITEM_ID }),
        ConsistentRead: true,
      })
    );
    if (!resp.Item) return NextResponse.json({ offsets: null, at: null });
    const it = unmarshall(resp.Item);
    const doc = it.state_json ? JSON.parse(it.state_json as string) : {};
    return NextResponse.json(
      { offsets: doc.offsets ?? null, at: it.updated_at ?? null },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("bpipe_edits GET failed", err);
    // A read failure must never take the map down — it just falls back to the
    // table baked into the data file, or to whatever this browser is holding.
    return NextResponse.json({ offsets: null, at: null, error: "read_failed" });
  }
}

// POST /api/bpipe_edits  { offsets }
export async function POST(request: NextRequest) {
  let body: { offsets?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const doc = { offsets: body.offsets ?? {} };
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
        Item: marshall({ id: ITEM_ID, state_json, updated_at, kind: "bpipe_map_edits" }),
      })
    );
  } catch (err) {
    console.error("bpipe_edits POST failed", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: updated_at, bytes: state_json.length });
}
