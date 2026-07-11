// Shared shapes for the schema_menu page + client browser.

export type SubTerm = { zfa: string; name: string };

export type Panel = {
  germ_layer: string;
  tissue: string;
  lineage: string;
  anchors: { zfa: string; name: string; tier: string }[];
  markers: string[];
  sub_by_tier: Record<string, SubTerm[]>;
  n_sub: number;
};

export type Menu = {
  schema: string;
  stage: string;
  menu_sha: string;
  source: { panels: string; zfa: string; grounding: string };
  caro_ladder: string[];
  tiers: { germ_layer: string[]; tissue: string[]; cell_type_broad: string[] };
  panels: Record<string, Panel>;
  state_panels: { panel: string; markers: string[] }[];
};
