# zeroshotbio-landingpage

Next.js app, deployed to zeroshot.bio via Vercel (`main` auto-deploys). EC2 backend services.

## Working in a subtree? Read its CLAUDE.md first.
- **`src/app/daniotype_kasperov/`** (the DanioType / Kasperov cell-type-labeller pipeline) has its
  own `CLAUDE.md` with the rules, provenance system, and known traps for that subsystem.
  **Read it before touching any pipeline stage — a fresh session at repo root will not load it
  automatically.**

## Building a page? Pick a style before you pick a colour.
- **`PLATE_STYLE.md`** is the house style for FIGURE pages — pages whose job is to be read
  rather than operated. `/fate_map` is the reference implementation. It carries the tokens,
  the typography, the canvas practice, and the rules that are easy to get wrong
  (one ink before colour; isolate rather than hide; never rescale a comparison to fill its
  frame; furniture may be hand-drawn, data never is).
- The other house style is the dark monospace INSTRUMENT shell shared by `/pipeline`,
  `/data_structures`, `/bioinformatics_pipe`, `/FASTQ_pipe` and `/molecular_pipe` — for
  pages that expose machinery. `PLATE_STYLE.md` opens with a table for choosing between
  the two. Choosing wrong is the expensive mistake, not choosing the wrong hue.
- Either way, a static viz page is self-contained in `public/<name>/` with a rewrite and a
  `no-cache` header pair in `next.config.js`, absolute `<script src>`, and a `NOTES.md`
  saying what the picture does and does not claim.
