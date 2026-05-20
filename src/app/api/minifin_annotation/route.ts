// src/app/api/minifin_annotation/route.ts
//
// Per-user annotation state for the MiniFin cluster annotation wizard.
// Stored in the existing zeroshot_dataroom_visitor_tracking DynamoDB table
// under id = "minifin_annot::<user>" to avoid provisioning a new table.

import { NextRequest, NextResponse } from "next/server";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  BatchGetItemCommand,
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
  process.env.AWS_DYNAMODB_TABLE_NAME ||
  "zeroshot_dataroom_visitor_tracking";

const USERS = ["patrick", "darien", "steven", "creighton", "harsha"];
const idFor = (user: string) => `minifin_annot::${user.toLowerCase()}`;

function isAllowedUser(u: string | null) {
  if (!u) return false;
  return USERS.includes(u.toLowerCase());
}

// GET /api/minifin_annotation?user=patrick           → that user's saved state (or null)
// GET /api/minifin_annotation?action=progress        → {user: {n_decided, updated_at}} for all users
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "progress") {
      const cmd = new BatchGetItemCommand({
        RequestItems: {
          [TABLE_NAME]: {
            Keys: USERS.map((u) => marshall({ id: idFor(u) })),
            ProjectionExpression: "id, n_decided, updated_at, user_label",
          },
        },
      });
      const resp = await ddbClient.send(cmd);
      const items = resp.Responses?.[TABLE_NAME] ?? [];
      const out: Record<string, { n_decided: number; updated_at: number | null }> = {};
      for (const u of USERS) {
        out[u] = { n_decided: 0, updated_at: null };
      }
      for (const raw of items) {
        const it = unmarshall(raw);
        const user = String(it.id).replace("minifin_annot::", "");
        out[user] = {
          n_decided: Number(it.n_decided ?? 0),
          updated_at: it.updated_at ? Number(it.updated_at) : null,
        };
      }
      return NextResponse.json({ success: true, progress: out });
    }

    const user = url.searchParams.get("user");
    if (!isAllowedUser(user)) {
      return NextResponse.json(
        { success: false, error: "unknown user" },
        { status: 400 }
      );
    }
    const cmd = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ id: idFor(user!) }),
    });
    const resp = await ddbClient.send(cmd);
    if (!resp.Item) {
      return NextResponse.json({ success: true, state: null });
    }
    const it = unmarshall(resp.Item);
    // state_json is stored as a JSON-encoded string to keep DDB schema flat
    let state: any = null;
    if (it.state_json) {
      try { state = JSON.parse(String(it.state_json)); } catch {}
    }
    return NextResponse.json({
      success: true,
      state,
      n_decided: Number(it.n_decided ?? 0),
      updated_at: it.updated_at ? Number(it.updated_at) : null,
    });
  } catch (err) {
    console.error("GET /api/minifin_annotation error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/minifin_annotation  body: { user, state }
//   state = { lastIndex, decisions: {clusterId: {...}}, ...whatever the wizard hands us }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = body?.user;
    const state = body?.state;
    if (!isAllowedUser(user)) {
      return NextResponse.json(
        { success: false, error: "unknown user" },
        { status: 400 }
      );
    }
    if (!state || typeof state !== "object") {
      return NextResponse.json(
        { success: false, error: "missing state" },
        { status: 400 }
      );
    }

    const n_decided =
      state.decisions && typeof state.decisions === "object"
        ? Object.keys(state.decisions).length
        : 0;

    const item = {
      id: idFor(user),
      user_label: user,
      state_json: JSON.stringify(state),
      n_decided,
      updated_at: Date.now(),
    };
    await ddbClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(item),
      })
    );
    return NextResponse.json({
      success: true,
      n_decided,
      updated_at: item.updated_at,
    });
  } catch (err) {
    console.error("POST /api/minifin_annotation error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
