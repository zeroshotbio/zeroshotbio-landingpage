# Aquarium to Atlas: viewer and editor

`/pipeline` serves `viewer.html`: the published animated map with pan, pinch,
wheel, keyboard navigation, Fit, Pause/Play, and the original light/dark palette.
Click or tap a node to open its original explanation in the right column. There
is no left stage index. On phones the reader overlays the right side and can be
closed to return to the map.

The static background (grid, bands, plinths and edges) and labels are cached SVG
images. Each node's original drawing lives in a separate SVG surface with paint
containment. A CSS camera moves these surfaces together; moving track dots use a
canvas. Simple invisible node silhouettes provide tap targets without hit-testing
thousands of individual marks. All animation callbacks run at every zoom, with a
round-robin time budget and no zoom or visibility cutoff. Pause stops animation
work; an OS reduced-motion preference starts paused, with an explicit Play button.

This is a hybrid renderer, not an entirely prerendered movie: animated geometry
still costs CPU and paint time. The original drawing code and animation callbacks
remain the one source of visuals. A hidden same-origin frame initializes the
versioned drawing engine; its actual node groups are adopted into the viewer,
retaining callback references. Presentation mode suppresses the original animation
loop, hover behavior, authoring features and API polling. The viewer owns the
camera, animation scheduling and selection. Original reader functions supply the
HTML, including modelled values, saved wording, clone descriptions and copy blocks.

`/pipeline_edit` serves the original `index.html` and existing scripts. Position,
resize, annotation, text, visual-request and save tools remain there. The legacy
`/pipeline/index.html` URL and standalone build also remain editors. The editor
keeps its `pipeline.edits` namespace and shared API record, preserving existing
saved work and local drafts. Other maps do not enable presentation mode.

## Publishing a layout

1. In `/pipeline_edit`, finish edits and click **Save all changes**. Wait for the
   confirmed read-back message. Saves update the shared draft; publication is a
   separate step.
2. From the repository on the instance, run:

   ```sh
   npm run pipeline:publish
   ```

   This reads `/api/pipeline_edits`, renders the **local checkout's** shapes with
   that exact saved record, and writes a version under
   `public/pipeline/published/<version>/`. It does not write the shared record,
   commit or push. An unavailable/invalid saved record aborts publication.
3. Review locally and run `npm run pipeline:check` against a static server:
   `python3 -m http.server 8765 --bind 127.0.0.1 --directory public`.
4. Commit the new directory and `published/current.json`, then push to `main`.
   Vercel deploys them together. Source/layout edits alone do not update the show
   page.

Install locked npm dependencies and `npx playwright install chromium` on a fresh
machine. Vercel serves the committed assets without running a browser at build.

Format 2 includes both theme backgrounds and labels, animation bounds, original
palette/reader CSS, versioned engine scripts/HTML, and `layout.json` with the exact
saved record and source/publisher hashes. `current.json` advances only after all
assets are written. A deterministic random seed matches published background and
live geometry. Publication samples 30 seconds of animation to bound each surface;
the viewer expands bounds if later poses need additional room.

To reproduce a version using its matching source revision:

```sh
npm run pipeline:publish -- --state=public/pipeline/published/<version>/layout.json
```

`--state` also accepts a raw saved API response; `--source=https://…/api/pipeline_edits`
selects another saved-record endpoint. Browser drafts are never implicitly
published. Keep previously committed versions so older clients can finish loading.
A rollback must restore a viewer compatible with its manifest format: the original
format 1 still-image viewer does not understand format 2.

## What the map claims

The schematic pipeline, wording and animations are the editor's original content.
They are not new measurements or evidence that depicted stages have run. Cull roofs
and their reader retain the modelled figures and annotations. Browser fonts and
image rasterization can cause small differences in text/line appearance at zoom.

The viewer does not contact editing/prompt APIs or consume `pipeline.edits` from
localStorage. The entire website is a preview area; this route split does not
change the existing editor/API access model.

## Verification and performance

`npm run pipeline:check` covers route precedence, publication provenance, exact
computed drawing paint/fonts, all animation callbacks below the old zoom cutoff,
pause/resume, original right-column descriptions, node clicks/taps, pan, first-wheel
and real multi-touch pinch continuity, themes, saved-state isolation, reduced
motion and load errors in desktop, phone and tablet Chromium contexts.

Original editor checks accept an editor URL and stub writes:

```sh
node public/pipeline/check-save.mjs http://127.0.0.1:8765/pipeline/index.html
node public/pipeline/check-edit.mjs http://127.0.0.1:8765/pipeline/index.html
```

Do not test layout mutation against the real shared record. `HANDOFF.md` describes
the other authoring checks. Earlier 60 fps pan results applied to the entirely
static format 1 viewer; they are not a claim about this animated renderer. Physical
iPhone/iPad Safari and desktop testing is needed to judge this version's smoothness.
