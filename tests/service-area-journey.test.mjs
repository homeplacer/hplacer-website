import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const page = read("src/app/locations/page.tsx");

test("service-area hub qualifies HOA and parcel placement claims", () => {
  assert.doesNotMatch(page, /never with an HOA|never boxed into a subdivision/i);
  assert.match(page, /prioritize scattered\s+lots without an HOA/);
  assert.match(page, /association obligations, deed restrictions/);
  assert.match(page, /checked for the specific parcel/);
});

test("service-area hub distinguishes planning areas from active inventory", () => {
  assert.match(page, /not a promise of available homes or approved\s+lots in every town/);
  assert.match(page, /href="\/land-packages"/);
  assert.match(page, /href="\/guides\/land-readiness-checklist"/);
  assert.match(page, /href="\/buyer-resources#counties"/);
  assert.match(page, /Explore \{l.name\}/);
});

test("service-area index keeps all towns without bypassing the evidence gate", () => {
  assert.match(page, /cities: locations\.filter\(\(l\) => l\.countyKey === county\.key\)/);
  assert.match(page, /href=\{`\/locations\/\$\{l.slug\}`\}/);
  assert.match(read("src/app/locations/[slug]/page.tsx"), /index: Boolean\(locationEvidence\(loc.slug\)\), follow: true/);
  assert.match(read("src/app/sitemap.ts"), /filter\(\(l\) => Boolean\(locationEvidence\(l.slug\)\)\)/);
  assert.equal(Object.keys(JSON.parse(read("data/location-evidence.json"))).length, 5);
});
