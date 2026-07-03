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
import { assembleOperatorInput, buildOperatorPrompt, parseOperatorOutput, type OperatorScope, type LabelSetEntry } from "../../meta_reasoner/operator";
import { META_REASONER_CONTEXT as META_REASONER_CTX } from "../../meta_reasoner/metaReasonerContext";
import { isKasperovModel, DEFAULT_MODEL } from "../../daniotype_kasperov/models";

export const runtime = "nodejs";
export const maxDuration = 120;

// helper: one non-streaming OpenAI Responses call → text + usage
async function callOpenAI(key: string, model: string, system: string, user: string, maxTokens: number, signal: AbortSignal) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions: system, input: [{ role: "user", content: user }], reasoning: { effort: "low", summary: "auto" }, max_output_tokens: maxTokens }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  return r.json();
}
// like callOpenAI but takes a full input message array (for multi-turn chat)
async function callOpenAI2(key: string, model: string, system: string, input: any[], maxTokens: number, signal: AbortSignal) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions: system, input, reasoning: { effort: "low", summary: "auto" }, max_output_tokens: maxTokens }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  return r.json();
}

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

// the model's reasoning-summary trace (Responses API reasoning items → summary parts)
function extractReasoning(resp: any): string {
  const parts: string[] = [];
  for (const item of resp?.output ?? []) {
    if (item?.type === "reasoning") for (const s of item?.summary ?? []) { if (s?.text) parts.push(s.text); }
  }
  return parts.join("\n\n").trim();
}

// Stream an OpenAI Responses call to the client as newline-delimited JSON so the
// reasoning summary can be typed out word-by-word in the UI as it flows in.
// Emits {t:"trace",d} (reasoning-summary delta), {t:"text",d} (output delta),
// then a terminal {t:"done",reasoning,reasoningTrace,output,usage} or {t:"error"}.
function streamMetaResponse(openaiBody: any, kind: "consolidate" | "chat", scope: OperatorScope): Response {
  const key = process.env.OPENAI_API_KEY as string;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (o: any) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch {} };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 110000);
      try {
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST", signal: ctrl.signal,
          headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ ...openaiBody, stream: true }),
        });
        if (!r.ok || !r.body) { send({ t: "error", error: `openai ${r.status}` }); controller.close(); return; }
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "", full: any = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const blocks = buf.split("\n\n"); buf = blocks.pop() || "";
          for (const block of blocks) {
            const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const payload = dataLine.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let ev: any; try { ev = JSON.parse(payload); } catch { continue; }
            if (ev.type === "response.reasoning_summary_text.delta" && ev.delta) send({ t: "trace", d: ev.delta });
            else if (ev.type === "response.output_text.delta" && ev.delta) send({ t: "text", d: ev.delta });
            else if (ev.type === "response.completed" && ev.response) full = ev.response;
          }
        }
        const reasoning = full ? extractText(full) : "";
        const reasoningTrace = full ? extractReasoning(full) : "";
        const output = kind === "consolidate" && full ? parseOperatorOutput(reasoning, scope) : null;
        send({ t: "done", reasoning, reasoningTrace, output, usage: full?.usage ? { in: full.usage.input_tokens ?? null, out: full.usage.output_tokens ?? null } : null });
      } catch (e: any) {
        send({ t: "error", error: e?.name === "AbortError" ? "timeout" : String(e?.message ?? e).slice(0, 160) });
      } finally { clearTimeout(timer); controller.close(); }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}

// meta-reasoner rules/priors, shared as a system prompt for interactive chat.
function metaSystemPrompt(): string {
  const c = META_REASONER_CTX;
  return [
    "You are the META-REASONER — a stateless operator that runs AFTER ~250 fine leaf clusters have been labelled, in an INTERACTIVE FINALIZE session driven by a human curator.",
    "Your four jobs: MERGE redundant leaves into one node; SET-ASIDE / re-home genuinely distinct 'rebel' leaves; PREJUDICE-OF-SHAPE audit (flag expected 48 hpf tissues left unaccounted — a hint, never a licence to invent one; 'expected tissue not found' is a valid outcome); ASSIGN each node the schema tier it can defend.",
    "You are GT-BLIND: reason only from the labeller's OWN predicted labels, never sealed ground truth. Priors are general biology only.",
    "This is a conversation: the human moves you forward. Be concise and concrete; when you make a merge/set-aside/tier call, state it plainly with the leaves and the tier. Do not invent a full JSON block unless asked.",
    "",
    "RULES:",
    ...c.rules.map((r: any) => `- ${r.title}: ${r.body}`),
    "GT-DISCIPLINE:",
    ...c.gtDiscipline.map((r: any) => `- ${r.title}: ${r.body}`),
    `EXPECTED TISSUES (prior): ${c.expectedTissues.join(", ")}`,
  ].join("\n");
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }); }

  // ---- INTERACTIVE FINALIZE CHAT (op:"chat") — human-driven meta-reasoner ----
  if (body?.op === "chat") {
    const messages = Array.isArray(body?.messages)
      ? body.messages.filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string").slice(-24)
      : [];
    if (!messages.length) return NextResponse.json({ ok: false, error: "no_messages" }, { status: 400 });
    const chatModel = isKasperovModel(body?.model) ? body.model : DEFAULT_MODEL;
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "no_openai_key" }, { status: 200 });
    // an optional compact label-set summary (GT-blind) as leading context
    const ctxNote = typeof body?.labelContext === "string" ? body.labelContext.slice(0, 12000) : "";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 110000);
    const input = ctxNote ? [{ role: "user", content: `=== CURRENT LABELLED SET (GT-blind, the labeller's own predictions) ===\n${ctxNote}` }, ...messages] : messages;
    if (body?.stream) { clearTimeout(timer); return streamMetaResponse({ model: chatModel, instructions: metaSystemPrompt(), input, reasoning: { effort: "low", summary: "auto" }, max_output_tokens: 3000 }, "chat", "global"); }
    try {
      const resp = await callOpenAI2(key, chatModel, metaSystemPrompt(), input, 3000, ctrl.signal);
      return NextResponse.json({ ok: true, reasoning: extractText(resp), reasoningTrace: extractReasoning(resp), usage: { model: chatModel, in: resp?.usage?.input_tokens ?? null, out: resp?.usage?.output_tokens ?? null } });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.name === "AbortError" ? "timeout" : "chat_failed", detail: String(e?.message ?? e).slice(0, 160) }, { status: 502 });
    } finally { clearTimeout(timer); }
  }

  // ---- REDESIGNED OPERATOR: fine-then-consolidate (op:"consolidate") ----
  if (body?.op === "consolidate") {
    const scope: OperatorScope = body?.scope === "global" ? "global" : "compartment";
    const labelSet: LabelSetEntry[] = Array.isArray(body?.labelSet)
      ? body.labelSet.filter((e: any) => e && (typeof e.leaf_id === "string" || typeof e.leaf_id === "number") && typeof e.label === "string")
          .map((e: any) => ({ leaf_id: String(e.leaf_id), label: String(e.label) }))
      : [];
    if (!labelSet.length) return NextResponse.json({ ok: false, error: "bad_labelSet" }, { status: 400 });
    const opModel = isKasperovModel(body?.model) ? body.model : DEFAULT_MODEL;
    let opInput, opPrompt;
    try {
      opInput = assembleOperatorInput({ scope, compartment: body?.compartment ?? null, labelSet, ledger: body?.ledger ?? { totalLeaves: labelSet.length, totalCompartments: 0, compartmentSizes: {} } });
      assertGtBlind({ labelSet, ledger: body?.ledger }); // scan raw inputs too
      opPrompt = buildOperatorPrompt(opInput);
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: "gt_seal_violation", detail: String(e?.message ?? e) }, { status: 422 });
    }
    const opKey = process.env.OPENAI_API_KEY;
    if (!opKey) return NextResponse.json({ ok: false, error: "no_openai_key", input: opInput, prompt: opPrompt, guardrails: { gtBlind: true } }, { status: 200 });
    if (body?.stream) return streamMetaResponse({ model: opModel, instructions: opPrompt.system, input: [{ role: "user", content: opPrompt.user }], reasoning: { effort: "low", summary: "auto" }, max_output_tokens: 6000 }, "consolidate", scope);
    const opCtrl = new AbortController();
    const opTimer = setTimeout(() => opCtrl.abort(), 110000);
    try {
      const resp = await callOpenAI(opKey, opModel, opPrompt.system, opPrompt.user, 6000, opCtrl.signal);
      const reasoning = extractText(resp);
      const output = parseOperatorOutput(reasoning, scope);
      return NextResponse.json({ ok: true, input: opInput, prompt: opPrompt, reasoning, reasoningTrace: extractReasoning(resp), output,
        guardrails: { gtBlind: true }, usage: { model: opModel, in: resp?.usage?.input_tokens ?? null, out: resp?.usage?.output_tokens ?? null } });
    } catch (e: any) {
      const aborted = e?.name === "AbortError";
      return NextResponse.json({ ok: false, error: aborted ? "timeout" : "operator_failed", detail: String(e?.message ?? e).slice(0, 200), input: opInput, prompt: opPrompt }, { status: 502 });
    } finally { clearTimeout(opTimer); }
  }

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
        reasoning: { effort: "low", summary: "auto" },
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
