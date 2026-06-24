# Cell Type Tinder — expert label-binning UI

Live: **https://www.zeroshot.bio/cell_type_tinder** (mobile-first).

Patrick, Harsha (and Steven, for testing) bin 334 blinded predicted↔GT cell-type label pairs on
a 5-point same↔different spectrum. Their verdicts are the calibration anchor for the standardized
judge.

## What it does
- **Landing:** each rater is a pixel-art character with a live progress bar (fetched from
  `?action=progress`). Tap your character to start/resume.
- One pair per screen: two neutral label cards (`label_A` / `label_B`) + minimal context
  (tier, tissue area). **Blinded** — which label is the model prediction vs ground truth is
  never shown, and the machine's original verdict is never loaded.
- Bin into: **1 Exactly the same · 2 Basically the same · 3 Partially related · 4 Barely
  related · 5 Totally different**, plus an explicit **Unsure / genuinely ambiguous**.
- **Interaction:** drag the card down into a semicircle of 5 bins — the nearest bin lights up
  as you approach; on release a ~1.4s confirmation flashes (emoji burst), then auto-advances.
  Swipe **up** (or tap the pill) = unsure; tapping a bin also works. Desktop: keys `1`–`5` / `u`,
  `⌫` back. Obvious **Back** button, top-left. Optional free-text note per pair.
- Progress (`47 / 334`), resumable — each rater self-identifies and resumes at their first
  un-binned pair. All raters bin the **same full set** independently (inter-rater agreement).

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
  holding the full `{pair_id: {bucket, note, ts}}` map. The client POSTs the full map after
  **every** verdict. As a belt-and-suspenders backup it also mirrors verdicts to `localStorage`
  and, on resume, merges any local-only/newer verdicts back to the server — so navigate-away,
  refresh, or a brief offline patch never loses data. The store is the source of truth (not
  browser-only). The last rater is remembered locally for one-tap resume.

## Export (`expert_verdicts.csv`)
```
GET https://www.zeroshot.bio/api/cell_type_tinder?action=export
```
Returns CSV across both raters: `pair_id,rater,bucket,note,timestamp` (bucket = 1–5 or `unsure`,
timestamp ISO-8601). The "Export all verdicts (CSV)" button on the done screen hits the same URL.

Progress check (no PII): `GET /api/cell_type_tinder?action=progress` → per-rater `n_decided`.

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
