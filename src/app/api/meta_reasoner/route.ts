// /api/meta_reasoner — the Phase-2 Meta-Reasoner brain, server-side.
//
// POST { ledger: BrainLedger, priorDescentAttempts?: {}, model? }
//   → assemble the GT-BLIND input (guardrail A, re-asserted here defensively)
//   → call the OpenAI Responses API (same provider as /api/kasperov_agent)
//   → parse the structured decision
//   → enforce the descent cap (guardrail B)
//   → return { ok, input, prompt, reasoning, decision, guardrails, usage }
//
// The decision is EMITTED here; it is logged + queue-steering happens elsewhere.
// With no OPENAI_API_KEY the route still returns the assembled input + prompt so
// the GT-seal and inputs are inspectable offline (ok:false, error:"no_openai_key").
import { NextResponse } from "next/server";
import { assembleBrainInput, assertGtBlind, buildBrainPrompt, parseBrainDecision, enforceCaps, type BrainLedger } from "../../meta_reasoner/brain";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

export const runtime = "nodejs";
export const maxDuration = 120;

function extractText(resp: any): string {
  // OpenAI Responses API: prefer output_text, else walk output[].content[].text
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text;
  const parts: string[] = [];
  for (const item of resp?.output ?? []) {
    for (const c of item?.content ?? []) {
      if ((c?.type === "output_text" || typeof c?.text === "string") && c.text) parts.push(c.text);
    }
  }
  return parts.join("\n").trim();
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }); }

  const ledger = body?.ledger as BrainLedger | undefined;
  if (!ledger || !Array.isArray(ledger.compartments)) {
    return NextResponse.json({ ok: false, error: "bad_ledger" }, { status: 400 });
  }
  const priorDescentAttempts: Record<string, number> = (body?.priorDescentAttempts && typeof body.priorDescentAttempts === "object") ? body.priorDescentAttempts : {};
  const model = isKasperovModel(body?.model) ? body.model : DEFAULT_MODEL;

  // GUARDRAIL A — assemble ONLY whitelisted labeller-derived fields; assertGtBlind
  // throws if anything sealed slipped in (caught → 422 so it is loud, never silent).
  let input, prompt;
  try {
    input = assembleBrainInput({ ledger, priorDescentAttempts });
    assertGtBlind({ ledger, priorDescentAttempts }); // also scan the raw inputs
    prompt = buildBrainPrompt(input);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "gt_seal_violation", detail: String(e?.message ?? e) }, { status: 422 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    // still return the assembled input + prompt so the GT-seal is inspectable
    return NextResponse.json({ ok: false, error: "no_openai_key", input, prompt, guardrails: { gtBlind: true } }, { status: 200 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 110000);
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: prompt.system,
        input: [{ role: "user", content: prompt.user }],
        reasoning: { effort: "low" },
        max_output_tokens: 4000,
      }),
    });
    if (!r.ok) {
      const detail = (await r.text().catch(() => "")).slice(0, 300);
      return NextResponse.json({ ok: false, error: "openai_error", status: r.status, detail, input, prompt }, { status: 502 });
    }
    const resp = await r.json();
    const reasoning = extractText(resp);
    const parsed = parseBrainDecision(reasoning);
    // GUARDRAIL B — coerce an over-budget descend into not_found_accept.
    const { decision, capApplied, note } = enforceCaps(parsed, priorDescentAttempts);
    return NextResponse.json({
      ok: true,
      input,
      prompt,
      reasoning,
      decision,
      guardrails: { gtBlind: true, capApplied, capNote: note },
      usage: { model, in: resp?.usage?.input_tokens ?? null, out: resp?.usage?.output_tokens ?? null },
    });
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    return NextResponse.json({ ok: false, error: aborted ? "timeout" : "fetch_failed", detail: String(e?.message ?? e).slice(0, 200), input, prompt }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
