import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/app/land-packages/[slug]/page.tsx', 'utf8');

test('active package guidance uses the live property and keeps its price separate from model estimates', () => {
  assert.match(page, /getLivePackageListings\(\)/);
  assert.match(page, /listings\.find\(\(candidate\) => packageSlug\(candidate\) === slug\)/);
  assert.match(page, /Plan your visit to \{listing\.address\}/);
  assert.match(page, /The \{price\} shown here is this property’s current MLS list price/);
  assert.doesNotMatch(page, /quarter-acre|60,000|184,999|209,999/);
});

test('package details lead with the listing and offer a contextual in-page inquiry before guidance', () => {
  assert.ok(page.indexOf('Active MLS package') < page.indexOf('Five questions worth asking'));
  assert.match(page, /homeName=\{`\$\{listing\.address\}, \$\{listing\.city\}`\} label="Request details or a visit"/);
  for (const path of ['/buyer-resources', '/down-payment-assistance', '/warranty']) {
    assert.ok(page.includes(`href="${path}"`));
  }
  assert.match(page, /not a loan application or approval/);
});
