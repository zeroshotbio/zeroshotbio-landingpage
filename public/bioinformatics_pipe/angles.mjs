/* angles.mjs — what angle is a string on a roof actually at?
   Run: node angles.mjs [url]                (needs playwright)

   Roof text is laid out in a flat chart space and pushed through one matrix,
   so nothing about the transform attribute tells you how it comes out. Two
   things do, and only these two:

     advance   the image of (1,0) — the direction the glyphs run
     glyphUp   the image of (0,-1) — which way is up for a glyph

   A quarter turn has two signs and both of them look plausible written down;
   one of them produces text running right to left with its tops pointing
   down, which reads as upside down and is easy to miss on a sheared roof at
   a glance. Print the two angles instead of guessing.

   For reference, as the page stands: everything flat is advance -30, and the
   turned y title is advance +30 with its tops up.
*/
import { chromium } from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1700,height:1000}});
await p.route('**/api/bpipe_edits',r=>r.fulfill({status:200,contentType:'application/json',body:'{"offsets":null,"at":null}'}));
await p.goto(process.argv[2]||'http://127.0.0.1:8731/bioinformatics_pipe',{waitUntil:'networkidle'});
await p.waitForTimeout(1600);
const out=await p.evaluate(()=>{
  const r=[];
  document.querySelectorAll('#svg text').forEach(t=>{
    const s=(t.textContent||'').trim();
    if(!/^(BARCODES, RANKED|TRANSCRIPTS|CELLS|MITOCHONDRIAL %|GENES|EXPRESSION 1|EXPRESSION 2)$/.test(s)) return;
    const m=t.getScreenCTM(); if(!m) return;
    // advance direction of text = image of (1,0); glyph-up = image of (0,-1)
    const ax=m.a, ay=m.b, ux=-m.c, uy=-m.d;
    const deg=v=>+(Math.atan2(v[1],v[0])*180/Math.PI).toFixed(1);
    r.push([s, 'advance '+deg([ax,ay]), 'glyphUp '+deg([ux,uy]), 'det '+(m.a*m.d-m.b*m.c).toFixed(3)]);
  });
  return r;
});
out.forEach(o=>console.log(o.join('   ')));
await b.close();
