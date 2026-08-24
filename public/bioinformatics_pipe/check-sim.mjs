/* check-sim.mjs — the simulation must keep meaning what it says.
   Run: node check-sim.mjs            (no browser, no dependencies)

   Every threshold on this page is computed from the population in culls-pop.js,
   which means the population can silently stop supporting them. These are the
   properties the tiles depend on. They all failed at least once during the
   build, and each failure looked completely fine on screen:

     - `isDoublet` was a label that did not change the profile, so the scorer
       had nothing to find
     - with no cell TYPES there was no expression neighbourhood, so a doublet
       was indistinguishable from a large singlet
     - at 6,000 and 9,000 barcodes the doublet cut rose above every score and
       tile 05 flagged nothing at all

   A picture that renders is not evidence the statistic underneath it works.
*/
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { selfCheck } = require(join(here, '..', 'culls', 'culls-pop.js'));

const rows = selfCheck();
let bad = 0;
for (const r of rows) {
  if (!r.pass) bad++;
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(44)}  ${r.got}`);
}
console.log(bad ? `\n${bad} FAILED` : '\nsimulation self-check clean');
process.exit(bad ? 1 : 0);
