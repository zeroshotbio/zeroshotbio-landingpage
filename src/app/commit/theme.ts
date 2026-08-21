// /commit design tokens. Borrowed from daniotype_kasperov/theme.ts (PAPER/INK/ACCENT) plus the
// typographic scale DatasetSpecCards established — monospace uppercase micro-labels, hairline
// rules, tabular numerals. Nothing new is invented here; this file only names what that page
// already uses inline so the challenge page can stay consistent without importing wizard code.
import type { CSSProperties } from "react";

export { PAPER, INK, ACCENT } from "../daniotype_kasperov/theme";

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
export const RULE = "#e5e1dc";
export const MUTED = "#8a847b";
export const FAINT = "#b0a89e";
export const CARD = "#fffefd";

// Chart palette — 3 categorical slots for the ZFA branch composition.
// Validated with the dataviz six-check validator against surface #f6f4f2:
//   lightness band PASS · chroma floor PASS · CVD separation PASS (worst adjacent ΔE 20.1 protan)
//   normal-vision floor PASS (ΔE 29.2) · contrast vs surface PASS
// Assigned in fixed order and never cycled. Do not substitute by eye — re-run the validator.
export const CAT = ["#0369a1", "#c2410c", "#6d28d9"] as const;

// File names — the artefacts that actually ship. A warm rust, one step lower in chroma than the
// chart orange so it reads as a category marker rather than an alert; 5.10:1 on the code-chip
// background, 5.45:1 on card. Files wear it; COLUMNS inside a file stay neutral ink, so the
// distinction between "a file you receive" and "a field within it" is carried by colour.
export const FILE = "#a8501b";
export const FILE_BG = "#fdf6f1";
export const FILE_BD = "#f0e2d6";

// The two panel surfaces. The figure is a grey field holding white sub-boxes, so a file reads as
// an object sitting IN the delivery rather than as another band of the same card.
export const PANEL = "#eeece8";
export const PANEL_BD = "#e0dbd4";

// Single-series magnitude (the cluster-size histogram). One hue, no categorical identity to carry.
export const SERIES = "#0e7490";

export const microLabel: CSSProperties = {
  fontFamily: MONO,
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: MUTED,
};

export const monoValue: CSSProperties = {
  fontFamily: MONO,
  fontSize: 11.5,
  fontWeight: 700,
  color: "#2b2b2b",
  fontVariantNumeric: "tabular-nums",
};

export const card: CSSProperties = {
  background: CARD,
  border: `1px solid ${RULE}`,
  borderRadius: 12,
  overflow: "hidden",
};

export const nfmt = (n: number) => n.toLocaleString("en-US");
