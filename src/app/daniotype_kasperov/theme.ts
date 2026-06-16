// theme.ts — shared design tokens for the daniotype_kasperov wizard + (Phase 2)
// read-only run viewer. Extracted verbatim from KasperovClient.tsx.
import type { AgentMode } from "./types";

export const PAPER = "#f6f4f2";
export const INK = "#2b2b2b";
export const ACCENT = "#0e7490";

// confidence % → a subtle red→amber→green heat tint for the world-map cards.
export function confColor(pct: number): { bg: string; fg: string } {
  const p = Math.max(0, Math.min(100, pct));
  const h = (p / 100) * 130; // 0% = red, 100% = green
  return { bg: `hsl(${h} 72% 92%)`, fg: `hsl(${h} 55% 27%)` };
}

import type { CSSProperties } from "react";

export const btnPrimary: CSSProperties = { background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
export const btnGhost: CSSProperties = { background: "transparent", border: "1px solid #d8d3cd", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 500, cursor: "pointer", color: INK };

// The three AI personalities. Every colour in an agent message / marker note is
// the PERSONALITY colour; plain text stays neutral.
export const THEME: Record<AgentMode, { name: string; icon: string; color: string; bg: string; trace: string; verb: string; blurb: string }> = {
  research: { name: "Researcher", icon: "🔬", color: "#15803d", bg: "#f0fdf4", trace: "Research log", verb: "Searching ZFIN · ZFA · GO…", blurb: "ZFIN / ZFA / GO literature" },
  archivist: { name: "Archivist", icon: "🗄", color: "#a16207", bg: "#fef9c3", trace: "Archive search", verb: "Pulling records from the MiniFin stacks…", blurb: "raw MiniFin records" },
  reason: { name: "Reasoner", icon: "🧠", color: "#2563eb", bg: "#eff6ff", trace: "Reasoning", verb: "Reasoning across what's known…", blurb: "generalist synthesis" },
};
