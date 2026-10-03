import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dialog = readFileSync('src/components/down-payment-assistance-dialog.tsx', 'utf8');

test('assistance popup uses modal browser containment and distinct IDs for repeated homepage triggers', () => {
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /dialog\.showModal\(\)/);
  assert.match(dialog, /const titleId = useId\(\)/);
  assert.match(dialog, /aria-labelledby=\{titleId\}/);
  assert.doesNotMatch(dialog, /id="assistance-dialog-title"/);
  assert.match(dialog, /document\.body\.style\.overflow = "hidden"/);
  assert.match(dialog, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(dialog, /trigger\?\.focus\(\)/);
  assert.match(dialog, /onCancel=/);
  assert.match(dialog, /first\.focus\(\)/);
  assert.match(dialog, /last\.focus\(\)/);
});

test('accessibility fix keeps prominent assistance range, restrictions, required email, and page fallback', () => {
  assert.ok(dialog.includes('$5,000–$50,000'));
  assert.match(dialog, /text-4xl.*sm:text-5xl/);
  assert.match(dialog, /Restrictions apply; availability, program funding, property, location, and buyer/);
  assert.match(dialog, /<FinancingForm\s+compact\s+requireEmail/);
  assert.match(dialog, /href="\/down-payment-assistance#learn-more"/);
  assert.match(dialog, /size-11 shrink-0/);
});
