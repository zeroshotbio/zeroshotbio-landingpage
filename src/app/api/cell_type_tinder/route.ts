// src/app/api/cell_type_tinder/route.ts
//
// Persistence for "Cell Type Tinder" — expert binning of predicted<->GT label pairs.
// Stored in the existing zeroshot_dataroom_visitor_tracking DynamoDB table under
// id = "tinder::<user>" (one row per rater) to avoid provisioning a new table.
// Mirrors the minifin_annotation pattern: client owns the verdicts map and POSTs the
// full state each save, so resume is trivial and there are no merge races.

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

// Both experts rate the SAME pairs independently — inter-rater agreement is the point.
const USERS = ["patrick", "harsha"];
const idFor = (user: string) => `tinder::${user.toLowerCase()}`;
const isAllowedUser = (u: string | null) =>
  !!u && USERS.includes(u.toLowerCase());

type Verdict = { bucket: number | "unsure"; note?: string; ts: number };
type VerdictMap = Record<string, Verdict>;

async function loadUser(user: string): Promise<{
  verdicts: VerdictMap;
  n_decided: number;
  updated_at: number | null;
}> {
  const resp = await ddbClient.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ id: idFor(user) }),
    })
  );
  if (!resp.Item) return { verdicts: {}, n_decided: 0, updated_at: null };
  const it = unmarshall(resp.Item);
  let verdicts: VerdictMap = {};
  if (it.state_json) {
    try {
      verdicts = JSON.parse(String(it.state_json));
    } catch {}
  }
  return {
    verdicts,
    n_decided: Object.keys(verdicts).length,
    updated_at: it.updated_at ? Number(it.updated_at) : null,
  };
}

// GET ?user=patrick          -> that rater's verdicts map + progress (for resume)
// GET ?action=progress       -> {user: {n_decided, updated_at}} for both raters
// GET ?action=export         -> text/csv of all raters' verdicts (expert_verdicts.csv)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "progress") {
      const out: Record<string, { n_decided: number; updated_at: number | null }> = {};
      await Promise.all(
        USERS.map(async (u) => {
          const { n_decided, updated_at } = await loadUser(u);
          out[u] = { n_decided, updated_at };
        })
      );
      return NextResponse.json({ success: true, progress: out });
    }

    if (action === "export") {
      const rows: string[] = ["pair_id,rater,bucket,note,timestamp"];
      for (const u of USERS) {
        const { verdicts } = await loadUser(u);
        for (const [pid, v] of Object.entries(verdicts)) {
          const note = (v.note || "").replace(/"/g, '""');
          const ts = new Date(v.ts).toISOString();
          rows.push(`${pid},${u},${v.bucket},"${note}",${ts}`);
        }
      }
      return new NextResponse(rows.join("\n") + "\n", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="expert_verdicts.csv"',
        },
      });
    }

    const user = url.searchParams.get("user");
    if (!isAllowedUser(user)) {
      return NextResponse.json(
        { success: false, error: "unknown user" },
        { status: 400 }
      );
    }
    const state = await loadUser(user!);
    return NextResponse.json({ success: true, ...state });
  } catch (err) {
    console.error("GET /api/cell_type_tinder error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// POST { user, verdicts }  — verdicts = full {pair_id: {bucket, note, ts}} map.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = body?.user;
    const verdicts = body?.verdicts;
    if (!isAllowedUser(user)) {
      return NextResponse.json(
        { success: false, error: "unknown user" },
        { status: 400 }
      );
    }
    if (!verdicts || typeof verdicts !== "object") {
      return NextResponse.json(
        { success: false, error: "missing verdicts" },
        { status: 400 }
      );
    }
    const n_decided = Object.keys(verdicts).length;
    const item = {
      id: idFor(user),
      user_label: user,
      state_json: JSON.stringify(verdicts),
      n_decided,
      updated_at: Date.now(),
    };
    await ddbClient.send(
      new PutItemCommand({ TableName: TABLE_NAME, Item: marshall(item) })
    );
    return NextResponse.json({ success: true, n_decided, updated_at: item.updated_at });
  } catch (err) {
    console.error("POST /api/cell_type_tinder error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
