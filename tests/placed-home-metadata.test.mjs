import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const homes = JSON.parse(readFileSync("data/placed-homes.json", "utf8"));
const source = readFileSync("src/lib/placed-home-metadata.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const { placedHomeMetadata } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("all 73 sold archive titles are distinct and concise with the business suffix", () => {
  assert.equal(homes.length, 73);
  const titles = homes.map((home) => placedHomeMetadata(home).title);
  assert.equal(new Set(titles).size, homes.length);
  for (const [index, title] of titles.entries()) {
    const home = homes[index];
    assert.equal(title, `${home.address}, ${home.town}, SC · Sold`);
    assert.ok(`${title} · Home Placer`.length <= 60, home.slug);
    const previous = `${home.address}, ${home.town}, SC — ${home.beds} bd / ${home.baths} ba manufactured home`;
    assert.ok(title.length < previous.length, home.slug);
  }
});

test("sold metadata keeps canonical routes and never alters historical records", () => {
  const originals = structuredClone(homes);
  for (const home of homes) {
    const metadata = placedHomeMetadata(home);
    assert.equal(metadata.alternates.canonical, `/recently-placed/${home.slug}`);
    assert.match(metadata.title, / · Sold$/);
  }
  assert.deepEqual(homes, originals);
  const page = readFileSync("src/app/recently-placed/[slug]/page.tsx", "utf8");
  assert.match(page, /\.\.\.placedHomeMetadata\(h\)/);
  assert.match(page, /placed and sold/);
});
