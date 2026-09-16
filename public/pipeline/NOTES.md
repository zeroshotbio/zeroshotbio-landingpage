# Aquarium to Atlas: guided viewer and editor

`/pipeline` is a guided presentation of the original editor's vector scene. It
opens with all five existing rows visible and completely still. The overview
ignores pan, wheel, pinch and zoom keys. Click a row or its section button to hide
the other rows and zoom into that section over 650 ms. The rows retain their saved
names: Biological samples, Molecular biology, Reads to a matrix, The cull, and
Opinionated metadata.

Only after the camera arrives does motion start. A four-second startup wave moves
from upstream to downstream, with each station smoothly accelerating over 1.8
seconds. Directed track depth orders the wave, keeping parallel inputs ahead of
their shared downstream steps. Both delta time and absolute time passed to drawing
callbacks use each animation's virtual clock, so sine-based motion slows down too.
Moving track dots follow the same ramp. Inactive sections receive no callbacks.

The button at the production line's end moves to the next section and restarts
the ramp there. The last returns to the overview. **All sections**, Escape, Home
or 0 also return to the overview (Escape closes an open reader first). Inside a
section, pan and wheel/pinch/keyboard zoom work with the original SVG geometry;
there is no upper zoom cap or rasterized artwork. **Fit section** restores the
section framing. Clicking a node opens its original explanation on the right.
The reader overlays the right side on phones and is closable.

**Pause motion** freezes clocks; resuming continues from the same point. Reduced
motion skips camera glides and starts animation paused, with an explicit Play
control. Returning to the overview stops continuous animation work. Hidden browser
tabs also stop scheduling frames, without catching up on return. The last row's
buildings have no original animation callbacks; its track dots provide motion.

## Original artwork and editor

The hidden same-origin engine frame initializes the versioned editor code in
presentation mode. The viewer adopts its actual SVG world and definitions,
retaining callback references, original shapes, labels, tracks, colors and full
vector detail. The adapter associates node, label, plinth, track and band elements
with their sections. It uses lane membership and attached structures' parent nodes
before falling back to authored row coordinates. Saved nudges cannot accidentally
move an object into a different section.

Presentation mode suppresses the editor's own animation loop, hover behavior,
authoring features and API polling. The viewer controls section visibility,
camera, clocks, selection and canvas dots. Original reader functions provide the
HTML, including saved wording, modelled values, clone descriptions and copy blocks.
A seven-millisecond round-robin callback budget prevents one long section from
monopolizing every frame. This remains live vector animation: physical-device
performance needs testing, and no fixed frame rate is promised.

`/pipeline_edit` and `/pipeline/index.html` keep the original authoring system,
including position, resize, annotation, text, visual-request and save tools. They
retain `pipeline.edits` and the shared saved record. The presentation does not
read browser drafts or contact editing/prompt APIs.

## Publishing

1. Save in `/pipeline_edit` and wait for the confirmed read-back message.
2. Run `npm run pipeline:publish` from the repository. It reads the shared saved
   record and the local checkout's source, then writes a new version under
   `public/pipeline/published/<version>/`. It never writes the shared record,
   commits or pushes. Invalid/unavailable saved records abort publication.
3. Review locally and run `npm run pipeline:check` against a static server:
   `python3 -m http.server 8765 --bind 127.0.0.1 --directory public`.
4. Commit the new directory and `published/current.json`, then push to `main`.
   Vercel deploys them together. Editor saves alone do not publish the show page.

On a fresh machine install locked dependencies and `npx playwright install
chromium`. Vercel serves the committed assets without running a browser at build.
Format 3 includes versioned source scripts/engine HTML, original palette and reader
CSS, section metadata and a `layout.json` with the exact saved record and source/
publisher hashes. `current.json` advances only after all files are written. A
seeded random generator keeps initialization reproducible. No image flattening is
used in this version.

To reproduce a publication from the matching source revision:

```sh
npm run pipeline:publish -- --state=public/pipeline/published/<version>/layout.json
```

`--state` also accepts a raw saved API response. `--source=https://…/api/pipeline_edits`
selects another endpoint. Retain committed older versions for clients already
loading them. Rollbacks must restore a viewer compatible with the manifest format.

## Claims and verification

The schematic, wording, modelled cull figures and original animations are retained.
The startup wave is a presentation effect, not a claim about biological durations,
process throughput or measured completion. Source timing within each drawing is
unchanged once it reaches full speed.

`npm run pipeline:check` verifies route precedence, provenance, an idle locked
overview, reachable section selectors, camera-before-animation sequencing, actual
ramped virtual clocks, inactive geometry remaining still, deep vector zoom, the
original right reader, every next-section transition, returning/cancelling,
light/dark colors, API/draft isolation, reduced motion and load failures in desktop,
phone and tablet Chromium contexts. Add `-- https://www.zeroshot.bio --routes` to
check the deployed presentation.

Editor checks accept the editor URL and stub writes:

```sh
node public/pipeline/check-save.mjs http://127.0.0.1:8765/pipeline/index.html
node public/pipeline/check-edit.mjs http://127.0.0.1:8765/pipeline/index.html
node public/pipeline/check-dots.mjs http://127.0.0.1:8765/pipeline/index.html
```

Do not test layout mutation against the real shared record. See `HANDOFF.md` for
other authoring checks. The entire website remains a preview area; this route split
does not change the editor/API access model.
