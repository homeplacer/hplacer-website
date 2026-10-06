import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const bundle = await build({
  entryPoints: ['src/lib/inline-form-visibility.ts'], bundle: true, write: false,
  platform: 'node', format: 'cjs', logLevel: 'silent',
});

function element(tagName, { dialog = null, region = null } = {}) {
  return { tagName, closest: (selector) => selector === 'dialog' ? dialog : region };
}

function harness(elements = []) {
  const changes = [];
  const observers = {};
  const root = { elements, querySelectorAll: () => root.elements };
  class IntersectionObserver {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = new Set(); observers.intersection = this; }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.mutation = this; }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
  }
  const fixtureModule = { exports: {} };
  runInNewContext(bundle.outputFiles[0].text, { module: fixtureModule, exports: fixtureModule.exports, IntersectionObserver, MutationObserver });
  const stop = fixtureModule.exports.observeInlineFormVisibility(root, value => changes.push(value));
  return { root, io: observers.intersection, mo: observers.mutation, changes, stop };
}

test('the stable region is observed before hydration without duplicating its later native form', () => {
  const region = element('DIV');
  const native = element('FORM', { region });
  const fixture = harness([region]);
  assert.deepEqual([...fixture.io.targets], [region]);
  fixture.io.callback([{ target: region, isIntersecting: true }]);
  assert.deepEqual(fixture.changes, [true]);
  fixture.root.elements = [region, native];
  fixture.mo.callback();
  assert.deepEqual([...fixture.io.targets], [region]);
  assert.deepEqual(fixture.changes, [true]);
  fixture.stop();
});

test('late forms and client route removals refresh visibility, including an initially empty page', () => {
  const fixture = harness();
  const first = element('FORM');
  const second = element('DIV');
  fixture.root.elements = [first, second];
  fixture.mo.callback();
  fixture.io.callback([{ target: first, isIntersecting: true }, { target: second, isIntersecting: true }]);
  fixture.root.elements = [second];
  fixture.mo.callback();
  assert.equal(fixture.changes.at(-1), true, 'Another form is still visible');
  fixture.root.elements = [];
  fixture.mo.callback();
  assert.equal(fixture.changes.at(-1), false, 'Removed route must not keep the dock hidden');
  assert.equal(fixture.io.targets.size, 0);
  fixture.stop();
  assert.equal(fixture.io.disconnected, true);
  assert.equal(fixture.mo.disconnected, true);
});

test('dialog forms do not hide their own floating dialog trigger; stale targets are ignored', () => {
  const dialog = element('DIALOG');
  const modalRegion = element('DIV', { dialog });
  const modalForm = element('FORM', { dialog, region: modalRegion });
  const inline = element('FORM');
  const fixture = harness([modalRegion, modalForm, inline]);
  assert.deepEqual([...fixture.io.targets], [inline]);
  fixture.io.callback([{ target: modalRegion, isIntersecting: true }]);
  assert.equal(fixture.changes.at(-1), false);
  fixture.io.callback([{ target: inline, isIntersecting: true }]);
  assert.equal(fixture.changes.at(-1), true);
  fixture.root.elements = [];
  fixture.mo.callback();
  fixture.io.callback([{ target: inline, isIntersecting: true }]);
  assert.equal(fixture.changes.at(-1), false);
  fixture.stop();
});

test('visually hidden dock controls leave the keyboard and accessibility trees, not the dialog', () => {
  const bar = readFileSync('src/components/contact-bar.tsx', 'utf8');
  const dialog = readFileSync('src/components/home-inquiry-dialog.tsx', 'utf8');
  assert.match(bar, /data-contact-bar\s+inert=\{hiddenForForm\}/);
  assert.match(bar, /triggerInert=\{hiddenForForm\}/);
  assert.match(dialog, /<a[\s\S]*?inert=\{triggerInert\}/);
  assert.doesNotMatch(dialog, /<dialog[^>]*inert=/);
});
