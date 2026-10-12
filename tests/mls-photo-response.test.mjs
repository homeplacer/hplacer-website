import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

function load(path, modules = {}) {
  const compiled = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: compiled, exports: compiled.exports, Request, Response, Headers, URL,
    ReadableStream, Uint8Array, AbortSignal, setTimeout, clearTimeout,
    require: name => { assert.ok(modules[name], `Unexpected import ${name}`); return modules[name]; },
  });
  return compiled.exports;
}
const helper = load('src/lib/mls-photo.ts');
const { mlsPhotoResponse } = load('src/lib/mls-photo-response.ts', { './mls-photo': helper });
const key = '1234567890';
const listing = { listingKey: key, photoUrl: `https://forturro.com/api/img/${key}/1` };
const request = (width = '480', suffix = '', method = 'GET') => new Request(`https://hplacer.com/api/mls-photo/${key}/${width}${suffix}`, { method });
const noStore = response => assert.equal(response.headers.get('Cache-Control'), 'no-store');
const source = await sharp({ create: { width: 1412, height: 941, channels: 3, background: '#738490' } }).jpeg().toBuffer();

function environment(overrides = {}) {
  const calls = { fetch: [], info: 0, transforms: [], puts: [], matches: [] };
  let cached;
  const images = {
    async info(body) {
      calls.info++;
      const metadata = await sharp(Buffer.from(await new Response(body).arrayBuffer())).metadata();
      return { width: metadata.width, height: metadata.height, format: `image/${metadata.format === 'jpg' ? 'jpeg' : metadata.format}` };
    },
    input(body) {
      return { transform(options) {
        calls.transforms.push({ ...options });
        return { async output(output) {
          assert.equal(output.format, 'image/webp');
          assert.equal(output.quality, 75);
          const bytes = await sharp(Buffer.from(await new Response(body).arrayBuffer())).resize({ width: options.width, withoutEnlargement: true }).webp({ quality: output.quality }).toBuffer();
          return { response: () => new Response(bytes, { headers: { 'Content-Type': 'image/webp' } }) };
        } };
      } };
    },
  };
  return { calls, dependencies: {
    getListings: async () => [listing], images,
    fetch: async (url, options) => { calls.fetch.push({ url, options }); return new Response(source, { headers: { 'Content-Type': 'image/jpeg' } }); },
    cache: {
      async match(cacheKey) { calls.matches.push(cacheKey.url); return cached?.clone(); },
      async put(cacheKey, response) { calls.puts.push(cacheKey.url); cached = response.clone(); },
    }, ...overrides,
  } };
}

test('only exact current first-photo URLs and fixed width descriptors are advertised', () => {
  assert.equal(helper.mlsPhotoSource(key, `/api/img/${key}/1`), listing.photoUrl);
  for (const photo of ['/api/img/other/1', `/api/img/${key}/1?width=320`, `//forturro.com/api/img/${key}/1`, {}, null]) assert.equal(helper.mlsPhotoSource(key, photo), undefined);
  for (const invalid of ['0', '01', '-1', 'a', '1/2', '1'.repeat(21)]) assert.equal(helper.mlsPhotoSource(invalid, `/api/img/${invalid}/1`), undefined);
  assert.equal(helper.mlsPhotoSrcSet(key, listing.photoUrl).split(', ').length, 5);
  assert.equal(helper.mlsPhotoSrcSet(key, 'https://other.test/image'), undefined);
});

test('transcodes without crop/upscale, verifies actual width, and reuses a short-lived canonical cache', async () => {
  const { calls, dependencies } = environment();
  const first = await mlsPhotoResponse(request(), key, '480', dependencies);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('Content-Type'), 'image/webp');
  assert.equal(first.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(first.headers.get('X-Content-Type-Options'), 'nosniff');
  const metadata = await sharp(Buffer.from(await first.arrayBuffer())).metadata();
  assert.equal(metadata.width, 480);
  assert.equal(metadata.height, 320);
  assert.equal(calls.transforms.length, 1);
  assert.deepEqual(calls.transforms[0], { width: 480, fit: 'scale-down' });
  assert.equal(calls.info, 2, 'source and output descriptors are inspected');
  assert.equal(calls.fetch[0].url, listing.photoUrl);
  assert.equal(calls.fetch[0].options.redirect, 'manual');
  assert.equal(calls.fetch[0].options.cache, 'no-store');
  assert.ok(calls.fetch[0].options.signal instanceof AbortSignal);
  assert.deepEqual(calls.puts, [`https://hplacer.com/__mls-photo-cache/v1/${key}/480`]);
  const hit = await mlsPhotoResponse(request(), key, '480', dependencies);
  assert.equal(hit.status, 200);
  assert.match(hit.headers.get('Age'), /^[0-9]+$/);
  assert.equal(calls.fetch.length, 1);
});

test('membership and exact photo are checked before cache hits, including authoritative empty', async () => {
  let rows = [listing];
  const { calls, dependencies } = environment({ getListings: async () => rows });
  assert.equal((await mlsPhotoResponse(request(), key, '480', dependencies)).status, 200);
  for (const next of [[], [{ ...listing, photoUrl: 'https://other.test/private' }], [{ ...listing, photoUrl: `https://forturro.com/api/img/999/1` }]]) {
    rows = next;
    const response = await mlsPhotoResponse(request(), key, '480', dependencies);
    assert.equal(response.status, 404); noStore(response);
  }
  assert.equal(calls.matches.length, 1);
  assert.equal(calls.fetch.length, 1);
});

test('missing binding and feed failure return no-store without fetching or caching an image', async () => {
  for (const override of [{ images: undefined }, { getListings: async () => { throw new Error('outage'); } }]) {
    const { calls, dependencies } = environment(override);
    const response = await mlsPhotoResponse(request(), key, '480', dependencies);
    assert.equal(response.status, 503); noStore(response);
    assert.equal(calls.fetch.length, 0); assert.equal(calls.matches.length, 0);
  }
});

test('noncanonical widths/paths/query parameters and non-GET never touch feed, fetch or Images', async () => {
  const { calls, dependencies } = environment({ getListings: async () => { assert.fail('Must validate before feed lookup'); } });
  for (const [width, suffix, method] of [['481', '', 'GET'], ['0480', '', 'GET'], ['480', '?src=https://evil.test', 'GET'], ['480', '?', 'POST'], ['480', '', 'HEAD'], ['480/', '', 'GET']]) {
    const response = await mlsPhotoResponse(request(width, suffix, method), key, width, dependencies);
    assert.ok([400, 405].includes(response.status)); noStore(response);
  }
  assert.equal(calls.fetch.length, 0); assert.equal(calls.transforms.length, 0);
});

for (const [name, upstream] of [
  ['redirect', () => new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } })],
  ['upstream error', () => new Response('unavailable', { status: 503 })],
  ['HTML', () => new Response('<html>', { headers: { 'Content-Type': 'text/html' } })],
  ['SVG', () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })],
  ['oversized declaration', () => new Response(source, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(7 * 1024 * 1024) } })],
  ['oversized streamed body', () => new Response(new Uint8Array(7 * 1024 * 1024), { headers: { 'Content-Type': 'image/jpeg' } })],
  ['invalid raster bytes', () => new Response('not an image', { headers: { 'Content-Type': 'image/jpeg' } })],
]) {
  test(`${name} fails closed with no original JPEG pretending to be a derivative`, async () => {
    const { calls, dependencies } = environment({ fetch: async () => upstream() });
    const response = await mlsPhotoResponse(request(), key, '480', dependencies);
    assert.ok(response.status >= 400); noStore(response);
    assert.equal(calls.puts.length, 0); assert.equal(calls.transforms.length, 0);
    assert.notEqual(response.headers.get('Content-Type'), 'image/webp');
  });
}

test('small sources do not produce false width descriptors or upscale', async () => {
  const small = await sharp(source).resize({ width: 320 }).jpeg().toBuffer();
  const { calls, dependencies } = environment({ fetch: async () => new Response(small, { headers: { 'Content-Type': 'image/jpeg' } }) });
  const response = await mlsPhotoResponse(request(), key, '480', dependencies);
  assert.equal(response.status, 422); noStore(response);
  assert.equal(calls.transforms.length, 0);
});

test('invalid decoded metadata, entitlement/transform failures and wrong output width are no-store', async () => {
  for (const info of [{ width: 10001, height: 941, format: 'image/jpeg' }, { width: 8000, height: 8000, format: 'image/jpeg' }, { width: 1412, height: 941, format: 'image/svg+xml' }]) {
    const { dependencies } = environment();
    dependencies.images.info = async () => info;
    const response = await mlsPhotoResponse(request(), key, '480', dependencies);
    assert.equal(response.status, 502); noStore(response);
  }
  for (const corrupt of [false, true]) {
    const { dependencies } = environment();
    if (corrupt) dependencies.images.input = () => ({ transform: () => ({ output: async () => ({ response: () => new Response(source, { headers: { 'Content-Type': 'image/webp' } }) }) }) });
    else dependencies.images.input = () => { throw new Error('quota/entitlement error'); };
    const response = await mlsPhotoResponse(request(), key, '480', dependencies);
    assert.ok(response.status >= 400); noStore(response);
  }
  const wrongWidth = await sharp(source).resize({ width: 320 }).webp().toBuffer();
  for (const bytes of [wrongWidth, new Uint8Array(4 * 1024 * 1024)]) {
    const { dependencies } = environment();
    dependencies.images.input = () => ({ transform: () => ({ output: async () => ({ response: () => new Response(bytes, { headers: { 'Content-Type': 'image/webp' } }) }) }) });
    const response = await mlsPhotoResponse(request(), key, '480', dependencies);
    assert.ok(response.status >= 400); noStore(response);
  }
});

test('a stalled body is cancelled at the bounded stream deadline and never cached', async () => {
  let cancelled = false;
  const { calls, dependencies } = environment({ fetch: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1])); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'image/jpeg' } }) });
  const response = await mlsPhotoResponse(request(), key, '480', dependencies);
  assert.equal(response.status, 503); noStore(response);
  assert.equal(cancelled, true);
  assert.equal(calls.transforms.length, 0); assert.equal(calls.puts.length, 0);
});

test('an unresponsive Images operation times out without producing cacheable media', async () => {
  const { calls, dependencies } = environment();
  dependencies.images.info = () => new Promise(() => {});
  const response = await mlsPhotoResponse(request(), key, '480', dependencies);
  assert.equal(response.status, 503); noStore(response);
  assert.equal(calls.puts.length, 0);
});

test('cache read/write failures are nonblocking, and expired media is refetched', async () => {
  const { dependencies } = environment({ cache: { match: async () => { throw new Error('cache'); }, put: async () => { throw new Error('cache'); } } });
  assert.equal((await mlsPhotoResponse(request(), key, '480', dependencies)).status, 200);
  const expired = new Response(source, { headers: { Date: new Date(Date.now() - 301_000).toUTCString() } });
  const next = environment({ cache: { match: async () => expired, put: async () => {} } });
  assert.equal((await mlsPhotoResponse(request(), key, '480', next.dependencies)).status, 200);
  assert.equal(next.calls.fetch.length, 1);
});

test('route stays dynamic, explicitly blocks HEAD, and only declares the MLS-specific binding', () => {
  const route = readFileSync('src/app/api/mls-photo/[listingKey]/[width]/route.ts', 'utf8');
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.images.binding, 'MLS_IMAGES');
  assert.equal(config.cache?.enabled, undefined);
  assert.match(route, /dynamic = "force-dynamic"/);
  assert.match(route, /export function HEAD\(\)/);
  assert.doesNotMatch(route, /env\.IMAGES|remote:\s*true/);
});
