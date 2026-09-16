#!/usr/bin/env node
// Publish the saved editor layout and original animation engine, then atomically
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
  'pipeline/pipeline-data.js', 'pipeline/pipeline-view.js', 'pipeline/presentation-engine.js'];
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
    window.MAP_CONFIG={presentation:true,state:doc};
    let seed=246813579; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  }, state);
  await page.goto(`http://127.0.0.1:${server.address().port}/pipeline/index.html`, {waitUntil:'networkidle'});
  if(errors.length) throw new Error(errors.join('\n'));
  const result = await page.evaluate(() => {
    playing=false; anim=null;
    const boxes={};
    function measure(){for(const n of NODES){const b=nodeEls[n.id].getBBox();
      const prev=boxes[n.id];boxes[n.id]=prev?{x:Math.min(prev.x,b.x),y:Math.min(prev.y,b.y),
        right:Math.max(prev.right,b.x+b.width),bottom:Math.max(prev.bottom,b.y+b.height)}:
        {x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height};}}
    measure();
    // Capture the animation envelope, not just one pose. The viewer can expand
    // an island later if a drawing legitimately grows outside this envelope.
    for(let i=0;i<120;i++){for(const tick of TICKERS)tick(.25,i*250,1);measure();}
    const b=contentBox(), pad=36;
    const bounds={x:Math.floor(b.x-pad),y:Math.floor(b.y-pad),width:Math.ceil(b.width+pad*2),height:Math.ceil(b.height+pad*2)};
    const nodes=NODES.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).map(n=>{
      const box=boxes[n.id],padding=24;
      return {id:n.id,name:n.name,key:n.key,scenery:!!n.scenery,
        box:{x:Math.floor(box.x-padding),y:Math.floor(box.y-padding),
          width:Math.ceil(box.right-box.x+padding*2),height:Math.ceil(box.bottom-box.y+padding*2)}};
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
      copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
      copy.setAttribute('viewBox',`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
      copy.setAttribute('width',bounds.width);copy.setAttribute('height',bounds.height);
      copy.removeAttribute('id');copy.removeAttribute('class');
      copy.style.cssText=`background:${palette.getPropertyValue('--bg').trim()};font-family:${palette.fontFamily};font-size:12px`;
      const worldCopy=clones[originals.indexOf(world)];
      // The original z-order is background, moving dots, node islands, labels.
      for(const layer of [gDot,gNode,gLabel])clones[originals.indexOf(layer)].remove();
      const background=new XMLSerializer().serializeToString(copy);
      worldCopy.replaceChildren(clones[originals.indexOf(gLabel)]);
      copy.style.removeProperty('background');
      const labels=new XMLSerializer().serializeToString(copy);
      themes[theme]={background,labels};
    }
    return {bounds,nodes,themes,title:OVERVIEW.title};
  });
  const publisherHash=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
  const provenance={format:2,state,sourceHashes,publisherHash};
  const version=createHash('sha256').update(JSON.stringify(provenance)).update(JSON.stringify(result)).digest('hex').slice(0,20);
  const dir=resolve(root,'public/pipeline/published',version),base=`/pipeline/published/${version}`;
  await mkdir(dir,{recursive:true});
  for(const theme of ['dark','light'])for(const layer of ['background','labels'])
    await writeFile(resolve(dir,`${theme}-${layer}.svg`),result.themes[theme][layer]);
  await writeFile(resolve(dir,'layout.json'),JSON.stringify(provenance,null,2)+'\n');
  const original=await readFile(resolve(root,'public/pipeline/index.html'),'utf8');
  const css=original.match(/<style>([\s\S]*?)<\/style>/)[1];
  const palette=css.slice(0,css.indexOf('  *{box-sizing'));
  const readerCSS=css.slice(css.indexOf('  .read{padding:14'),css.indexOf('  .strip{'));
  await writeFile(resolve(dir,'appearance.css'),palette+'\n'+readerCSS);
  let engine=original;
  const bootstrap=`<script>window.MAP_CONFIG={presentation:true,state:${JSON.stringify(state).replaceAll('<','\\u003c')}};(()=>{let s=246813579;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})();<`+'/script>';
  engine=engine.replace(/<script src=/,bootstrap+'\n<script src=');
  engine=engine.replace(/<script src="([^"?]+)(?:\?[^" ]*)?"><\/script>/g,(_,url)=>{
    const filename=url.split('/').pop();return `<script src="${base}/${filename}"></script>`;
  });
  engine=engine.replace('</body>',`<script src="${base}/presentation-engine.js"></script></body>`);
  // The published engine and assets are versioned together; no live drafts or
  // subsequent shape edits can leak into a visitor's already published scene.
  for(const file of files.filter(f=>f.endsWith('.js')))
    await writeFile(resolve(dir,file.split('/').pop()),await readFile(resolve(root,'public',file)));
  await writeFile(resolve(dir,'engine.html'),engine);
  const manifest={format:2,version,publishedAt:new Date().toISOString(),savedAt:state.at,title:result.title,
    bounds:result.bounds,nodes:result.nodes,engine:`${base}/engine.html`,appearance:`${base}/appearance.css`,
    themes:Object.fromEntries(['dark','light'].map(t=>[t,{background:`${base}/${t}-background.svg`,labels:`${base}/${t}-labels.svg`}]))};
  const pointer=resolve(root,'public/pipeline/published/current.json');
  await writeFile(pointer+'.tmp',JSON.stringify(manifest,null,2)+'\n');await rename(pointer+'.tmp',pointer);
  console.log(`Published snapshot ${version}, saved ${new Date(state.at).toISOString()}, ${result.nodes.length} nodes, ${result.bounds.width} × ${result.bounds.height}.`);
  console.log('Review /pipeline locally, then commit the published directory and push to deploy.');
} finally { await browser?.close(); await new Promise(r=>server.close(r)); }
