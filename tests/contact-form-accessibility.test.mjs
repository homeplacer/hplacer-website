import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderFixture, renderFixtureGroup } from "./fixtures/contact-form-preview.mjs";

test("actual React server rendering has no native submission path before hydration", () => {
  const html = renderFixture();
  assert.doesNotMatch(html, /<form[\s>]/);
  assert.match(html, /<fieldset disabled=""/);
  assert.match(html, /<button type="submit" disabled=""/);
  assert.match(html, /<input[^>]*required=""[^>]*name="name"/);
  assert.match(html.match(/<input[^>]*name="phone"[^>]*>/)?.[0] ?? "", /required=""/);
  assert.doesNotMatch(html.match(/<input[^>]*name="email"[^>]*>/)?.[0] ?? "", /required=/);
  assert.match(html, /name="packageId" value="fixture-package"/);
  assert.match(html, /name="home" value="Fixture Home"/);
  assert.match(html, /Prefer another way to get in touch/);
  assert.match(html, /<div data-form-region="true"/);
  assert.ok(html.indexOf('</fieldset>') < html.indexOf('Prefer another way'), 'Fallback is below fields');
  assert.match(html, /href="tel:\+18438494663"/);
  assert.match(html, /href="sms:\+18438494663\?body=/);
  assert.match(html, /href="mailto:/);
});

test("status and alert regions exist empty before any update, with matching descriptions", () => {
  const html = renderFixture();
  assert.match(html, /<p role="status" aria-live="polite" aria-atomic="true" class="sr-only"><\/p>/);
  const errorId = html.match(/<p id="([^"]+)" tabindex="-1" role="alert" aria-atomic="true" class="sr-only"><\/p>/)?.[1];
  assert.ok(errorId);
  assert.match(html, new RegExp(`aria-describedby="[^"]+-phone-help ${errorId}"`));
  assert.equal(html.split(`aria-describedby="${errorId}"`).length - 1, 1);
  assert.doesNotMatch(html, /aria-invalid="true"/);
});

test("multiple form instances keep field and error IDs distinct", () => {
  const html = renderFixtureGroup();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 14);
  assert.equal(new Set(ids).size, ids.length);
  const errors = [...html.matchAll(/<p\b[^>]*role="alert"[^>]*>/g)]
    .map(match => match[0].match(/\bid="([^"]+)"/)[1]);
  assert.equal(errors.length, 2);
  for (const id of errors) {
    assert.equal(html.split(`aria-describedby="${id}"`).length - 1, 1);
    assert.match(html, new RegExp(`aria-describedby="[^"]+-phone-help ${id}"`));
  }
});

test("feedback distinguishes delivered leads from an unsent mail draft and preserves intake", () => {
  const source = readFileSync("src/components/contact-form.tsx", "utf8");
  assert.match(source, /Your message has not been sent yet/);
  assert.match(source, /Finish sending your inquiry/);
  assert.match(source, /submitLead\("contact", data\)/);
  assert.match(source, /submissionInFlight\.current = true[\s\S]*?await submitLead[\s\S]*?finally[\s\S]*?submissionInFlight\.current = false/);
  assert.ok(source.indexOf('new FormData(form)') < source.indexOf('setStatus("sending")'));
  assert.match(source, /errorRef\.current\?\.focus\(\)/);
  assert.match(source, /successHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /ref=\{successHeadingRef\}[\s\S]*?tabIndex=\{-1\}/);
  assert.match(source, /e\.preventDefault\(\)/);
  assert.doesNotMatch(source, /action="\/api\/lead"|method="post"/);
});
