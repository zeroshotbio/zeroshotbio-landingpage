# Aquarium to Atlas: public map and editor

`/pipeline` presents the original editor map across the full browser window.
All five rows are visible from the outset and the camera is immediately free to
pan and zoom. There are no toolbars, buttons, sidebars, reader panels, hints or
section transitions. All drawing detail remains native SVG.

Drag to pan; scroll or pinch to zoom. Home or 0 fits the whole map, arrow keys pan,
plus/minus zoom, and M toggles motion. The public surface has no upper zoom cap.
Animations use the editor's original scheduler: they run at reading zoom (0.60
and above), skip off-screen objects, and share a seven-millisecond frame budget.
The OS reduced-motion preference is respected. There is no guided startup wave
or automatic opening camera shot.

The public page loads a versioned copy of the actual editor into a full-window,
same-origin frame. `surface.css` hides everything except its SVG and dot canvas.
`presentation-engine.js` starts the original camera/animation loop and provides
keyboard navigation. Presentation mode disables authoring, node previews and API
polling. The original palette, labels, geometry and canvas-dot alignment are
preserved; no artwork is flattened into images.

`/pipeline_edit` and `/pipeline/index.html` keep the full editor and its tools,
including position, size, annotations, text, visual requests and saving. Their
existing zoom defaults remain unchanged. The public map uses the saved published
layout and does not consume browser drafts or write to editing/prompt APIs.

## Publishing

1. Save changes in `/pipeline_edit` and wait for its confirmed read-back message.
2. Run `npm run pipeline:publish`. It reads the shared saved record and local
   source, then writes a new version to `public/pipeline/published/<version>/`.
   It never writes the shared record, commits or pushes. An invalid/unavailable
   record aborts publication.
3. Review locally with `python3 -m http.server 8765 --bind 127.0.0.1 --directory
   public` and run `npm run pipeline:check`.
4. Commit the new directory and `published/current.json`, then push to `main`.
   Editor saves alone do not publish the public map.

Install locked dependencies and `npx playwright install chromium` on a fresh
machine. Vercel serves committed assets without running a browser at build time.
Format 4 includes the versioned editor HTML/scripts, surface CSS, node/bounds
metadata and `layout.json` with the exact saved record and source/publisher hashes.
The manifest advances only after all assets have been written. Keep previously
committed versions for clients already loading them. Rollbacks must restore a
viewer compatible with its manifest format.

Reproduce a publication from its matching source revision with:

```sh
npm run pipeline:publish -- --state=public/pipeline/published/<version>/layout.json
```

`--state` also accepts a raw saved API response. `--source=https://…/api/pipeline_edits`
selects another saved-record endpoint.

## Verification and claims

`npm run pipeline:check` covers routing, source/saved-state provenance, original
full-window SVG, absence of visible peripheral UI, immediate pan/wheel/pinch,
continuous first zoom, animation at reading zoom, deep vector zoom, keyboard
navigation, canvas resize, draft/API isolation, reduced motion and load errors in
desktop, phone and tablet Chromium contexts. Add
`-- https://www.zeroshot.bio --routes` to check the live presentation.

Editor checks stub API writes:

```sh
node public/pipeline/check-save.mjs http://127.0.0.1:8765/pipeline/index.html
node public/pipeline/check-edit.mjs http://127.0.0.1:8765/pipeline/index.html
node public/pipeline/check-group-select.mjs http://127.0.0.1:8765/pipeline/index.html
node public/pipeline/check-group-visible.mjs http://127.0.0.1:8765/pipeline/index.html
node public/pipeline/check-dots.mjs http://127.0.0.1:8765/pipeline/index.html
```

The schematic, original wording and modelled cull figures retain their original
meaning. Animation is not evidence of a measured run or biological timing. This
is live SVG; browser checks do not promise a physical-device frame rate. Do not
test layout mutation against the real shared record. `HANDOFF.md` describes other
authoring checks. The website remains a preview area with the existing editor/API
access model.
