'use client';

/* ===========================================================================
   COLOR DEFINITIONS — all in RGBA string format for easy tweaking
   =========================================================================== */

const COLOR_BG            = 'rgba(255,255,255,1)';      // white background
const COLOR_DIVIDER       = 'rgba(229,231,235,1)';      // light grey divider
const COLOR_GRID          = 'rgb(159, 75, 203)';      // muted grid dots
const COLOR_PIN           = 'rgba(239,68,68,1)';        // vivid red pins
const COLOR_PIN_HIGHLIGHT = 'rgb(253, 74, 71)';       // yellow hover highlight
const COLOR_ARROW         = 'rgba(107,114,128,1)';      // grey arrows
const COLOR_LABEL         = 'rgb(0, 0, 0)';         // dark label text

// Alias for quick swaps
const BG_COLOR      = COLOR_BG;
const DIVIDER_COLOR = COLOR_DIVIDER;
const GRID_COLOR    = COLOR_GRID;
const PIN_COLOR     = COLOR_PIN;
const PIN_HIGHLIGHT = COLOR_PIN_HIGHLIGHT;
const ARROW_COLOR   = COLOR_ARROW;
const LABEL_COLOR   = COLOR_LABEL;

/* ===========================================================================
   OTHER TUNABLE PARAMETERS (sizes, radii, timings)
   =========================================================================== */

const GRID_SPACING        = 10;
const GRID_DOT_RADIUS     = 2;
const GRID_BASE_ALPHA     = 0.1;
const GRID_GLOBAL_NOISE   = 0.05;
const FLASHLIGHT_RADIUS   = 120;
const FLASHLIGHT_POWER    = 16;
const FLASHLIGHT_BOOST    = 0.6;
const PIN_RADIUS_BASE     = 2.4;
const PIN_RADIUS_HOVER    = 3.2;
const PIN_SHADOW_BLUR     = 8;
const PIN_PULSE_MS        = 1300;
const HIT_RADIUS          = 16;
const ARROW_CONF = {
  lineWidth: 1.2,
  headLength: 6,
  headAngle: Math.PI / 7
};


import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import type { MouseEvent } from 'react';
/* helper that converts an ordered list of IDs into an id→index map */
function buildIndex(list: string[]) {
  const m = new Map<string, number>();
  list.forEach((id, i) => m.set(id, i));
  return m;
}

interface EdgePayload {
  fishGenes:  string[];
  humanGenes: string[];
  edges: {
    zebrafish_id: string;
    human_id: string;
    orthology_type: string;
    confidence: number;   // 0-1
    validated:  boolean;
  }[];
  counts: Record<string, number>;
}

/* ========================================================================== */
/* CONFIGURATION — enhanced UMAP-like blobs, subtle grid, and inter-region arrows    */
/* ========================================================================== */

const THEME = {
  bg: '#ffffff',
  divider: '#e5e7eb',
  grid: '#9ca3af',
  pin: '#ef4444',         // vibrant red pins
  pinHighlight: '#fde047',
  labelFont: 'ui-serif, Georgia, serif',
  blobLabels: '#1f2937',
  arrow: '#6b7280'
};

const GRID = { spacing: 8, dotRadius: 1, baseAlpha: 0.1, globalNoise: 0.05 };
const FLASHLIGHT = { radius: 120, power: 0.7, boost: 0.6 };
const PINS = { base: 2.4, hover: 3.2, glow: 8, pulse: 1300 };

/* ========================================================================== */
/* UMAP-BLOB DEFINITIONS — sub-cell types instead of healthy/disease          */
/* ========================================================================== */

interface BlobDef {
  id: string;
  center: [number, number];
  worldRadius: number;
  gradient: [string, string];
  label: string;
}

// Blob color gradients (RGBA strings)
const BLOB_COLORS = {
  basal:   { start: 'rgba(59,130,246,0.2)', end: 'rgba(59,130,246,0)' },
  luminal: { start: 'rgba(16,185,129,0.2)', end: 'rgba(16,185,129,0)' },
  stem:    { start: 'rgba(234,179,8,0.2)',   end: 'rgba(234,179,8,0)' },
  stromal: { start: 'rgba(107,33,168,0.2)',  end: 'rgba(107,33,168,0)' }
};

// UMAP-like blob definitions — sub-cell types
const BLOBS: BlobDef[] = [
  { id: 'basal',   center: [-1.0,  0.5], worldRadius: 0.8, gradient: [BLOB_COLORS.basal.start,   BLOB_COLORS.basal.end],   label: 'Basal Cells' },
  { id: 'luminal', center: [ 1.2,  0.8], worldRadius: 0.7, gradient: [BLOB_COLORS.luminal.start, BLOB_COLORS.luminal.end], label: 'Luminal Cells' },
  { id: 'stem',    center: [ 0.5, -1.2], worldRadius: 0.9, gradient: [BLOB_COLORS.stem.start,    BLOB_COLORS.stem.end],    label: 'Cancer Stem Cells' },
  { id: 'stromal', center: [-0.5, -0.8], worldRadius: 0.6, gradient: [BLOB_COLORS.stromal.start, BLOB_COLORS.stromal.end], label: 'Stromal Cells' }
];

/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

interface Dot { sx: number; sy: number; }
interface Pt  { sx: number; sy: number; }
interface Pair {
  fish: Pt;
  human: Pt;
  conf: number;
  anchor: boolean;
  geneFish: string;
  geneHuman: string;
}

/* ========================================================================== */
/* UTILITIES                                                                  */
/* ========================================================================== */


function generateGrid(w: number, h: number, left: boolean): Dot[] {
  const half = w / 2;
  const cols = Math.ceil(half / GRID.spacing) + 1;
  const rows = Math.ceil(h / GRID.spacing) + 1;
  const startX = left ? 0 : half;
  const dots: Dot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = startX + c * GRID.spacing;
      const sy = r * GRID.spacing;
      dots.push({ sx, sy });
    }
  }
  return dots;
}


/* ========================================================================== */
/* CANVAS COMPONENT                                                            */
/* ========================================================================== */

function TranslationCanvas({ w = 900, h = 500 }: { w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [slider, setSlider] = useState(0);
  const [fishDots, setFishDots] = useState<Dot[]>([]);
  const [humanDots, setHumanDots] = useState<Dot[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [hover, setHover] = useState<Pair | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const raf = useRef<number>();

useEffect(() => {
  fetch("/api/orthologs")
    .then(r => r.json())
    .then((d: EdgePayload) => {
      /* lay out the fixed grids once we know canvas size */
      const fishGrid  = generateGrid(w, h, true);   // left half
      const humanGrid = generateGrid(w, h, false);  // right half

      /* build quick lookup maps */
      const fishMap  = buildIndex(d.fishGenes);
      const humanMap = buildIndex(d.humanGenes);

      /* translate every edge into a canvas Pair */
      const edgePairs = d.edges.map(e => {
        const fIdx = fishMap.get(e.zebrafish_id)! % fishGrid.length;
        const hIdx = humanMap.get(e.human_id)!    % humanGrid.length;
        return {
          fish: fishGrid[fIdx],
          human: humanGrid[hIdx],
          conf: e.confidence,
          anchor: e.validated,         // highlight if ZFIN-validated
          geneFish:  e.zebrafish_id,
          geneHuman: e.human_id
        };
      }).sort((a, b) => b.conf - a.conf);          // strong first

      setFishDots(fishGrid);
      setHumanDots(humanGrid);
      setPairs(edgePairs);
    });
}, [w, h]);


  const draw = useCallback(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    // clear
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);

    // divider
    ctx.strokeStyle = THEME.divider;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    // blobs
    BLOBS.forEach(b => {
      const [wx, wy] = b.center;
      const cx = (wx / 4 + 0.5) * (w / 2) + (wx > 0 ? w / 2 : 0);
      const cy = (wy / 4 + 0.5) * h;
      const r  = (b.worldRadius / 4) * (w / 2);
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, b.gradient[0]);
      g.addColorStop(1, b.gradient[1]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
      
      // label
      ctx.fillStyle = THEME.blobLabels;
      ctx.font = `500 12px ${THEME.labelFont}`;
      ctx.textAlign = 'center';
      ctx.fillText(b.label, cx, cy - r - 6);
    });

    // grid with flashlight
    const renderGrid = (dots: Dot[]) => {
      ctx.fillStyle = THEME.grid;
      dots.forEach(d => {
        let a = GRID.baseAlpha;
        if (mouse) {
          const dist = Math.hypot(mouse.x - d.sx, mouse.y - d.sy);
          const fl   = Math.max(0, 1 - dist / FLASHLIGHT.radius);
          a         = Math.min(1, a + Math.pow(fl, FLASHLIGHT.power) * FLASHLIGHT.boost);
        }
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(d.sx, d.sy, GRID.dotRadius, 0, 2 * Math.PI);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    renderGrid(fishDots);
    renderGrid(humanDots);

    // inter-region arrows
    BLOBS.forEach(b => {
      const [wx, wy] = b.center;
      const cx = (wx / 4 + 0.5) * (w / 2) + (wx > 0 ? w / 2 : 0);
      const cy = (wy / 4 + 0.5) * h;
      
      [[cx, cy, 1], [w - cx, cy, -1]].forEach(([x, y, dir]) => {
        ctx.strokeStyle = THEME.arrow;
        ctx.lineWidth   = ARROW_CONF.lineWidth;
        const dx = dir * 30;
        const dy = 0;
        
        // main line
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx, y + dy);
        ctx.stroke();
        
        // arrowhead
        const ang = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(
          x + dx - ARROW_CONF.headLength * Math.cos(ang - ARROW_CONF.headAngle),
          y + dy - ARROW_CONF.headLength * Math.sin(ang - ARROW_CONF.headAngle)
        );
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(
          x + dx - ARROW_CONF.headLength * Math.cos(ang + ARROW_CONF.headAngle),
          y + dy - ARROW_CONF.headLength * Math.sin(ang + ARROW_CONF.headAngle)
        );
        ctx.stroke();
      });
    });

    // pins
    const prog = slider / 100;
    const vis  = pairs.filter((p, i) => p.anchor || i / pairs.length < prog);
    const t    = (Date.now() % PINS.pulse) / PINS.pulse;
    vis.forEach(p => {
      // determine styling
      const isHover = hover === p;
      const glowFactor = isHover ? 1 : 0.7 + 0.3 * Math.sin(2 * Math.PI * t);
      const alpha = p.anchor ? 1 : 0.5 + 0.5 * prog;
      const radius = isHover ? PINS.hover : PINS.base;

      // base pin with contrast border
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = THEME.grid;
      ctx.fillStyle = isHover ? THEME.pinHighlight : '#f87171';  // highlight base pins with red hue
      ctx.globalAlpha = alpha * glowFactor;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur  = PINS.glow;
      [p.fish, p.human].forEach((pt, idx) => {
        // circle
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        // label: gene symbol small
        ctx.font = `300 10px ${THEME.labelFont}`;
        ctx.fillStyle = '#1f2937';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1;
        ctx.fillText(idx === 0 ? p.geneFish : p.geneHuman, pt.sx, pt.sy - radius - 4);
      });
      // reset
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    });

    // labels & coverage
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.font      = `300 15px ${THEME.labelFont}`;
    ctx.textAlign = 'center';
    ctx.fillText('Zebrafish Embedding', w * 0.25, 24);
    ctx.fillText('Human Embedding',    w * 0.75, 24);
    ctx.textAlign = 'right';
    const validatedPct = (pairs.filter(p => p.anchor).length / (pairs.length || 1)) * 100;
    ctx.fillText(`ZFIN-validated ${validatedPct.toFixed(0)}%`, w - 14, h - 18);
    raf.current = requestAnimationFrame(draw);
  }, [w, h, fishDots, humanDots, pairs, slider, hover, mouse]);

  useEffect(() => {
    raf.current = requestAnimationFrame(draw);
    return () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, [draw]);

  const onMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    setMouse({ x, y });
    const det  = 16;  // increased hit radius

    const prog = slider / 100;
    const vis  = pairs.filter((p, i) => p.anchor || i / pairs.length < prog);
    let f: Pair | null = null;
    for (const p of vis) {
      if (Math.hypot(x - p.fish.sx, y - p.fish.sy) < det || Math.hypot(x - p.human.sx, y - p.human.sy) < det) {
        f = p;
        break;
      }
    }
    setHover(f);
  };

  return (
    <div className="relative">
      <canvas
        ref={ref}
        width={w}
        height={h}
        className="border border-gray-200"
        onMouseMove={onMove}
        onMouseLeave={() => { setMouse(null); setHover(null); }}
      />
      <input
        type="range"
        min={0}
        max={100}
        value={slider}
        onChange={e => setSlider(+e.target.value)}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 w-1/2"
      />
      {hover && (
        <div
          className="absolute pointer-events-none text-xs bg-white/95 backdrop-blur-sm border border-gray-300 rounded px-2 py-1 shadow-lg"
          style={{ left: hover.fish.sx + 12, top: hover.fish.sy - 12 }}
        >
          <div className="roboto-slab-medium text-gray-900">
            {hover.geneFish} ↔ {hover.geneHuman}
          </div>
          <div className="text-gray-600">
            confidence {(hover.conf * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================================================================= */
/* WRAPPERS (Desktop & Mobile)                                            */
/* ======================================================================= */

const Desktop = () => (
  <main className="hidden sm:flex flex-col items-center justify-center min-h-screen p-8">
    <header className="text-center mb-10">
      <Link href="/" className="inline-block mb-6 text-gray-600 hover:text-gray-800 roboto-slab-regular text-sm">
        ← Back
      </Link>
      <h1 className="roboto-slab-medium text-2xl text-gray-dark mb-4">
        Ortholog Constellations
      </h1>
      <p className="roboto-slab-regular text-base text-gray-semidark max-w-2xl mx-auto leading-relaxed">
        Hover to explore sub-cell compartments; slide to reveal conserved gene pins and inter-region arrows.
      </p>
    </header>
    <TranslationCanvas w={900} h={500} />
    <p className="roboto-slab-regular text-sm text-gray-medium text-center max-w-2xl mt-8">
      Gradient blobs denote cell subtypes; arrows illustrate cross-compartment flow; pins mark ortholog anchors.
    </p>
  </main>
);

const Mobile = () => (
  <main className="flex sm:hidden flex-col items-center justify-center min-h-screen p-5">
    <header className="text-center mb-6">
      <Link href="/" className="inline-block mb-3 text-gray-600 hover:text-gray-800 text-sm">
        ← Back
      </Link>
      <h1 className="roboto-slab-medium text-lg text-gray-dark">Ortholog Pins</h1>
    </header>
    <TranslationCanvas w={350} h={260} />
    <p className="roboto-slab-regular text-xs text-gray-medium text-center mt-4">
      Tap and slide to reveal gene pairs and directional flow across cell types.
    </p>
  </main>
);

export default function TranslationFidelityPage() {
  return (
    <>
      <Desktop />
      <Mobile />
    </>
  );
}