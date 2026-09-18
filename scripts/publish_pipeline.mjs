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
  'pipeline/pipeline-data.js', 'pipeline/pipeline-view.js', 'pipeline/presentation-engine.js', 'pipeline/surface.css'];
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
    window.MAP_CONFIG={presentation:true,minZoom:.01,maxZoom:Infinity,state:doc};
    let seed=246813579; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  }, state);
  await page.goto(`http://127.0.0.1:${server.address().port}/pipeline/index.html`, {waitUntil:'networkidle'});
  if(errors.length) throw new Error(errors.join('\n'));
  await page.addScriptTag({path:resolve(root,'public/pipeline/presentation-engine.js')});
  const result=await page.evaluate(()=>pipelinePresentation.describe());
  const publisherHash=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
  const provenance={format:4,state,sourceHashes,publisherHash};
  const version=createHash('sha256').update(JSON.stringify(provenance)).update(JSON.stringify(result)).digest('hex').slice(0,20);
  const dir=resolve(root,'public/pipeline/published',version),base=`/pipeline/published/${version}`;
  await mkdir(dir,{recursive:true});
  await writeFile(resolve(dir,'layout.json'),JSON.stringify(provenance,null,2)+'\n');
  const original=await readFile(resolve(root,'public/pipeline/index.html'),'utf8');
  await writeFile(resolve(dir,'surface.css'),await readFile(resolve(root,'public/pipeline/surface.css')));
  let engine=original.replace('</head>',`<link rel="stylesheet" href="${base}/surface.css"></head>`);
  const bootstrap=`<script>window.MAP_CONFIG={presentation:true,minZoom:.01,maxZoom:Infinity,state:${JSON.stringify(state).replaceAll('<','\\u003c')}};(()=>{let s=246813579;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})();<`+'/script>';
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
  const manifest={format:4,version,publishedAt:new Date().toISOString(),savedAt:state.at,
    ...result,engine:`${base}/engine.html`};
  const pointer=resolve(root,'public/pipeline/published/current.json');
  await writeFile(pointer+'.tmp',JSON.stringify(manifest,null,2)+'\n');await rename(pointer+'.tmp',pointer);
  console.log(`Published snapshot ${version}, saved ${new Date(state.at).toISOString()}, ${result.nodes.length} nodes, ${result.bounds.width} × ${result.bounds.height}.`);
  console.log('Review /pipeline locally, then commit the published directory and push to deploy.');
} finally { await browser?.close(); await new Promise(r=>server.close(r)); }
