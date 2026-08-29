/* check-deploy.mjs — the update bar must not promise a deploy that has not
   happened yet.  Run: node check-deploy.mjs <url>     (needs playwright)
   Takes about three minutes; the floor under test is ninety seconds.

   THE QUEUE SAYS DONE WHEN IT HAS PUSHED, not when Vercel has served it — the
   daemon marks a request done on the line after git push returns. The bar that
   every OTHER open page shows used to go up right then, offering a Refresh that
   landed on the old map. This is that bug, held down.

   OLD=<path to an older pipeline-view.js> serves that file in place of the real
   one, so the check can be shown FAILING against the code it was written to
   catch. Use it after touching any of this. Three separate times this check
   passed for the wrong reason before it passed for the right one:
     - faking Date.now alone leaves the page's pollers on real timers, so in a
       one-second window nothing fires and every "the bar stayed down" passes
       because nothing ran;
     - Playwright's clock fakes the timers but fakes requestAnimationFrame too,
       and winding forward 45s replays thousands of frames of an animated map;
     - a route glob ending .js never matched the script tag, which carries a ?v=
       cache-buster, so the substitution missed and the page ran the real file.
   Each looked like proof. The tell for the last one: the message came back as
   the shell's static default instead of text this file had supplied.
*/
import { chromium } from 'playwright';
const URL = process.argv[2] || 'https://www.zeroshot.bio/pipeline';
const b = await chromium.launch({args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:1700,height:1000}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));

let etag = '"OLD-TAG"';
let promptDone = false;
const DONE_AT = Date.now();

/* THIS TEST RUNS IN REAL TIME and takes about three minutes. Both shortcuts
   were tried and both are wrong. Faking Date.now alone is vacuous: the page's
   pollers are real timers, so inside a one-second window they never fire and
   every "the bar stayed down" passes because nothing ran — the tell was the
   final message reading the shell's static default rather than anything this
   code had written. Playwright's clock does fake the timers, but it fakes
   requestAnimationFrame too, so winding forward 45 seconds replays thousands of
   frames of an animated SVG map and never finishes. The floor under test is
   ninety seconds; waiting it out is the cheap option. */

/* OLD=1 serves the pre-fix pipeline-view.js in place of the real one, without
   touching the working tree — the daemon may be editing that file. This test
   passed twice for the wrong reason before it passed for the right one, so it
   has to be shown failing against the code it was written to catch. */
if (process.env.OLD) {
  const { readFileSync } = await import('fs');
  const old = readFileSync(process.env.OLD, 'utf8');
  /* THE GLOB MUST TOLERATE THE QUERY STRING. index.html loads this script with
     a ?v= cache-buster on the end, and a glob ending in .js does not match a
     URL that continues past it — so the interception silently missed the script
     tag, the page ran the real file, and the "old code" run passed because it
     was never old. It caught only the in-page fetch used to verify it, which is
     exactly the shape of evidence that looks like proof and is not. */
  await p.route('**/pipeline-view.js*', r =>
    r.fulfill({status:200, contentType:'application/javascript', body:old}));
}
/* the asset the bar watches — HEAD only, ETag under our control */
await p.route('**/pipeline/pipeline-shapes.js', async r => {
  if (r.request().method() === 'HEAD')
    return r.fulfill({status:200, headers:{etag}, body:''});
  return r.continue();
});
await p.route('**/api/pipeline_edits', r =>
  r.fulfill({status:200,contentType:'application/json',
             body:JSON.stringify({offsets:null,text:null,at:null})}));
await p.route('**/api/pipeline_prompts*', r =>
  r.fulfill({status:200,contentType:'application/json',
    body: JSON.stringify({prompts: promptDone ? [{
      id:'pmtOTHER', text:'someone else asked for this', target:null,
      status:'done', at:DONE_AT-600000, updated:Date.now()+5000,
      note:'a change nobody on this page requested'}] : []})}));

await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForTimeout(3000);

const barUp = () => p.evaluate(() =>
  !!document.getElementById('newver')?.classList.contains('on'));
const tick = async ms => { await p.waitForTimeout(ms); };

let bad = 0; const fail = m => { bad++; console.log('  FAIL ' + m); };
if (await barUp()) fail('the bar was already up before anything happened');

/* the request finishes: pushed, NOT deployed */
promptDone = true;
await tick(52000);                       // past the 45s prompt poll
if (await barUp()) fail('the bar went up the moment the request was pushed — the deploy has not happened');
else console.log('pushed, not deployed  bar stays down  OK');

/* 60s later — still inside the 90s floor, asset still old */
await tick(60000);
if (await barUp()) fail('the bar went up ~60s after the push, inside the deploy floor');
else console.log('+60s  still no deploy   bar stays down  OK');

/* past the floor, but the asset has STILL not changed: nothing shipped */
await tick(45000);
if (await barUp()) fail('the bar went up past the floor while the asset was still the old one');
else console.log('+105s no deploy yet    bar stays down  OK');

/* now Vercel actually ships it */
etag = '"NEW-TAG"';
await tick(20000);
if (!await barUp()) fail('the deploy landed and the bar never went up');
else console.log('deploy lands          bar goes up      OK');

const what = await p.evaluate(() =>
  document.getElementById('newverWhat')?.textContent || '');
if (!/nobody on this page requested/.test(what))
  fail(`the bar went up without the note: "${what}"`);
else console.log(`message               "${what.slice(0,60)}..."`);

console.log(bad ? `\n${bad} FAILURE(S)`
  : '\ndeploy bar: a push alone never raises it, the floor holds, and it goes up when the asset actually changes');
if (errs.length) console.log('page errors:', errs.slice(0,3));
await b.close(); process.exit(bad||errs.length?1:0);
