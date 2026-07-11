// schema_menu — hand-inspection page for the MiniFin native label schema & menu.
//
// The schema comes from zlabel's panels.yaml (germ_layer / tissue / cell_type_broad)
// and the cell_type_sub vocabulary is the ZFA anatomy ontology grounded to ZFIN
// wildtype expression, placed on the CARO structural ladder. Static, public, no LLM.

import SchemaMenuBrowser from "./SchemaMenuBrowser";
import type { Menu } from "./types";
import menu from "./menu.json";

export const metadata = {
  title: "MiniFin — label schema & menu",
  description:
    "Hand-inspectable view of the MiniFin native cell-label schema (zlabel panels) and the CARO/ZFA-grounded menu of accepted terms per tier.",
};

export default function SchemaMenuPage() {
  return <SchemaMenuBrowser menu={menu as unknown as Menu} />;
}
