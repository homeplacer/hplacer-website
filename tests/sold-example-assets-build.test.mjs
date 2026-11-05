import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { buildSoldExampleAssets } from "../scripts/build-sold-example-assets.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "hplacer-sold-examples-"));
  await mkdir(path.join(root, "data"));
  await mkdir(path.join(root, "src/lib"), { recursive: true });
  await mkdir(path.join(root, "public/recently-placed/conway"), { recursive: true });
  await writeFile(path.join(root, "data/placed-homes.json"), JSON.stringify([
    { photo: "/recently-placed/conway/2610417.jpg", price: 200000, closeDate: "2026-01-01" },
  ]));
  await copyFile("public/recently-placed/conway/2610417.jpg", path.join(root, "public/recently-placed/conway/2610417.jpg"));
  return root;
}

test("incremental/rebuild runs preserve originals and unchanged bytes/timestamps; repair malformed variants", async () => {
  const root = await fixture();
  try {
    const source = path.join(root, "public/recently-placed/conway/2610417.jpg");
    const original = await readFile(source);
    assert.deepEqual(await buildSoldExampleAssets(root), { written: 5, retained: 0, sources: 1, manifestUpdated: true });
    const candidate = source.replace(/\.jpg$/, "-sold-480.webp");
    await utimes(candidate, new Date(0), new Date(0));
    const timestamp = (await stat(candidate)).mtimeMs;
    assert.deepEqual(await buildSoldExampleAssets(root), { written: 0, retained: 5, sources: 1, manifestUpdated: false });
    assert.deepEqual(await buildSoldExampleAssets(root, { rebuild: true }), { written: 0, retained: 5, sources: 1, manifestUpdated: false });
    assert.equal((await stat(candidate)).mtimeMs, timestamp);
    assert.deepEqual(await readFile(source), original);
    await writeFile(candidate, await sharp(original).resize({ width: 320 }).webp().toBuffer());
    await assert.rejects(buildSoldExampleAssets(root), /Invalid existing sold-example variant/);
    assert.equal((await buildSoldExampleAssets(root, { rebuild: true })).written, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("source changes require deliberate rebuild and narrow photos get truthful nonempty candidates", async () => {
  const root = await fixture();
  try {
    await buildSoldExampleAssets(root);
    const source = path.join(root, "public/recently-placed/conway/2610417.jpg");
    const narrow = await sharp(await readFile(source)).resize({ width: 150 }).jpeg().toBuffer();
    await writeFile(source, narrow);
    await assert.rejects(buildSoldExampleAssets(root), /Changed sold-example source/);
    assert.deepEqual(await buildSoldExampleAssets(root, { rebuild: true }), { written: 1, retained: 0, sources: 1, manifestUpdated: true });
    const assets = JSON.parse(await readFile(path.join(root, "src/lib/sold-example-assets.json"), "utf8"));
    assert.deepEqual(assets["/recently-placed/conway/2610417.jpg"].widths, [150]);
    assert.equal((await sharp(source.replace(/\.jpg$/, "-sold-150.webp")).metadata()).width, 150);
    assert.deepEqual(await readFile(source), narrow);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("remote/traversal/unknown sources are not fetched or advertised", async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, "data/placed-homes.json"), JSON.stringify([
      { photo: "https://example.test/photo.jpg", price: 200000, closeDate: "2026-01-01" },
      { photo: "/recently-placed/../../outside.jpg", price: 200000, closeDate: "2026-01-01" },
      { photo: "/unknown.jpg", price: 200000, closeDate: "2026-01-01" },
    ]));
    assert.deepEqual(await buildSoldExampleAssets(root), { written: 0, retained: 0, sources: 0, manifestUpdated: true });
    assert.deepEqual(JSON.parse(await readFile(path.join(root, "src/lib/sold-example-assets.json"), "utf8")), {});
  } finally { await rm(root, { recursive: true, force: true }); }
});
