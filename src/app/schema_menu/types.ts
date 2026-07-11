// Shared shapes for the schema_menu page + client browser.
// Menu uses Darien's ZFA structural-bucket scheme (see scripts/build_minifin_zfa_menu.py).

export type SubTerm = { zfa: string; name: string };

export type Panel = {
  germ_layer: string;
  tissue: string;
  lineage: string;
  anchors: { zfa: string; name: string; bucket: string }[];
  markers: string[];
  sub_by_bucket: Record<string, SubTerm[]>;
  n_sub: number;
};

export type BucketMeta = { display: string; zfa_root: string; caro: string; principal: boolean };

export type Menu = {
  schema: string;
  stage: string;
  classifier: string;
  menu_sha: string;
  source: { panels: string; zfa: string; grounding: string };
  bucket_order: string[];
  bucket_meta: Record<string, BucketMeta>;
  tiers: { germ_layer: string[]; tissue: string[]; cell_type_broad: string[] };
  tissue_germ: Record<string, string>;
  panels: Record<string, Panel>;
  state_panels: { panel: string; markers: string[] }[];
};
