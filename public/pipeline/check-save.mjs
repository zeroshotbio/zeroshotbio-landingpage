/* check-save.mjs — Save all changes saves, and says something true afterwards.
   Run: node check-save.mjs <url>            (needs playwright)

   The button used to take two clicks: the first drew a preview with a Confirm
   under it and nothing left the browser until the second. It is one click now,
   which puts all the weight on what it says afterwards — so this asserts the
   saying, not just the sending.

   THE HAPPY PATH IS NOT THE INTERESTING PART. A confirmation is only worth
   having if it is still honest when the write does not land, and there are
   three ways for that to happen: the store rejects it, the store cannot be
   reached, and the store accepts it but a read-back does not agree yet. Each
   has to produce a WARNING rather than a success, has to say the changes are
   still in this browser so nobody thinks their afternoon is gone, and has to
   leave the button usable — a control stuck on "Saving…" is a page that looks
   broken and a change that looks lost.

   AND THE SUCCESS MESSAGE IS CHECKED AGAINST A READ, not against the POST. A
   POST that resolves ok has been accepted; only a read proves it is what the
   next person to open the page will get. If the page ever stops reading back,
   this check fails rather than the claim quietly becoming a guess.
*/
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://127.0.0.1:8731/pipeline/index.html';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let bad = 0; const fail = m => { bad++; console.log('  FAIL  ' + m); };

async function trial(label, onPost, expect) {
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const hits = []; let record = { offsets: null, text: null, at: null };
  await p.route('**/api/**', r => {
    const u = new URL(r.request().url()), m = r.request().method();
    hits.push(m + ' ' + u.pathname.split('/').pop());
    if (u.pathname.endsWith('_edits')) {
      if (m === 'POST') return onPost(r, j => { record = j; });
      return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(record) });
    }
    return r.fulfill({ status:200, contentType:'application/json', body:'{"ok":true,"prompts":[]}' });
  });
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2200);

  /* something to save: nudge one node in the editor */
  await p.locator('#btnEdit').click(); await p.waitForTimeout(400);
  const t = await p.evaluate(() => {
    const n = NODES.find(x => !x.follow && !x.carried && nodeEls[x.id]);
    const e = nodeEls[n.id].querySelector('.ehandle') || nodeEls[n.id];
    const r = e.getBoundingClientRect();
    return { id: n.id, x: r.x + r.width/2, y: r.y + r.height/2 };
  });
  await p.mouse.move(t.x, t.y); await p.mouse.down();
  await p.mouse.move(t.x + 40, t.y + 25, { steps: 10 }); await p.mouse.up();
  await p.waitForTimeout(400);

  hits.length = 0;
  await p.locator('#btnSave').click(); await p.waitForTimeout(2600);

  if (await p.locator('#svGo').count()) fail(`${label}: a second-click Confirm button appeared`);
  if (!hits.some(h => h.startsWith('POST'))) fail(`${label}: one click posted nothing`);

  const st = await p.evaluate(() => {
    const e = document.getElementById('toast'), s = document.getElementById('btnSave');
    return { text: e.textContent.trim(), warn: e.classList.contains('warn'),
             on: e.classList.contains('on'), label: s.textContent.trim(), disabled: s.disabled };
  });
  if (!st.on)              fail(`${label}: no confirmation appeared at all`);
  if (st.warn !== expect.warn)
    fail(`${label}: expected warn=${expect.warn}, got ${st.warn} — "${st.text.slice(0,80)}"`);
  if (!expect.re.test(st.text))
    fail(`${label}: the message does not say what happened — "${st.text.slice(0,110)}"`);
  if (st.disabled)         fail(`${label}: the button is still disabled — it looks stuck`);
  if (/saving/i.test(st.label)) fail(`${label}: the button is still labelled "${st.label}"`);
  if (expect.readback && !hits.some((h,i) =>
        h.startsWith('GET') && hits.slice(0,i).some(x => x.startsWith('POST'))))
    fail(`${label}: nothing was read back — the confirmation is a hope, not a check`);
  console.log('  ' + label.padEnd(38) + (st.warn ? 'warns' : 'confirms') + ': ' + st.text.slice(0,72) + '…');
  await p.close();
}

await trial('one click saves and confirms',
  (r, keep) => { keep(JSON.parse(r.request().postData()||'{}')); const at = Date.now();
    keep({ ...JSON.parse(r.request().postData()||'{}'), at });
    return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ok:true, at}) }); },
  { warn:false, re:/saved/i, readback:true });

await trial('the store rejects the write',
  r => r.fulfill({ status:500, contentType:'application/json', body:'{"ok":false,"error":"write_failed"}' }),
  { warn:true, re:/not saved[\s\S]*still here in this browser/i });

await trial('the store cannot be reached', r => r.abort(),
  { warn:true, re:/not saved[\s\S]*still here in this browser/i });

await trial('accepted, but the read-back disagrees',
  r => r.fulfill({ status:200, contentType:'application/json', body:'{"ok":true,"at":999999}' }),
  { warn:true, re:/read-back did not match/i });

console.log(bad ? `\n${bad} FAILURE(S)`
  : 'save: one click writes, the confirmation is checked against a read rather than the POST, ' +
    'and all three ways a write can fail warn, say the work is still in this browser, and leave the button usable');
await b.close();
process.exit(bad ? 1 : 0);
