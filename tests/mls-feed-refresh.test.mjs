import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function feed(path, fetch) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const compiled = { exports: {} };
  runInNewContext(outputText, { module: compiled, exports: compiled.exports, fetch, AbortSignal, require: (name) => {
    assert.equal(name, "next/cache");
    return { unstable_cache: (fn, keys, options) => {
      assert.equal(options.revalidate, path === activePath ? 300 : 900);
      return fn;
    } };
  } });
  return compiled.exports;
}
const activePath = 'src/lib/forturro-package-feed.ts';
const closedPath = 'src/lib/forturro-closed-feed.ts';
const active = { listingKey: 'fixture', address: '1 Example Road', city: 'Conway', listPrice: 250000, beds: 3, baths: 2 };
const closed = { ...active, mlsId: 'fixture', closePrice: 240000, closedOn: '2026-10-01' };

test('an authoritative empty active snapshot cannot resurrect registry listings', async () => {
  let calls = 0;
  const api = feed(activePath, async (url, options) => {
    calls++;
    assert.equal(url, 'https://forturro.com/api/hplacer/active');
    assert.equal(options.cache, "no-store");
    return Response.json({ items: [] });
  });
  assert.equal((await api.getLivePackageListings()).length, 0);
  assert.equal(await api.getLivePackageBySlug('1-example-road-conway'), null);
  assert.equal(calls, 2);
});

test('price updates and removals flow through the same detail lookup', async () => {
  let items = [active];
  const api = feed(activePath, async () => Response.json({ items }));
  assert.equal((await api.getLivePackageBySlug('1-example-road-conway')).listPrice, 250000);
  items = [{ ...active, listPrice: 260000 }];
  assert.equal((await api.getLivePackageBySlug('1-example-road-conway')).listPrice, 260000);
  items = [];
  assert.equal(await api.getLivePackageBySlug('1-example-road-conway'), null);
});

for (const [name, response] of [
  ['HTTP failure', () => new Response('unavailable', { status: 503 })],
  ['invalid JSON', () => new Response('<html>error</html>')],
  ['missing items', () => Response.json({})],
  ['nonarray items', () => Response.json({ items: {} })],
  ['null item', () => Response.json({ items: [null] })],
  ['missing address', () => Response.json({ items: [{ ...active, address: '' }] })],
]) {
  test(`${name} aborts regeneration rather than replacing last-good inventory with empty data`, async () => {
    const live = feed(activePath, async () => response());
    const sold = feed(closedPath, async () => response());
    await assert.rejects(live.getLivePackageListings());
    await assert.rejects(sold.getNewClosedHomePlacerSales([]));
  });
}

test('network failure is not interpreted as removed or sold inventory', async () => {
  const fetch = async () => { throw new Error('fixture network failure'); };
  await assert.rejects(feed(activePath, fetch).getLivePackageListings(), /network failure/);
  await assert.rejects(feed(closedPath, fetch).getNewClosedHomePlacerSales([]), /network failure/);
});

test('new closings remain additive to the permanent archive and deduplicate by MLS and address', async () => {
  const archive = [{ mls: 'existing', address: '2 Existing Road', town: 'Conway' }];
  const before = JSON.stringify(archive);
  const api = feed(closedPath, async (_url, options) => {
    assert.equal(options.cache, "no-store");
    return Response.json({ items: [
      closed, { ...closed },
      { ...closed, mlsId: 'alias', address: '1 Example Road.' },
      { ...closed, mlsId: 'existing', address: '3 Another Road' },
      { ...closed, mlsId: 'other', address: '2 Existing Road' },
    ] });
  });
  assert.equal((await api.getNewClosedHomePlacerSales(archive)).length, 1);
  assert.equal(JSON.stringify(archive), before);
});

test('invalid prices cannot be cached as public inventory', async () => {
  for (const listPrice of [0, -1, '250000', null]) {
    const api = feed(activePath, async () => Response.json({ items: [{ ...active, listPrice }] }));
    await assert.rejects(api.getLivePackageListings(), /invalid snapshot/);
  }
});

test('a valid empty closing feed adds nothing and leaves the archive untouched', async () => {
  const archive = [{ mls: 'existing', address: '2 Existing Road', town: 'Conway' }];
  const api = feed(closedPath, async () => Response.json({ items: [] }));
  assert.equal((await api.getNewClosedHomePlacerSales(archive)).length, 0);
  assert.equal(archive.length, 1);
  assert.equal(archive[0].mls, 'existing');
});
