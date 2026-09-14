/* tm-stats.js — every number /trailmaker_UI draws. No DOM; tm-view.js renders, this computes.
 *
 * The data file (scripts/build_trailmaker_ui.py) holds COUNTS, never finished statistics:
 * counts[unit][type] = cells of that type in that replicate unit (a MegaFin well, a MiniFin
 * sample), and per gene g<i>.bin = the cells of that type in that unit with >= 1 count of gene i.
 * A LAYER is a numerator / denominator pair over units x types:
 *   proportion  num = counts            den = cells in the unit       -> share of the unit's cells
 *   gene        num = expressing counts den = counts                  -> % of that type expressing
 * and the three display modes are the same three functions of a layer:
 *   pct    the condition's pooled value (sum num / sum den over its units)
 *   delta  pct minus the DMSO baseline of each unit's own plate (weighted like pct), so a
 *          condition run on both plates is compared plate for plate
 *   z      MegaFin ("robust"): each well's (value - median) / (1.4826 MAD) over every well on its
 *          plate, averaged over the condition's wells — a drug-dose is one well and DMSO is two
 *          per plate, too few for a DMSO variance; MiniFin ("welch"): Welch t of the drug's
 *          sample values against the DMSO samples.
 */
(function (root) {
  "use strict";

  const MIN_DEN_GENE = 10; // a gene value from fewer cells than this is drawn as missing

  function prepare(m) {
    const nu = m.units.length, nt = m.types.length;
    const counts = new Float64Array(nu * nt);
    const unitDen = new Float64Array(nu * nt);
    m.counts.forEach((row, u) => row.forEach((v, t) => {
      counts[u * nt + t] = v;
      unitDen[u * nt + t] = m.units[u].n;
    }));
    const base = m.conds.findIndex((c) => c.id === m.baseline);
    if (base < 0) throw new Error(`no baseline condition "${m.baseline}"`);
    const plates = [...new Set(m.units.map((u) => u.plate))];
    const baseUnits = {};
    for (const p of plates) baseUnits[p] = m.conds[base].units.filter((u) => m.units[u].plate === p);
    const unitsOnPlate = {};
    for (const p of plates) unitsOnPlate[p] = m.units.map((u, i) => (u.plate === p ? i : -1)).filter((i) => i >= 0);
    const doses = [...new Set(m.conds.filter((c) => !c.control && c.dose).map((c) => c.dose))]
      .sort((a, b) => parseFloat(b) - parseFloat(a));
    const anchors = m.conds.map((c, i) => (c.drug === m.anchor ? i : -1)).filter((i) => i >= 0);
    Object.assign(m, { nu, nt, counts, base, plates, baseUnits, unitsOnPlate, doses, anchors, _cache: new Map() });
    m.propLayer = { key: "prop", num: counts, den: unitDen, minDen: 1 };
    return m;
  }

  function geneLayer(m, j, buf) {
    const a = new Uint16Array(buf);
    if (a.length !== m.nu * m.nt) throw new Error(`gene file has ${a.length} values, expected ${m.nu * m.nt}`);
    return { key: `gene:${j}`, num: Float64Array.from(a), den: m.counts, minDen: MIN_DEN_GENE };
  }

  function pooled(L, units, t, nt) {
    let a = 0, b = 0;
    for (const u of units) { a += L.num[u * nt + t]; b += L.den[u * nt + t]; }
    return b >= L.minDen && b > 0 ? a / b : NaN;
  }

  function unitVal(L, u, t, nt) {
    const d = L.den[u * nt + t];
    return d >= L.minDen && d > 0 ? L.num[u * nt + t] / d : NaN;
  }

  function median(xs) {
    const s = xs.slice().sort((a, b) => a - b), n = s.length;
    return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
  }

  function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
  function variance(xs) { const mu = mean(xs); return xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / (xs.length - 1); }

  // pct / delta / z for every condition x type, cached per layer.
  function matrices(m, L) {
    if (m._cache.has(L.key)) return m._cache.get(L.key);
    const { nt, conds, plates } = m, nc = conds.length;
    const pct = new Float64Array(nc * nt), delta = new Float64Array(nc * nt), z = new Float64Array(nc * nt);
    const allBase = m.conds[m.base].units;
    const baseVal = {}, robust = {};
    for (const p of plates) {
      baseVal[p] = new Float64Array(nt);
      robust[p] = [];
      for (let t = 0; t < nt; t++) {
        baseVal[p][t] = pooled(L, m.baseUnits[p], t, nt);
        if (m.z_method === "robust") {
          const us = m.unitsOnPlate[p];
          const v = us.map((u) => unitVal(L, u, t, nt)).filter(Number.isFinite);
          const med = median(v);
          let s = 1.4826 * median(v.map((x) => Math.abs(x - med)));
          if (!(s > 0)) s = 1.2533 * mean(v.map((x) => Math.abs(x - med)));
          // Floor the spread at the binomial sampling noise of a typical well. A rare type's MAD
          // can sit near zero, and without a floor a 0.06 pp shift read as z = +18.
          const nbar = median(us.map((u) => L.den[u * nt + t]).filter((d) => d > 0));
          if (nbar > 0) {
            const q = Math.min(1 - 1 / nbar, Math.max(med, 1 / nbar));
            s = Math.max(s || 0, Math.sqrt((q * (1 - q)) / nbar));
          }
          robust[p][t] = [med, s > 0 ? s : NaN];
        }
      }
    }
    conds.forEach((c, i) => {
      for (let t = 0; t < nt; t++) {
        const v = pooled(L, c.units, t, nt);
        // Baseline on each unit's OWN plate, weighted the way the pooled value is, so a condition
        // run on both plates (DMSO, Sorafenib) is compared plate for plate. For DMSO itself this
        // reduces exactly to its pooled value, so its delta is 0.
        let bw = 0, bd = 0;
        for (const u of c.units) {
          const d = L.den[u * nt + t], b = baseVal[m.units[u].plate][t];
          if (d > 0 && Number.isFinite(b)) { bw += d * b; bd += d; }
        }
        pct[i * nt + t] = v;
        delta[i * nt + t] = bd > 0 ? v - bw / bd : NaN;
        let zz = NaN;
        if (i === m.base) zz = 0;
        else if (m.z_method === "robust") {
          // each well against its own plate, then the mean over the condition's wells
          const zs = [];
          for (const u of c.units) {
            const [med, s] = robust[m.units[u].plate][t], x = unitVal(L, u, t, nt);
            if (Number.isFinite(x) && s > 0) zs.push((x - med) / s);
          }
          zz = zs.length ? mean(zs) : NaN;
        } else if (m.z_method === "welch") {
          const a = c.units.map((u) => unitVal(L, u, t, nt)).filter(Number.isFinite);
          const b = allBase.map((u) => unitVal(L, u, t, nt)).filter(Number.isFinite);
          if (a.length > 1 && b.length > 1) {
            const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length);
            zz = se > 0 ? (mean(a) - mean(b)) / se : NaN;
          }
        }
        z[i * nt + t] = zz;
      }
    });
    const out = { pct, delta, z };
    m._cache.set(L.key, out);
    return out;
  }

  function row(mat, i, nt) { return mat.subarray(i * nt, (i + 1) * nt); }

  function pearson(a, b, cols) {
    const xs = [], ys = [];
    for (const t of cols) if (Number.isFinite(a[t]) && Number.isFinite(b[t])) { xs.push(a[t]); ys.push(b[t]); }
    if (xs.length < 3) return NaN;
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let k = 0; k < xs.length; k++) {
      sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; syy += (ys[k] - my) ** 2;
    }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
  }

  // The Sorafenib condition a drug is compared with: same dose if there is one.
  function anchorFor(m, i, dose) {
    const want = (m.conds[i] && m.conds[i].dose) || dose;
    return m.anchors.find((a) => m.conds[a].dose === want) ?? m.anchors[0] ?? -1;
  }

  // Root-mean-square z over the visible columns: how much a condition moves anything.
  function responseScore(zrow, cols) {
    let s = 0, n = 0;
    for (const t of cols) if (Number.isFinite(zrow[t])) { s += zrow[t] * zrow[t]; n++; }
    return n ? Math.sqrt(s / n) : NaN;
  }

  function quantile(vals, q) {
    const s = vals.filter(Number.isFinite).sort((a, b) => a - b);
    if (!s.length) return NaN;
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
  }

  const TM = { prepare, geneLayer, matrices, row, pearson, anchorFor, responseScore, quantile, pooled, unitVal, MIN_DEN_GENE };
  if (typeof module !== "undefined" && module.exports) module.exports = TM;
  else root.TM = TM;
})(typeof window !== "undefined" ? window : globalThis);
