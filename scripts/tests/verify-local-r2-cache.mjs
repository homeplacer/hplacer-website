// Read-back verification after `opennextjs-cloudflare populateCache local`.
// This never opens remote bindings or prints cached response bodies.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { verifyBuildCache } from '../verify-build-cache.mjs';

const result = verifyBuildCache(process.cwd());
assert.ok(result.ok, result.issues.join('\n'));
const proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', remoteBindings: false });
const root = resolve('.open-next/cache');
let verified = 0;
async function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { await walk(path); continue; }
    const parts = relative(root, path).split('/');
    const fetchRecord = parts[0] === '__fetch';
    if (fetchRecord) parts.shift();
    const buildId = parts.shift();
    const key = '/' + parts.join('/').replace(/\.cache$/, '');
    const hash = createHash('sha256').update(key).digest('hex');
    const object = await proxy.env.NEXT_INC_CACHE_R2_BUCKET.get(`incremental-cache/${buildId}/${hash}.${fetchRecord ? 'fetch' : 'cache'}`);
    assert.ok(object, `Missing local R2 cache record: ${relative(root, path)}`);
    assert.deepEqual(await object.json(), JSON.parse(readFileSync(path, 'utf8')), `Local R2 record differs: ${relative(root, path)}`);
    verified++;
  }
}
try {
  await walk(root);
  console.log(`Verified ${verified} local R2 records against validated build source.`);
} finally { await proxy.dispose(); }
