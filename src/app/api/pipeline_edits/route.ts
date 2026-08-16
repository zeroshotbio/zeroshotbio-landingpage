// src/app/api/pipeline_edits/route.ts
//
// The saved state of the /pipeline map — position nudges and wording overrides
// authored in the page's own edit modes. Stored in the existing
// zeroshot_dataroom_visitor_tracking DynamoDB table under a single fixed id,
// so no new table is provisioned.
//
// Reads are public: the map fetches this on load so a confirmed change is the
// new default for everyone, not just for the browser that made it.
// Writes need a key. /pipeline is NOT behind the Basic-Auth middleware, so an
// unguarded POST here would let anyone rewrite the page. PIPELINE_EDIT_KEY is
// the dedicated one; KASPEROV_BASIC_PASSWORD is accepted as well so the tool
// works with the password that is already set. With neither configured this
// route refuses to write at all rather than defaulting open.

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

const ITEM_ID = "pipeline_map::edits";
const MAX_BYTES = 320_000; // DynamoDB caps an item at 400KB

// Length, not timing, is the only thing a mismatch is allowed to leak.
function sameSecret(given: string, want: string) {
  if (given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}
function keyAccepted(given: string | null) {
  const keys = [process.env.PIPELINE_EDIT_KEY, process.env.KASPEROV_BASIC_PASSWORD]
    .filter((k): k is string => !!k && k.length > 0);
  if (!keys.length) return "not_configured" as const;
  if (!given) return "missing" as const;
  return keys.some((k) => sameSecret(given, k)) ? "ok" : "bad";
}

// GET /api/pipeline_edits → { offsets, text, at, by } or nulls if nothing saved
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
    console.error("pipeline_edits GET failed", err);
    // A read failure must never take the map down — it just falls back to the
    // tables baked into the data file.
    return NextResponse.json({ offsets: null, text: null, at: null, error: "read_failed" });
  }
}

// POST /api/pipeline_edits  { offsets, text }  with header x-edit-key
export async function POST(request: NextRequest) {
  const verdict = keyAccepted(request.headers.get("x-edit-key"));
  if (verdict === "not_configured")
    return NextResponse.json(
      { ok: false, error: "not_configured",
        detail: "Set PIPELINE_EDIT_KEY in the Vercel project to enable saving." },
      { status: 503 }
    );
  if (verdict !== "ok")
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

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
        Item: marshall({ id: ITEM_ID, state_json, updated_at, kind: "pipeline_map_edits" }),
      })
    );
  } catch (err) {
    console.error("pipeline_edits POST failed", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: updated_at, bytes: state_json.length });
}
