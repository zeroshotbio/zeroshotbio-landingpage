/* Where things ACTUALLY DRAW, in world units, before and after a reload.
   Screen positions are useless across a reload because the camera re-fits, so
   every bbox centre is pushed back through the world CTM. */
import { chromium } from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1700,height:1000}});
p.on('pageerror',e=>console.log('PAGEERROR',e.message));
let record=null, stamp=0;
await p.route('**/api/fqpipe_edits', r=>{
  if(r.request().method()==='POST'){ record=JSON.parse(r.request().postData()||'{}').offsets; stamp+=1000;
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,at:stamp})}); }
  return r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({offsets:record,at:record?stamp:null})});
});
const U='http://127.0.0.1:8731/FASTQ_pipe/index.html';
const go=async()=>{await p.goto(U,{waitUntil:'networkidle'});await p.waitForTimeout(2400);};

/* bbox centre of a drawn group, in SVG world coordinates */
const drawn=()=>p.evaluate(()=>{
  const world=document.querySelector('#svg > g');
  const wm=world.getScreenCTM().inverse();
  const at=el0=>{ if(!el0) return null;
    /* the static part, where a shape animates — see check-drawn.mjs */
    const el=el0.querySelector?.('[data-fixed]')||el0;
    const r=el.getBoundingClientRect();
    const pt=new DOMPoint(r.x+r.width/2, r.y+r.height/2).matrixTransform(wm);
    return [+pt.x.toFixed(1), +pt.y.toFixed(1)]; };
  const out={};
  NODES.forEach(n=>{ out['node:'+n.id]=at(nodeEls[n.id]); out['name:'+n.id]=at(labelEls[n.id]); });
  MOVERS.forEach(m=>{ out[m.key]=at(m.g); });
  (typeof ANNOTATIONS==='undefined'?[]:ANNOTATIONS).forEach(a=>{ out['ann:'+a.key]=at(a.t1); });
  return out;
});
/* Grab the EDIT HANDLE, not the group's bbox centre — it is the thing a hand
   can actually grab, and on the neighbouring map a bbox centre could land on a
   different object entirely and report it as "unmoved" for the wrong reason. */
const hit=(id,kind)=>p.evaluate(([i,k])=>{
  const host = k==='node' ? nodeEls[i] : labelEls[i];
  const h = host.querySelector('.ehandle') || host;
  const r = h.getBoundingClientRect();
  return {x:r.x+r.width/2, y:r.y+r.height/2};
},[id,kind]);

async function trial(label,id,kind,dx,dy){
  await go();
  await p.locator('#btnEdit').click(); await p.waitForTimeout(400);
  const t=await hit(id,kind);
  await p.mouse.move(t.x,t.y); await p.mouse.down();
  await p.mouse.move(t.x+dx,t.y+dy,{steps:16}); await p.mouse.up(); await p.waitForTimeout(400);
  const A=await drawn();
  await p.locator('#btnSave').click(); await p.waitForTimeout(1400);
  await go();
  const B=await drawn();
  const key=(kind==='node'?'node:':'name:')+id;
  const moved=Math.hypot(A[key][0]-B[key][0], A[key][1]-B[key][1]);
  console.log(`${label.padEnd(26)} drawn at ${JSON.stringify(A[key])} -> ${JSON.stringify(B[key])}  `+
    (moved<0.6?'STICKS':`*** LOST, off by ${moved.toFixed(1)} world units ***`));
}
await trial('GA building','E5','node',120,-60);
await trial('GA name','E5','name',70,-80);
await trial('FASTQ landmark','FQ','node',-90,60);
await trial('"UNFILTERED DGE"','UD','name',80,-70);
await b.close();
