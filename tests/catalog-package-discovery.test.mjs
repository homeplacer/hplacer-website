import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the floor-plan catalog distinguishes models from available home-and-land properties", () => {
  const page = readFileSync("src/app/homes/page.tsx", "utf8");
  const intro = page.slice(page.indexOf("Find your home"), page.indexOf("<HomesBrowser"));
  assert.match(page, /import Link from "next\/link"/);
  assert.match(intro, /This is our floor-plan catalog\. For specific available homes and\s+land/);
  assert.match(intro, /<Link href="\/land-packages"[^>]*>\s*browse current land-home packages\s*<\/Link>/);
  assert.match(intro, /quarter-acre lot/);
  assert.match(intro, /Call, text, or email us for a written/);
  assert.match(page, /canonical: "\/homes"/);
  assert.match(page, /<JsonLd data=\{homesItemListLd\(all\)\} \/>/);
});

test("the current-package section sends model shoppers to active packages rather than sold history", () => {
  const page = readFileSync("src/app/homes/[slug]/page.tsx", "utf8");
  const start = page.indexOf("{/* Current packages");
  const end = page.indexOf("{/* Floor plan", start);
  assert.ok(start >= 0 && end > start);
  const section = page.slice(start, end);
  assert.match(section, /Current land-home packages/);
  assert.match(section, /See what&apos;s available to tour/);
  assert.match(section, /href="\/land-packages"[\s\S]*?Browse current packages/);
  assert.doesNotMatch(section, /href="\/recently-placed"|See our recent homes/);
  assert.match(section, /href=\{`tel:\$\{site\.phoneDial\}`\}/);
  assert.ok(section.indexOf("site.phoneDial") < section.indexOf('href="/land-packages"'));
  assert.match(section, /confirm the listing&apos;s status/);
  assert.match(page, /href=\{`\/recently-placed\/\$\{h\.slug\}`\}/);
  assert.match(page, /<HomeInquiryDialog[\s\S]*?homeName=\{home\.name\}/);
});
