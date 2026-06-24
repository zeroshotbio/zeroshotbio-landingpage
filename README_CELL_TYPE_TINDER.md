# Cell Type Tinder — expert label-binning UI

Live: **https://www.zeroshot.bio/cell_type_tinder** (mobile-first).

Patrick, Harsha (and Steven, for testing) rate 334 blinded predicted↔GT label pairs at **two
tier-resolved rungs — tissue and cell type** — each on a 5-point same↔different scale. Verdicts
are the calibration anchor for the standardized judge, captured at the ChemFish/DanioCell
granularity our deployment data uses.

## What it does
- **Landing:** each rater is a pixel-art character with a live progress bar (fetched from
  `?action=progress`). Tap your character to start/resume.
- One pair per screen: two neutral label cards (`label_A` / `label_B`) + minimal context
  (tier, tissue area). **Blinded** — which label is the model prediction vs ground truth is
  never shown, and the machine's original verdict is never loaded.
- **Two rungs per pair**, each scored **1 same · 2 basically · 3 partial · 4 barely · 5
  different**, plus an explicit **🤷 unsure** per rung:
  - **TISSUE** — upper semicircle of 5 bins.
  - **CELL TYPE** — lower semicircle of 5 bins.
- **Interaction:** swipe the card **up** into a tissue bin / **down** into a cell-type bin
  (the nearest bin lights up as you approach), or **tap** any bin; tap the per-rung pill for
  unsure. Live status chips on the card show each rung's current pick. When **both** rungs are
  set, a ~1.3s confirmation flashes (emoji burst) and it auto-advances. Obvious **Back** button,
  top-left. Optional free-text note per pair.
- Progress (`47 / 334`), resumable — each rater self-identifies and resumes at their first
  **incompletely-rated** pair (a pair counts as done only when both rungs are set). All raters
  rate the **same full set** independently (inter-rater agreement).

## Stack & where things live
- Next.js 15 App Router on Vercel (same deployment as `/POC_workflow`; that route is untouched).
- `src/app/cell_type_tinder/page.tsx` — server component (metadata) wrapping the client UI.
- `src/app/cell_type_tinder/TinderClient.tsx` — the mobile UI.
- `src/app/api/cell_type_tinder/route.ts` — persistence API.
- `public/cell_type_tinder/pairs.json` — the 334 blinded pairs (from `pairs_for_experts.csv`).

## Where verdicts persist
- DynamoDB table **`zeroshot_dataroom_visitor_tracking`** (the existing site table; AWS creds
  already configured in Vercel — same as `/api/visitors` and `/api/minifin_annotation`).
- One row per rater: `id = "tinder::<rater>"` (patrick / harsha / steven), with `state_json`
  holding the full `{pair_id: {tissue, celltype, note?, ts, legacy_bucket?}}` map (`tissue`/
  `celltype` ∈ 1–5 | `"unsure"`). The client POSTs the full map after **every** change. As a
  belt-and-suspenders backup it also mirrors verdicts to `localStorage` and, on resume, merges
  any local-only/newer verdicts back — so navigate-away, refresh, or a brief offline patch never
  loses data. The store is the source of truth. The last rater is remembered for one-tap resume.

### Schema migration (single-scale → two-rung)
The original build stored a single `{bucket: 1–5|unsure}` per pair. Migration is **archive, not
auto-map** — the old generic rating wasn't tier-resolved, so it is never fabricated onto a rung:
- Legacy `bucket` entries are **preserved verbatim** (carried through every round-trip) and
  surfaced in export as `legacy_bucket`. Nothing is lost.
- A pair counts as done only when **both** rungs are set, so legacy-only pairs resurface for
  re-rating; when re-rated, the old value is retained as `legacy_bucket` on the new record.

## Export (`expert_verdicts.csv`)
```
GET https://www.zeroshot.bio/api/cell_type_tinder?action=export
```
Returns CSV across all raters:
`pair_id,rater,tissue_rating,celltype_rating,note,timestamp,legacy_bucket`
(ratings = 1–5 or `unsure`; timestamp ISO-8601; `legacy_bucket` = pre-migration single-scale
value, blank for natively two-rung verdicts). The "Export" button on the done screen hits the
same URL.

Progress check (no PII): `GET /api/cell_type_tinder?action=progress` → per-rater `n_decided`
(count of pairs with **both** rungs set).

## Deploy / update
1. Edit files under `src/app/cell_type_tinder/` (or the API route / pairs.json).
2. `npx next build` to verify locally.
3. `git push origin main` — Vercel auto-deploys. Adding/updating this route does not affect
   `/POC_workflow` or any other route.

### Updating the pair set
Regenerate `pairs_for_experts.csv`, then:
```
python3 -c "import csv,json; json.dump([{k:r[k] for k in ('pair_id','label_A','label_B','tier','tissue_area')} for r in csv.DictReader(open('pairs_for_experts.csv'))], open('public/cell_type_tinder/pairs.json','w'), ensure_ascii=False)"
```
Pair ids are stable, so existing verdicts stay attached to their pairs.

## Access / blinding notes
- The page is public for frictionless phone access; **writes are restricted** to users
  `patrick` / `harsha` in the API allow-list, so the verdict store can't be polluted. To gate
  the page too, add `/cell_type_tinder` + `/api/cell_type_tinder/:path*` to the matcher in
  `src/middleware.ts` (the same Basic-Auth used for the DanioType wizard).
- Blinding is enforced in the data: `pairs.json` carries no prediction/GT tell and no machine
  verdict; the API never returns the original verdict to the client.
