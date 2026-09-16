#!/usr/bin/env node
// Freeze the saved editor layout using the actual renderer, then atomically
// advance the public manifest. No writes to the shared editor record or git.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const statePath = arg('state');
const endpoint = arg('source') || 'https://www.zeroshot.bio/api/pipeline_edits';
const rawState = statePath ? JSON.parse(await readFile(resolve(statePath), 'utf8')) : await (async () => {
  const r = await fetch(endpoint, {signal: AbortSignal.timeout(30000)});
  if (!r.ok) throw new Error(`Saved layout request failed: ${r.status}`);
  return r.json();
})();
const state = rawState.state || rawState;
if (state.error || typeof state.at !== 'number' || !state.at || !state.offsets || !state.text) throw new Error('No valid saved layout. Refusing to publish a fallback.');
const files = ['pipeline/index.html', 'pipeline/pipeline-iso.js', 'pipeline/pipeline-shapes.js',
  'culls/culls-pop.js', 'culls/culls-draw.js', 'pipeline/pipeline-fqshapes.js',
  'pipeline/pipeline-data.js', 'pipeline/pipeline-view.js'];
const sourceHashes = Object.fromEntries(await Promise.all(files.map(async f =>
  [f, createHash('sha256').update(await readFile(resolve(root, 'public', f))).digest('hex')])));
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, 'public', '.' + path);
    if (!file.startsWith(resolve(root, 'public') + '/')) throw new Error('Invalid path');
    const data = await readFile(file);
    res.setHeader('Content-Type', ({'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1600,height:1000}, reducedMotion:'reduce'});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/api/**', route => route.fulfill({json: route.request().url().includes('_edits') ? state : {prompts:[]}}));
  await page.addInitScript(doc => {
    localStorage.setItem('pipeline.edits', JSON.stringify(doc));
    let seed=246813579; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  }, state);
  await page.goto(`http://127.0.0.1:${server.address().port}/pipeline/index.html`, {waitUntil:'networkidle'});
  await page.evaluate(() => {
    playing=false; anim=null;
    // A reproducible, populated pose rather than each machine's empty frame 0.
    for(let i=0;i<150;i++) for(const tick of TICKERS) tick(1/60, i*1000/60, 1);
    placeDots(0);
  });
  if(errors.length) throw new Error(errors.join('\n'));
  const result = await page.evaluate(() => {
    const b=contentBox(), pad=36;
    const bounds={x:Math.floor(b.x-pad),y:Math.floor(b.y-pad),width:Math.ceil(b.width+pad*2),height:Math.ceil(b.height+pad*2)};
    const stages=NODES.filter(n=>!n.scenery&&!n.skipIndex).map(n=>{
      const p=P(n.x,n.y,(n.h||0)/2);
      const plain=s=>{const d=document.createElement('div');d.innerHTML=s||'';return d.textContent;};
      return {id:n.id,key:n.key,name:n.name,group:n.group,description:plain(n.does),x:p[0]-bounds.x,y:p[1]-bounds.y};
    });
    const themes={};
    for(const theme of ['dark','light']) {
      document.body.classList.toggle('light',theme==='light');
      const copy=svg.cloneNode(true);
      // CSS variables are resolved once at publication, including nested aliases.
      const palette=getComputedStyle(document.body);
      const resolveVars=s=>s.replace(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g,(_,key,fallback)=>palette.getPropertyValue(key).trim() || fallback || '');
      const originals=[svg,...svg.querySelectorAll('*')], clones=[copy,...copy.querySelectorAll('*')];
      for(let i=0;i<clones.length;i++) {
        const e=clones[i], original=originals[i];
        for(const a of [...e.attributes]) {
          if(a.value.includes('var(')) e.setAttribute(a.name,resolveVars(a.value));
          if(a.name.startsWith('on')||['tabindex','role','aria-label'].includes(a.name))e.removeAttribute(a.name);
        }
        // Text inherits its font from HTML in the editor; carry it into the image.
        if(e.tagName==='text') {
          const cs=getComputedStyle(original);
          for(const k of ['font-family','font-size','font-weight','font-style','letter-spacing','text-transform'])e.style.setProperty(k,cs.getPropertyValue(k));
        }
      }
      copy.querySelectorAll('.ehandle,.ehit,.thandle,script,foreignObject').forEach(e=>e.remove());
      clones[originals.indexOf(world)].removeAttribute('transform');
      // Dots live on a separate canvas in the editor; bake their static pose here.
      const dotCopy=clones[originals.indexOf(gDot)];
      dotCopy.style.removeProperty('display');
      DOTS.forEach(r=>{
        const e=clones[originals.indexOf(r.node)];e.setAttribute('transform',`translate(${r.x},${r.y})`);
        if(r.op!==undefined)e.setAttribute('opacity',r.op);
        e.firstElementChild?.remove();
      });
      copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
      copy.setAttribute('viewBox',`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
      copy.setAttribute('width',bounds.width);copy.setAttribute('height',bounds.height);
      copy.removeAttribute('id');copy.removeAttribute('class');
      copy.style.cssText=`background:${palette.getPropertyValue('--bg').trim()};font-family:${palette.fontFamily};font-size:12px`;
      themes[theme]=new XMLSerializer().serializeToString(copy);
    }
    return {bounds,stages,themes,title:OVERVIEW.title};
  });
  const provenance={format:1,state,sourceHashes,poseSeconds:2.5};
  const version=createHash('sha256').update(JSON.stringify(provenance)).update(result.themes.dark).update(result.themes.light).digest('hex').slice(0,20);
  const dir=resolve(root,'public/pipeline/published',version);
  await mkdir(dir,{recursive:true});
  for(const theme of ['dark','light'])await writeFile(resolve(dir,`${theme}.svg`),result.themes[theme]);
  await writeFile(resolve(dir,'layout.json'),JSON.stringify(provenance,null,2)+'\n');
  const manifest={format:1,version,publishedAt:new Date().toISOString(),savedAt:state.at,title:result.title,
    bounds:result.bounds,stages:result.stages,themes:Object.fromEntries(['dark','light'].map(t=>[t,`/pipeline/published/${version}/${t}.svg`]))};
  const pointer=resolve(root,'public/pipeline/published/current.json');
  await writeFile(pointer+'.tmp',JSON.stringify(manifest,null,2)+'\n');await rename(pointer+'.tmp',pointer);
  console.log(`Published snapshot ${version}, saved ${new Date(state.at).toISOString()}, ${result.stages.length} stages, ${result.bounds.width} × ${result.bounds.height}.`);
  console.log('Review /pipeline locally, then commit the published directory and push to deploy.');
} finally { await browser?.close(); await new Promise(r=>server.close(r)); }
