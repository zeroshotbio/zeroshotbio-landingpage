// Selectable OpenAI models for the daniotype_kasperov labeller + a price table
// for cost ESTIMATION. Shared by the client (selector + cost) and the API routes
// (validate the requested model). gpt-5 series only — no "pro" tiers.

export const KASPEROV_MODELS = [
  "gpt-5-mini",
  "gpt-5",
  "gpt-5.1",
  "gpt-5.2",
  "gpt-5.4-nano",
  "gpt-5.4-mini",
  "gpt-5.4",
  "gpt-5.5",
] as const;
export type KasperovModel = (typeof KASPEROV_MODELS)[number];
export const DEFAULT_MODEL: KasperovModel = "gpt-5-mini";

export function isKasperovModel(m: unknown): m is KasperovModel {
  return typeof m === "string" && (KASPEROV_MODELS as readonly string[]).includes(m);
}

// USD per 1M tokens. Concrete values for the gpt-5 launch tiers; the *.x variants
// are estimated by tier (nano / mini / base) until confirmed against live OpenAI
// pricing — the run cost is labelled an ESTIMATE in the UI either way.
const PRICE_TABLE: Record<string, { in: number; out: number }> = {
  "gpt-5-mini": { in: 0.25, out: 2.0 },
  "gpt-5": { in: 1.25, out: 10.0 },
};

export function priceFor(model: string): { in: number; out: number; estimated: boolean } {
  if (PRICE_TABLE[model]) return { ...PRICE_TABLE[model], estimated: false };
  if (/nano/.test(model)) return { in: 0.05, out: 0.4, estimated: true };
  if (/mini/.test(model)) return { in: 0.25, out: 2.0, estimated: true };
  return { in: 1.25, out: 10.0, estimated: true }; // base tier
}

// total estimated USD from per-model {in,out} token tallies
export function estimateCost(usage: Record<string, { in: number; out: number }>): { usd: number; estimated: boolean } {
  let usd = 0;
  let estimated = false;
  for (const [model, u] of Object.entries(usage)) {
    const p = priceFor(model);
    usd += (u.in / 1e6) * p.in + (u.out / 1e6) * p.out;
    if (p.estimated) estimated = true;
  }
  return { usd, estimated };
}
