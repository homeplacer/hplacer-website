// Local Workerd integration check. Build, then run Wrangler's dry run with
// --outdir .open-next/refresh-test-worker before running this script.
// All outbound requests are intercepted; no production data is changed.
// Default: real TTLs (~16 minutes). MLS_TEST_AGE=1: fast simulated expiry only.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { unstable_getMiniflareWorkerOptions } from 'wrangler';

const { workerOptions } = unstable_getMiniflareWorkerOptions('wrangler.jsonc');
delete workerOptions.modulesRules;
const workerPath = resolve(process.env.MLS_TEST_WORKER ?? '.open-next/refresh-test-worker/worker.js');
const modules = readdirSync(dirname(workerPath)).filter(n => /\.(js|bin|wasm)$/.test(n)).map(n => ({
  type: n.endsWith('.js') ? 'ESModule' : n.endsWith('.wasm') ? 'CompiledWasm' : 'Data',
  path: resolve(dirname(workerPath), n),
  contents: n.endsWith('.js') ? readFileSync(resolve(dirname(workerPath), n), 'utf8') : readFileSync(resolve(dirname(workerPath), n)),
}));
modules.sort((a,b) => a.path === workerPath ? -1 : b.path === workerPath ? 1 : 0);
let ageMs = 0;
let price = 321123, active = true, outage = false;
const activeItem = () => ({ listingKey: 'fixture-refresh', address: '999 Fixture Refresh Road', city: 'Conway', listPrice: price, beds: 3, baths: 2, sqft: 1400 });
let closings = [{ listingKey: 'fixture-closed', mlsId: 'fixture-closed', address: '998 Fixture Closed Road', city: 'Conway', closePrice: 300000, beds: 3, baths: 2, sqft: 1400, lat: null, lng: null, closedOn: '2026-10-01' }];
const calls = { active: 0, closed: 0 };
if (process.env.MLS_TEST_AGE) modules.unshift({
  type: 'ESModule', path: resolve(dirname(workerPath), 'test-entry.js'), contents: `
    import app from './worker.js';
    export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './worker.js';
    export default { async fetch(request, env, ctx) {
      const age = Number(await (await env.TEST_AGE.fetch('http://age')).text());
      const bucket = env.NEXT_INC_CACHE_R2_BUCKET;
      const wrapped = new Proxy(bucket, { get(target, key) {
        if (key === 'get') return async (...args) => {
          const object = await target.get(...args);
          if (!object) return object;
          return new Proxy(object, { get(o, k) {
            if (k === 'uploaded') return new Date(o.uploaded.getTime() - age);
            const value = Reflect.get(o, k); return typeof value === 'function' ? value.bind(o) : value;
          }});
        };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
      return app.fetch(request, { ...env, NEXT_INC_CACHE_R2_BUCKET: wrapped }, ctx);
    }};
  `,
});
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{
  ...workerOptions, bindings: { ...workerOptions.bindings, ...(process.env.MLS_TEST_AGE ? { NEXT_CACHE_DO_QUEUE_DISABLE_SQLITE: 'true' } : {}) }, serviceBindings: { ...workerOptions.serviceBindings, TEST_AGE: () => new Response(String(ageMs)) }, name: 'hplacer-app', modules, modulesRoot: dirname(workerPath),
  outboundService: async request => {
    const url = new URL(request.url);
    const kind = url.pathname === '/api/hplacer/active' ? 'active' : url.pathname === '/api/hplacer/closed' ? 'closed' : null;
    assert.equal(url.hostname, 'forturro.com', `Unexpected outbound host ${url.hostname}`);
    assert.ok(kind, `Unexpected outbound path ${url.pathname}`);
    calls[kind]++;
    if (outage) return process.env.MLS_TEST_MALFORMED_OUTAGE ? Response.json({ items: null }) : new Response('Fixture outage', { status: 503 });
    return Response.json({ items: kind === 'active' ? active ? [activeItem()] : [] : closings });
  },
}] }));
const wait = ms => new Promise(r => setTimeout(r, ms));
const get = async (path, headers = {}) => {
  const response = await mf.dispatchFetch(`http://localhost${path}`, { headers });
  const body = await response.text();
  if (process.env.MLS_TEST_DEBUG) console.log("GET", path, response.status, response.headers.get("x-open-next-cache") ?? response.headers.get("x-nextjs-cache"), calls);
  assert.equal(response.status, 200, `${path}: ${response.status}`);
  return body;
};
const until = async (path, predicate, timeout = 25000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const body = await get(path);
    if (predicate(body)) return body;
    await wait(1000);
  }
  console.log("Failed refresh counts", calls);
  const b = await mf.getR2Bucket('NEXT_INC_CACHE_R2_BUCKET', 'hplacer-app');
  for (const o of (await b.list()).objects) {
    const d = await (await b.get(o.key)).json();
    console.log('failure cache', o.key, o.uploaded, d.revalidate, d.type, d.kind, (d.html ?? d.data?.body ?? '').includes('432234'), (d.html ?? d.data?.body ?? '').includes('432,234'));
  }
  throw new Error(`Refresh did not settle for ${path}`);
};
async function verify() {
try {
  await mf.ready;
  const started = Date.now();
  const detail = '/land-packages/999-fixture-refresh-road-conway';
  for (const path of ['/', '/land-packages', detail, '/sitemap.xml']) {
    assert.match(await get(path), /999.fixture.refresh.road/i);
  }
  const archiveHtml = await get('/recently-placed');
  assert.match(archiveHtml, /998 Fixture Closed Road/);
  for (const home of JSON.parse(readFileSync('data/placed-homes.json', 'utf8'))) {
    assert.ok(archiveHtml.includes(`/recently-placed/${home.slug}`), `Missing permanent archive ${home.slug}`);
  }
  console.log(process.env.MLS_TEST_AGE ? 'Initial fixture pages rendered; simulated expiry mode.' : 'Initial fixture pages rendered; real 300/900-second clocks started.', calls);
  price = 432234;
  closings = [...closings, { ...closings[0], listingKey: 'fixture-closed-2', mlsId: 'fixture-closed-2', address: '997 Fixture Added Road' }];
  if (process.env.MLS_TEST_AGE) ageMs = 310000;
  else await wait(Math.max(0, started + 305000 - Date.now()));
  for (const path of ['/', '/land-packages', detail]) await until(path, html => /432,234|432234/.test(html));
  for (const path of ['/', '/land-packages', detail]) {
    const response = await mf.dispatchFetch(`http://localhost${path}?_rsc=fixture`, { headers: { RSC: '1' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/x-component/);
    assert.match(await response.text(), /432,234|432234/);
  }
  console.log('Price updated across active HTML and RSC routes without a rebuild.', calls);
  if (process.env.MLS_TEST_ACTIVE_ONLY === '1') return;
  outage = true;
  if (process.env.MLS_TEST_AGE) ageMs = 620000;
  else await wait(305000);
  await Promise.all(Array.from({length: 5}, () => get('/land-packages')));
  await wait(5000);
  assert.match(await get('/land-packages'), /432,234|432234/);
  assert.match(await get('/sitemap.xml'), /999.fixture.refresh.road/i);
  console.log('Concurrent requests during upstream failure retain last good page.', calls);
  outage = false; active = false;
  // Existing fetch cache can have its own TTL; allow one more full interval.
  if (process.env.MLS_TEST_AGE) ageMs = 930000;
  else await wait(Math.max(0, started + 920000 - Date.now()));
  for (const path of ['/', '/land-packages', '/sitemap.xml']) await until(path, html => !/999.fixture.refresh.road/i.test(html));
  const finalArchive = await until('/recently-placed', html => html.includes('997 Fixture Added Road') && html.includes('998 Fixture Closed Road'));
  for (const home of JSON.parse(readFileSync('data/placed-homes.json', 'utf8'))) {
    assert.ok(finalArchive.includes(`/recently-placed/${home.slug}`), `Lost permanent archive ${home.slug}`);
  }
  const rsc = await get('/land-packages?_rsc=fixture', { RSC: '1' });
  assert.doesNotMatch(rsc, /999.fixture.refresh.road/i);
  const lead = await mf.dispatchFetch('http://localhost/api/lead');
  assert.equal(lead.status, 405);
  await lead.text();
  const result = await mf.dispatchFetch(`http://localhost${detail}`);
  await result.text();
  await wait(3000);
  const removed = await mf.dispatchFetch(`http://localhost${detail}`);
  assert.equal(removed.status, 404);
  await removed.text();
  console.log('Removal, sitemap, detail 404, outage recovery and closing refresh verified.', calls);
} finally { await mf.dispose(); }

}
await verify();
