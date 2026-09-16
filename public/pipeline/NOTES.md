# Aquarium to Atlas: viewer and editor

`/pipeline` serves `viewer.html`: a published, still picture with pan, pinch, wheel,
keyboard navigation, a Fit button, light/dark themes, and a text stage index.
The scene is an SVG **image**, not an interactive SVG document. Its internal
16,000+ elements, hit testing, animation callbacks, editor, and shared-state
polling never enter the viewer DOM. Camera updates use a CSS transform, coalesced
into one requestAnimationFrame; the viewer does no continuous work while idle.

`/pipeline_edit` serves the original `index.html` and the existing scripts. All
position, resize, annotation, text, visual-request, and save tools remain there.
The legacy `/pipeline/index.html` URL and standalone build also remain editors.
The editor keeps the existing `pipeline.edits` namespace and shared API record,
so existing saved work and local drafts are preserved. Other maps that share the
renderer are unchanged.

## Publishing a layout

1. In `/pipeline_edit`, finish edits and click **Save all changes**. Wait for the
   confirmed read-back message. Saves update the editor's shared draft, not the
   published viewer.
2. From the repository on the instance, run:

   ```sh
   npm run pipeline:publish
   ```

   This reads the current saved record from `/api/pipeline_edits`, renders the
   **local checkout's** shape code with that exact record, and writes an immutable
   snapshot under `public/pipeline/published/<version>/`. It never writes to the
   saved editor record, commits, or pushes. An unavailable/invalid saved record
   aborts rather than silently publishing the baked fallback.
3. Review the viewer locally and run `npm run pipeline:check` against a local
   static server (`python3 -m http.server 8765 --bind 127.0.0.1 --directory public`).
4. Commit the new version directory and `published/current.json`, then push to
   `main`. Vercel deploys them together. Publishing is intentionally an explicit
   release step; changing positions or shape code alone does not update the show
   page.

On a fresh development machine, install the locked npm dependencies and run
`npx playwright install chromium` once. Snapshot generation uses Playwright,
which is a development dependency; Vercel serves the committed assets and does
not need to run a browser during its build.

The pointer `current.json` is replaced only after both theme assets and the
provenance file are written. Each version includes `layout.json`: the exact shared
saved record, source file hashes, snapshot format and chosen animation pose.
The version hashes provenance and both image contents. To reproduce a version:

```sh
npm run pipeline:publish -- --state=public/pipeline/published/<version>/layout.json
```

Use the matching source revision for identical results. `--state` also accepts a
raw saved API response, and `--source=https://…/api/pipeline_edits` selects another
saved-record endpoint. No browser local draft is implicitly published. Keep old
published directories when creating a new version, so visitors with an older
manifest can finish loading. A rollback restores an older `current.json`.

## What the picture claims

This is the same schematic pipeline and wording as the editor, frozen at a
repeatable 2.5-second animation pose. It is not a new measurement or a report that
all depicted stages have run. The cull roofs retain their modelled figures and
annotations. The stage index retains the saved descriptions as plain text.
Motion and per-node hover are deliberately absent from this first presentation
renderer. Existing image labels are still vector and can be enlarged; browser
font availability can cause minor typography differences.

The published viewer does not contact editing or prompt APIs and does not consume
`pipeline.edits` from localStorage. Its only stored preference is a separate
`pipeline.viewer.theme` key. The entire website is a preview area; the existing
editor/API access model is unchanged by this route split.

## Verification and performance

`npm run pipeline:check` covers routing, source/saved-state provenance, snapshot
camera removal, API/editor isolation, fit, first-wheel continuity, drag, real
multi-touch pinch, keyboard navigation, theme changes, accessible stage text, and
manifest failure handling in desktop, phone, and tablet Chromium contexts.

The original editor checks accept the editor URL, for example:

```sh
node public/pipeline/check-save.mjs http://127.0.0.1:8765/pipeline/index.html
node public/pipeline/check-edit.mjs http://127.0.0.1:8765/pipeline/index.html
```

Both tests stub writes; do not test layout mutation against the real shared
record. The map's `HANDOFF.md` describes the other authoring checks.

In EC2 headless Chromium tests, CSS-transform pan at reading zoom held around
60 fps on desktop and phone/tablet emulation with 6×/4× CPU throttling. The original
frozen SVG scene panned around 17–23 fps in the mobile stress tests. These are
relative browser tests, not physical iPhone/iPad Safari measurements. Test those
devices before promising a hardware-specific frame rate. A tile renderer remains
an option if real-device memory or deep zoom warrants it; this version does not
add a tile service or a second drawing implementation.
