/* /compass — loading and integrity.
 *
 * meta.json holds every number the page prints; plates.json holds the arrays the plates draw.
 * Both are written by scripts/build_compass.py in one pass, and meta.json records the sha256 of
 * the exact plates.json it was built with. A mismatched pair is refused rather than drawn: a
 * stale plates.json under a fresh meta.json would draw a plausible, wrong page.
 */
'use strict';

const CP = { meta: null, plates: null };
const LINES = ['K562', 'RPE1', 'HepG2', 'Jurkat', 'HCT116', 'HEK293T'];

async function sha12(text) {
  if (!(window.crypto && crypto.subtle)) return null;          // insecure context: skip, do not fail
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

function need(cond, what) {
  if (!cond) throw new Error('integrity check failed: ' + what);
}

async function cpLoad() {
  const [m, p] = await Promise.all([
    fetch('/compass/meta.json', { cache: 'no-store' }),
    fetch('/compass/plates.json', { cache: 'no-store' }),
  ]);
  if (!m.ok || !p.ok) throw new Error(`could not fetch the plate data (${m.status} / ${p.status})`);
  const text = await p.text();
  CP.meta = await m.json();
  CP.plates = JSON.parse(text);
  const v = await sha12(text);
  if (v && v !== CP.meta.asset_version) {
    throw new Error(`plates.json (${v}) was not built with this meta.json (${CP.meta.asset_version}); redeploy both`);
  }
  const P = CP.plates, M = CP.meta;
  need(P.p1.exemplars.length === 3, 'three exemplars on Plate I');
  P.p1.exemplars.forEach((e) => need(e.z.length === P.p1.n_genes && e.residual.length === P.p1.n_genes, 'exemplar vectors span the panel'));
  LINES.forEach((l) => {
    need(P.p2[l] && P.p2[l].m.length === M.anchor.ensembl, `${l} geometry covers the anchor`);
    need(P.p3.lines[l], `${l} shared direction present`);
  });
  need(P.p4.x.length === P.p4.label.length && P.p4.x.length === M.anchor.ensembl, 'residual layout covers the anchor');
  need(P.p4.clusters.length === 20, 'twenty residual clusters');
}
