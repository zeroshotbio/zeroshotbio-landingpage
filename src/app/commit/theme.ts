// /commit design tokens. Borrowed from daniotype_kasperov/theme.ts (PAPER/INK/ACCENT) plus the
// typographic scale DatasetSpecCards established — monospace uppercase micro-labels, hairline
// rules, tabular numerals. Nothing new is invented here; this file only names what that page
// already uses inline so the challenge page can stay consistent without importing wizard code.
import type { CSSProperties } from "react";

// Every colour is a CSS variable so the pages can switch between light and dark (see THEME_CSS below
// and layout.tsx). The light values are the originals; the dark ones are chosen steps, not a flip.
export const PAPER = "var(--cm-paper)";
export const INK = "var(--cm-ink)";
export const ACCENT = "var(--cm-accent)";

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
export const RULE = "var(--cm-rule)";
export const MUTED = "var(--cm-muted)";
export const FAINT = "var(--cm-faint)";
export const CARD = "var(--cm-card)";

// Chart palette — 3 categorical slots for the ZFA branch composition.
// Light #0369a1 #c2410c #6d28d9, validated with the dataviz six-check validator against #f6f4f2:
//   lightness band PASS · chroma floor PASS · CVD separation PASS (worst adjacent ΔE 20.1 protan)
//   normal-vision floor PASS (ΔE 29.2) · contrast vs surface PASS
// Dark #0b8bd0 #e0661c #8a5cf0, validated --mode dark against #1f1d1b: all six PASS (worst adjacent
//   CVD ΔE 23.8 protan, normal-vision ΔE 31.3). Bar labels switch to dark ink there (--cm-on-cat),
//   since white on these mid-lightness steps falls under 4.5:1.
// Assigned in fixed order and never cycled. Do not substitute by eye — re-run the validator.
export const CAT = ["var(--cm-cat1)", "var(--cm-cat2)", "var(--cm-cat3)"] as const;

// File names — the artefacts that actually ship. A warm rust, one step lower in chroma than the
// chart orange so it reads as a category marker rather than an alert; 5.10:1 on the code-chip
// background, 5.45:1 on card. Files wear it; COLUMNS inside a file stay neutral ink, so the
// distinction between "a file you receive" and "a field within it" is carried by colour.
export const FILE = "var(--cm-file)";
export const FILE_BG = "var(--cm-file-bg)";
export const FILE_BD = "var(--cm-file-bd)";

// The two panel surfaces. The figure is a grey field holding white sub-boxes, so a file reads as
// an object sitting IN the delivery rather than as another band of the same card.
export const PANEL = "var(--cm-panel)";
export const PANEL_BD = "var(--cm-panel-bd)";

// The third side marker, for scoring — beside FILE (input) and ACCENT (output). Taken from the
// validated categorical set, so the three side colours are separable under CVD; 7.05:1 on card.
export const SCORE = "var(--cm-score)";

// Scoring outcomes. STATUS colours: they never carry meaning alone — every use ships with the
// word ("full", "half", "zero") beside it.
export const SC_FULL = "var(--cm-sc-full)";
export const SC_HALF = "var(--cm-sc-half)";
export const SC_ZERO = "var(--cm-sc-zero)";

// Single-series magnitude (the cluster-size histogram). One hue, no categorical identity to carry.
export const SERIES = "var(--cm-series)";

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
  color: INK,
  fontVariantNumeric: "tabular-nums",
};

export const card: CSSProperties = {
  background: CARD,
  border: `1px solid ${RULE}`,
  borderRadius: 12,
  overflow: "hidden",
};

export const nfmt = (n: number) => n.toLocaleString("en-US");

// ── light / dark values ────────────────────────────────────────────────────
// Light = the page's original colours. Dark = warm near-black paper, same hues stepped for contrast.
// The prose/lede/detail/surface/chip tokens replace hex literals that used to sit inline in the pages.
const LIGHT: Record<string, string> = {
  paper: "#f6f4f2", ink: "#2b2b2b", accent: "#0e7490", rule: "#e5e1dc", "rule-soft": "#f2efeb",
  muted: "#8a847b", faint: "#b0a89e", card: "#fffefd", prose: "#3f3a34", lede: "#5a544c", detail: "#4a453f",
  "surf-1": "#fdfcfb", "surf-2": "#faf8f5", "surf-3": "#f4f2ef", panel: "#eeece8", "panel-bd": "#e0dbd4",
  file: "#a8501b", "file-bg": "#fdf6f1", "file-bd": "#f0e2d6", score: "#6d28d9",
  "sc-full": "#3f6b55", "sc-half": "#a16207", "sc-zero": "#9a3b3b", series: "#0e7490",
  cat1: "#0369a1", cat2: "#c2410c", cat3: "#6d28d9", "on-cat": "#ffffff",
  "chip-bg": "#eef6f8", "chip-bd": "#cfe4ea", "chip-dot": "#c9d9de", "chip-label": "#7fa8b5", "zero-num": "#d9d3cc",
};
const DARK: Record<string, string> = {
  paper: "#161514", ink: "#ece8e2", accent: "#3fb4cf", rule: "#35312d", "rule-soft": "#2a2724",
  muted: "#9d958b", faint: "#7a7369", card: "#1f1d1b", prose: "#d6cfc6", lede: "#b9b1a7", detail: "#c7bfb5",
  "surf-1": "#1c1a18", "surf-2": "#211f1c", "surf-3": "#282522", panel: "#242220", "panel-bd": "#3a3632",
  file: "#e8935f", "file-bg": "#2b2019", "file-bd": "#4a3427", score: "#a98cf8",
  "sc-full": "#7cc39c", "sc-half": "#e2ad45", "sc-zero": "#ee8b8b", series: "#3fb4cf",
  cat1: "#0b8bd0", cat2: "#e0661c", cat3: "#8a5cf0", "on-cat": "#161514",
  "chip-bg": "#15262b", "chip-bd": "#27464f", "chip-dot": "#4d6c75", "chip-label": "#7fa8b5", "zero-num": "#4a4540",
};
const vars = (m: Record<string, string>) => Object.entries(m).map(([k, v]) => `--cm-${k}:${v}`).join(";");

// Explicit choice (data-commit-theme on <html>) wins; otherwise follow the system setting.
export const THEME_CSS = `
:root{${vars(LIGHT)};color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-commit-theme="light"]){${vars(DARK)};color-scheme:dark}}
:root[data-commit-theme="dark"]{${vars(DARK)};color-scheme:dark}
body{background:var(--cm-paper)}`;
