// src/app/api/molecular_prompts/route.ts
//
// A queue between the /molecular_pipe map and whoever is working on it on the EC2
// box. The page posts "make the aquarium do X"; the instance reads the queue,
// writes the shape code, and marks the entry done; the page is watching its own
// entry and reloads itself the moment that happens.
//
// It is ALSO the record of everything ever asked for. That is the second job and
// it is the reason for the paging below: the queue is read back by the "View
// prompt history" panel, and a history that quietly forgets is worse than no
// history, because nothing on screen says which end it was trimmed from.
//
// Stored in the existing zeroshot_dataroom_visitor_tracking DynamoDB table. Open,
// like the edits route: this is a preview space, not a production site.
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

/* ============================================================
   NOTHING IS EVER DROPPED, AND THAT TAKES MORE THAN REMOVING A CAP

   This used to keep the newest 40 rows and silently discard the rest. Removing
   the slice on its own does not give you "keep everything" — it gives you
   "keep everything until the item passes 400KB", which is DynamoDB's hard
   per-item ceiling, and then every PutItem fails. That failure lands on the
   NEW prompt, not the old ones: the queue stops accepting work, which is a
   worse outcome than the trimming it replaced.

   So the record is paged. One head item holds the recent rows and is the only
   thing rewritten in normal use; when it grows past the head budget its oldest
   rows are spilled into a numbered page item, which is then never rewritten
   unless a row inside it is edited. Pages are numbered in creation order, so
   page 0 holds the oldest rows and the newest-first read is:

       head, page n-1, page n-2, … page 0

   Each item stays well under the ceiling and the number of items grows with
   use, which is the thing that is allowed to grow. At the observed rate (a few
   dozen prompts a week, a few hundred bytes each) that is one new page item
   every year or two.
   ============================================================ */
const HEAD_ID = "molecular_map::prompts";
const PAGE_ID = (n: number) => `molecular_map::prompts::p${n}`;

/* A HIGH WATER MARK AND A LOW ONE, NOT A SINGLE LINE. Spilling everything over
   one limit sounds simpler and behaves badly: the head sits exactly at the limit
   from then on, so EVERY subsequent prompt pushes one row over and writes one
   more page holding one row. A thousand prompts becomes a thousand items and the
   history panel reads all of them. So the head is allowed to grow to the high
   mark and is then cut back to the low one, spilling the difference as a single
   page — which makes a page a batch, and page writes rare (roughly one per 170
   prompts at the sizes actually being sent). */
const SPILL_AT_ROWS = 250;
const SPILL_AT_BYTES = 250_000; // the head may reach this; the ceiling is 400KB
const HEAD_ROWS = 80;
const HEAD_BYTES = 100_000; // what it is cut back to

const RECENT = 40; // what an unqualified GET answers with; ?all=1 for the record
const MAX_PROMPT = 4000;

export type PromptStatus = "queued" | "working" | "done" | "dropped";

/* WHAT KIND OF REQUEST THIS IS, and it is not cosmetic. "visual" is a new
   drawing for a station that already exists — the shape file changes and
   nothing else. "insert" adds a station to the row, which means the DATA file
   changes too: a node, two edges where there was one, and the lane and its mat
   growing to make room. The worker is told a different job for each, so the
   kind travels with the request rather than being guessed from the wording.

   Absent on every row written before insertions existed, and read as "visual"
   — which is what those all were. */
export type PromptKind = "visual" | "insert";

/* Where a new station goes, named by the two it goes between. Stored as ids
   AND as the labels that were on screen when the person clicked: the ids are
   what the worker acts on, and the labels are what the history panel shows
   long after those ids may have moved. `beforeId` is null for the end of the
   row, which is the one slot with nothing after it. */
export interface InsertAt {
  afterId: string | null;
  beforeId: string | null;
  afterLabel: string;
  beforeLabel: string | null;
}

export interface PromptRow {
  id: string;
  text: string;
  target: { id: string; key: string; name: string; shape: string } | null;
  kind?: PromptKind;
  insert?: InsertAt | null;
  status: PromptStatus;
  at: number;
  updated: number;
  note?: string;
}

function rowsOf(item: Record<string, unknown> | undefined): PromptRow[] {
  if (!item) return [];
  try {
    const rows = JSON.parse((item.state_json as string) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function getItem(id: string): Promise<Record<string, unknown> | undefined> {
  const resp = await ddbClient.send(
    new GetItemCommand({ TableName: TABLE_NAME, Key: marshall({ id }) })
  );
  return resp.Item ? unmarshall(resp.Item) : undefined;
}

/* The head, and how many pages sit behind it. An item written before paging
   existed has no `pages` field and reads as zero, which is exactly right: every
   row it holds is still in the head. */
async function loadHead(): Promise<{
  rows: PromptRow[];
  pages: number;
  strandedOpen: boolean;
  rev: number;
}> {
  const item = await getItem(HEAD_ID);
  const pages = Number(item?.pages) || 0;
  return {
    rows: rowsOf(item),
    pages,
    strandedOpen: !!item?.stranded_open,
    rev: Number(item?.rev) || 0,
  };
}

/* Every row ever kept, newest first, plus which item each page came from so a
   status move can rewrite just that one. */
async function loadAll(): Promise<{
  head: PromptRow[];
  pages: PromptRow[][];
  pageCount: number;
  strandedOpen: boolean;
  rev: number;
}> {
  const { rows, pages, strandedOpen, rev } = await loadHead();
  const older = await Promise.all(
    Array.from({ length: pages }, (_, n) => getItem(PAGE_ID(n)).then(rowsOf))
  );
  return { head: rows, pages: older, pageCount: pages, strandedOpen, rev };
}

const flatten = (s: { head: PromptRow[]; pages: PromptRow[][] }) =>
  s.head.concat(...s.pages.slice().reverse());

async function putRows(id: string, rows: PromptRow[], extra: Record<string, unknown> = {}) {
  await ddbClient.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(
        {
          id,
          state_json: JSON.stringify(rows),
          updated_at: Date.now(),
          kind: "molecular_map_prompts",
          ...extra,
        },
        { removeUndefinedValues: true }
      ),
    })
  );
}

/* ============================================================
   TWO WORKERS, ONE QUEUE

   A worker claims a prompt by moving it queued -> working, and then runs an
   agent that edits the repo and pushes to main. So a claim two workers can both
   win is not a stale-status problem: it is two agents doing one job, in one
   working tree, both pushing. That has to be impossible rather than unlikely.

   Read-modify-write over a single item is not enough on its own — both read
   "queued", both write "working", both believe they won. So the head carries a
   revision, every write to it is conditional on the revision it read, and a
   writer that lost re-reads and decides again. A claim that finds the row
   already working on the second look does not retry: it lost, and says so.

   The archive pages need none of this. They are written once and then only
   touched by a late correction to something long finished, which is not a race
   anybody is running.
   ============================================================ */
class Contended extends Error {}

async function putHead(
  rows: PromptRow[],
  extra: Record<string, unknown>,
  expectedRev: number
) {
  try {
    await ddbClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(
          {
            id: HEAD_ID,
            state_json: JSON.stringify(rows),
            updated_at: Date.now(),
            kind: "molecular_map_prompts",
            rev: expectedRev + 1,
            ...extra,
          },
          { removeUndefinedValues: true }
        ),
        /* rev 0 is the item as it was before any of this existed — it has no
           rev at all, so that is what the condition has to ask about */
        ConditionExpression: expectedRev === 0 ? "attribute_not_exists(rev)" : "rev = :r",
        ExpressionAttributeValues:
          expectedRev === 0 ? undefined : marshall({ ":r": expectedRev }),
      })
    );
  } catch (err) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException")
      throw new Contended();
    throw err;
  }
}

/* Read the head, decide, write it back — and if somebody else wrote in between,
   throw the decision away and make it again on what they left. Returning null
   from `decide` means "nothing to write", which is how a lost claim and a
   miss both get out without touching the record. */
async function withHead<T>(
  decide: (head: Awaited<ReturnType<typeof loadHead>>) =>
    Promise<{ rows: PromptRow[]; extra: Record<string, unknown>; result: T } | null>,
  tries = 12
): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    const head = await loadHead();
    const plan = await decide(head);
    if (!plan) return null;
    try {
      await putHead(plan.rows, plan.extra, head.rev);
      return plan.result;
    } catch (err) {
      if (!(err instanceof Contended)) throw err;
      /* N writers arriving together need N rounds, because each round lets
         exactly one through — so the budget is generous, and the wait is
         randomised so the losers do not all come back in step and collide
         again on the retry. Five was not enough for eight at once, and the
         failure landed on a prompt somebody had just written. */
      await new Promise((r) => setTimeout(r, 8 * i + Math.random() * 25));
    }
  }
  throw new Error("head contended");
}

const LIVE = (r: PromptRow) => r.status === "queued" || r.status === "working";

/* Below the high mark nothing moves. Above it, keep the newest rows down to the
   low mark and spill the rest as one page.

   The row floor is RECENT: an unqualified GET is answered from the head alone,
   so the head must be able to cover that window whatever the rows weigh. It is
   the floor that wins over the byte budget, which is why the budget sits well
   under the 400KB ceiling — RECENT rows of the largest prompt anyone can send
   is comfortably inside it even when the floor is what decides.

   AND AN UNFINISHED ROW DOES NOT GO IN THE ARCHIVE. ?open=1 is what the worker
   on the instance polls, every ten seconds, and it is answered from the head
   alone — so a queued row that aged past the cut would still be sitting in the
   record, still reading "queued" on the page, and invisible to the only thing
   that could draw it. That is the same silent loss the paging exists to
   prevent, wearing a different hat. So the cut is pushed back past anything
   still open: the head stays contiguous and newest-first, and it simply keeps a
   few more rows.

   The push is bounded by the high mark, because an unfinished row is not a
   promise the head will grow forever — something abandoned a year and several
   hundred prompts ago must not be able to burst the item. In that one case the
   cut wins, the row does go to the archive, and the head is stamped so the
   ?open=1 path knows to go and look for it rather than quietly answering
   without it. */
function splitHead(rows: PromptRow[]): {
  keep: PromptRow[];
  spill: PromptRow[];
  strandedOpen: boolean;
} {
  if (rows.length <= SPILL_AT_ROWS && JSON.stringify(rows).length <= SPILL_AT_BYTES)
    return { keep: rows, spill: [], strandedOpen: false };

  let bytes = 2;
  let cut = 0;
  while (cut < rows.length && cut < HEAD_ROWS) {
    const next = bytes + JSON.stringify(rows[cut]).length + 1;
    if (next > HEAD_BYTES && cut >= RECENT) break;
    bytes = next;
    cut++;
  }

  /* Push the cut back past the oldest row still open — but ALL OR NOTHING. A
     partial push lands the head exactly on the high mark, which is the state
     that makes the very next prompt spill again, one row per page, forever. So
     if every open row cannot be kept, none of the push happens: the head drops
     to the low mark as usual, pages stay batched, and the stamp below tells
     ?open=1 to go looking. */
  let want = cut;
  for (let i = rows.length - 1; i >= cut; i--) {
    if (LIVE(rows[i])) { want = i + 1; break; }
  }
  if (
    want > cut &&
    want <= SPILL_AT_ROWS &&
    JSON.stringify(rows.slice(0, want)).length <= SPILL_AT_BYTES
  )
    cut = want;

  const spill = rows.slice(cut);
  return { keep: rows.slice(0, cut), spill, strandedOpen: spill.some(LIVE) };
}

/* A page, once written, is the only copy of the rows in it — so never write over
   one. If the index is already taken (a concurrent spill got there first) take
   the next one; the reader walks every index below the count, so both survive. */
async function writeNewPage(from: number, rows: PromptRow[]): Promise<number> {
  for (let n = from; n < from + 5; n++) {
    if (await getItem(PAGE_ID(n))) continue;
    await putRows(PAGE_ID(n), rows);
    return n;
  }
  throw new Error("no free archive page index");
}

// GET /api/molecular_prompts            → the recent window, newest first
// GET /api/molecular_prompts?all=1      → every row ever kept (the history panel)
// GET /api/molecular_prompts?id=<id>    → just that one (what the page polls)
// GET /api/molecular_prompts?open=1     → only what still needs doing
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const one = url.searchParams.get("id");
    const openOnly = url.searchParams.get("open");
    const all = url.searchParams.get("all");

    /* The common calls are the poll and the queue read, and both only ever look
       at live rows — those are always in the head, so they cost one item read
       however long the record gets. Only the history panel pays for the pages. */
    if (!all && !one) {
      const head = await loadHead();
      if (!openOnly)
        return NextResponse.json(
          { prompts: head.rows.slice(0, RECENT) },
          { headers: { "cache-control": "no-store" } }
        );
      /* Normally every open row is in the head by construction, so this is one
         item read however long the record gets. The flag is only ever set by a
         spill that had to strand one, and it makes this path go and find it. */
      if (!head.strandedOpen)
        return NextResponse.json(
          { prompts: head.rows.filter(LIVE) },
          { headers: { "cache-control": "no-store" } }
        );
      const store = await loadAll();
      return NextResponse.json(
        { prompts: flatten(store).filter(LIVE) },
        { headers: { "cache-control": "no-store" } }
      );
    }

    const store = await loadAll();
    let rows = flatten(store);
    if (one) rows = rows.filter((r) => r.id === one);
    else if (openOnly) rows = rows.filter(LIVE);
    return NextResponse.json(
      { prompts: rows, total: rows.length, pages: store.pageCount },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("molecular_prompts GET failed", err);
    return NextResponse.json({ prompts: [], error: "read_failed" });
  }
}

// POST /api/molecular_prompts
//   { text, target? }                     → queue a new prompt, returns its id
//   { id, status, note? }                 → move one along (the instance)
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const now = Date.now();

  // ---- a status move, from whoever is doing the work ----
  if (typeof body.id === "string" && typeof body.status === "string") {
    const status = body.status as PromptStatus;
    if (!["queued", "working", "done", "dropped"].includes(status))
      return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });

    /* `from` is what makes a claim a claim. Without it two workers polling the
       same queue both read "queued", both write "working", and both go and do
       the job. With it, the move only applies if the row is still what the
       caller thought it was, and the loser is told so rather than being left
       believing it won. Optional, because marking something done or dropped is
       not a race and never needed it. */
    const from = typeof body.from === "string" ? (body.from as PromptStatus) : null;

    const apply = (row: PromptRow) => {
      row.status = status;
      row.updated = now;
      if (typeof body.note === "string") row.note = body.note.slice(0, 2000);
    };

    /* THE FAST PATH IS THE ONLY ONE THAT NORMALLY RUNS. Open rows are kept in
       the head by construction, and this is the call the worker makes twice per
       drawing — so with nothing stranded it is one read and one write, whatever
       the record weighs. Reading every page here would make the archive cost
       something on the hot path, for a case that is meant never to happen. */
    let lost = false, missed = false;
    let moved: PromptRow | null = null;
    try {
      moved = await withHead(async (head) => {
        lost = false; missed = false;
        if (head.strandedOpen) { missed = true; return null; }   // the slow path deals with it
        const row = head.rows.find((r) => r.id === body.id);
        if (!row) { missed = true; return null; }
        if (from && row.status !== from) { lost = true; return null; }
        apply(row);
        return {
          rows: head.rows,
          extra: { pages: head.pages, stranded_open: false },
          result: row,
        };
      });
    } catch (err) {
      console.error("molecular_prompts claim failed", err);
      return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
    }
    if (lost)
      return NextResponse.json(
        { ok: false, error: "already_claimed" },
        { status: 409 }
      );
    if (moved) return NextResponse.json({ ok: true, prompt: moved });

    /* Not in the head — either the record has a stranded open row and the head
       alone cannot be trusted, or this is a late correction to something long
       archived. Both are rare and both want every page. */
    let store;
    try {
      store = await loadAll();
    } catch (err) {
      console.error("molecular_prompts load failed", err);
      return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
    }

    /* Past here every page has been read, so whatever this move does to the
       stranded stamp can be decided for real rather than left set forever —
       otherwise one abandoned row would keep ?open=1 reading the whole record
       long after it was finished. `force` is for the caller that changed a row
       IN the head and so has to write it back regardless of the stamp. */
    const restamp = async (force: boolean) => {
      const stillStranded = store.pages.some((pg) => pg.some(LIVE));
      if (force || stillStranded !== store.strandedOpen)
        await putHead(
          store.head,
          { pages: store.pageCount, stranded_open: stillStranded },
          store.rev
        );
    };

    /* A LOST WRITE HERE IS USUALLY A LOST CLAIM, and the caller has to be able
       to tell those apart. Whoever beat us to the head very likely beat us to
       this row — so look at what they left before answering: if the row is no
       longer what this call required, the honest answer is already_claimed, the
       same one the fast path gives. "contended" is reserved for genuinely
       losing to an unrelated write, which the caller may retry. */
    const lostTo = async () => {
      const fresh = await loadHead();
      const r = fresh.rows.find((x) => x.id === body.id);
      return from && r && r.status !== from ? "already_claimed" : "contended";
    };

    const inHead = store.head.find((r) => r.id === body.id);
    if (inHead) {
      if (from && inHead.status !== from)
        return NextResponse.json({ ok: false, error: "already_claimed" }, { status: 409 });
      apply(inHead);
      try {
        await restamp(true);
      } catch (err) {
        if (err instanceof Contended)
          return NextResponse.json({ ok: false, error: await lostTo() }, { status: 409 });
        console.error("molecular_prompts save failed", err);
        return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, prompt: inHead });
    }

    for (let n = 0; n < store.pages.length; n++) {
      const row = store.pages[n].find((r) => r.id === body.id);
      if (!row) continue;
      if (from && row.status !== from)
        return NextResponse.json({ ok: false, error: "already_claimed" }, { status: 409 });
      apply(row);
      try {
        await putRows(PAGE_ID(n), store.pages[n]);
        await restamp(false);
      } catch (err) {
        if (err instanceof Contended)
          return NextResponse.json({ ok: false, error: await lostTo() }, { status: 409 });
        console.error("molecular_prompts save failed", err);
        return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, prompt: row });
    }

    return NextResponse.json({ ok: false, error: "no_such_prompt" }, { status: 404 });
  }

  // ---- a new prompt, from the page ----
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  /* An insertion is only an insertion if it says where. A row claiming the kind
     with no usable slot would reach the worker as "add a station somewhere",
     which is the one thing this flow exists to stop being — so it falls back to
     a plain visual request rather than being rejected, and the text still says
     what the person wanted. */
  const at = body.insert as InsertAt | undefined;
  const isInsert =
    body.kind === "insert" && !!at && typeof at.afterId === "string" && !!at.afterId;

  const row: PromptRow = {
    id: "p" + now.toString(36) + Math.random().toString(36).slice(2, 7),
    text: text.slice(0, MAX_PROMPT),
    target: (body.target as PromptRow["target"]) ?? null,
    kind: isInsert ? "insert" : "visual",
    insert: isInsert
      ? {
          afterId: String(at!.afterId).slice(0, 64),
          beforeId: at!.beforeId ? String(at!.beforeId).slice(0, 64) : null,
          afterLabel: String(at!.afterLabel || "").slice(0, 200),
          beforeLabel: at!.beforeLabel ? String(at!.beforeLabel).slice(0, 200) : null,
        }
      : null,
    status: "queued",
    at: now,
    updated: now,
  };

  /* PUT IT ON THE QUEUE FIRST, AND SPILL SEPARATELY.
     Doing both in one read-modify-write means a contended retry re-runs the
     spill too — and the page it already wrote would then be written again from
     a different head, which is how one prompt ends up in the record twice. So
     this write only ever prepends, and the spill below is its own guarded
     write that can fail harmlessly. */
  let queuedCount = 0, spillDue = false;
  try {
    await withHead(async (head) => {
      const rows = [row].concat(head.rows);
      queuedCount = rows.filter((r) => r.status === "queued").length;
      /* decided here, off the rows this write is about to store, so the common
         case never pays for the second read: a spill comes due roughly once
         every couple of hundred prompts and the other few hundred queue in one
         read and one write, which is what the map's poll budget assumes */
      spillDue = splitHead(rows).spill.length > 0;
      return {
        rows,
        extra: { pages: head.pages, stranded_open: head.strandedOpen },
        result: row,
      };
    });
  } catch (err) {
    console.error("molecular_prompts save failed", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }

  /* The head is over its high mark now and then — once every couple of hundred
     prompts — and moving its tail into a page is maintenance, not part of
     queueing. It is done after the prompt is safely on the queue and its
     failure is not the caller's problem: an orphaned page is INERT, because a
     reader only walks the page indices the head's own count admits to, so a
     spill that writes a page and then loses the head write leaves a wasted item
     and a whole record rather than a duplicated one. The next prompt tries
     again on the next index. */
  try {
    if (spillDue) await withHead(async (head) => {
      const { keep, spill, strandedOpen } = splitHead(head.rows);
      if (!spill.length) return null;
      const n = await writeNewPage(head.pages, spill);
      return {
        rows: keep,
        extra: { pages: n + 1, stranded_open: head.strandedOpen || strandedOpen },
        result: true,
      };
    }, 2);
  } catch (err) {
    console.error("molecular_prompts spill deferred", err);
  }

  return NextResponse.json({ ok: true, prompt: row, queued: queuedCount });
}
