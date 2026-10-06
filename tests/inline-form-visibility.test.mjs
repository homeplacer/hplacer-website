import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const bundle = await build({
  entryPoints: ['src/lib/inline-form-visibility.ts'], bundle: true, write: false,
  platform: 'node', format: 'cjs', logLevel: 'silent',
});

function element(tagName, { dialog = null, region = null, formRegion = tagName === 'DIV', descendants = [] } = {}) {
  return {
    nodeType: 1, tagName,
    closest: (selector) => selector === 'dialog' ? dialog : region,
    matches: () => tagName === 'FORM' || formRegion,
    querySelectorAll: () => descendants.filter(node => node.matches()),
  };
}

function harness(elements = []) {
  const changes = [];
  const observers = {};
  let scans = 0;
  const root = {
    elements,
    querySelectorAll: () => { scans++; return root.elements.filter(node => node.matches()); },
    contains: node => root.elements.includes(node),
  };
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
  return { root, io: observers.intersection, mo: observers.mutation, changes, stop,
    scans: () => scans,
    mutate: (addedNodes = []) => observers.mutation.callback([{ addedNodes }]),
  };
}

test('the stable region is observed before hydration without duplicating its later native form', () => {
  const region = element('DIV');
  const native = element('FORM', { region });
  const fixture = harness([region]);
  assert.deepEqual([...fixture.io.targets], [region]);
  fixture.io.callback([{ target: region, isIntersecting: true }]);
  assert.deepEqual(fixture.changes, [true]);
  fixture.root.elements = [region, native];
  fixture.mutate([native]);
  assert.deepEqual([...fixture.io.targets], [region]);
  assert.deepEqual(fixture.changes, [true]);
  assert.equal(fixture.scans(), 1, 'Hydration inside a stable region needs no whole-page rescan');
  fixture.stop();
});

test('late forms and client route removals refresh visibility, including an initially empty page', () => {
  const fixture = harness();
  const first = element('FORM');
  const second = element('DIV');
  fixture.root.elements = [first, second];
  fixture.mutate([first, second]);
  fixture.io.callback([{ target: first, isIntersecting: true }, { target: second, isIntersecting: true }]);
  fixture.root.elements = [second];
  fixture.mutate();
  assert.equal(fixture.changes.at(-1), true, 'Another form is still visible');
  fixture.root.elements = [];
  fixture.mutate();
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
  fixture.mutate();
  fixture.io.callback([{ target: inline, isIntersecting: true }]);
  assert.equal(fixture.changes.at(-1), false);
  fixture.stop();
});

test('unrelated child mutations and dialog hydration do not rescan the whole page', () => {
  const inline = element('FORM');
  const fixture = harness([inline]);
  const text = { nodeType: 3 };
  const content = element('SPAN');
  const modal = element('DIALOG');
  modal.closest = () => modal;
  const modalForm = element('FORM', { dialog: modal });
  for (let index = 0; index < 20; index++) fixture.mutate([text, content, modal, modalForm]);
  assert.equal(fixture.scans(), 1);
  assert.deepEqual([...fixture.io.targets], [inline]);
  fixture.stop();
});

test('a route subtree with a dialog followed by a real inline form still refreshes', () => {
  const fixture = harness();
  const modal = element('DIALOG');
  const modalForm = element('FORM', { dialog: modal });
  const inline = element('FORM');
  const route = element('MAIN', { descendants: [modalForm, inline] });
  fixture.root.elements = [inline];
  fixture.mutate([route]);
  assert.equal(fixture.scans(), 2);
  assert.deepEqual([...fixture.io.targets], [inline]);
  fixture.io.callback([{ target: inline, isIntersecting: true }]);
  assert.equal(fixture.changes.at(-1), true);
  fixture.root.elements = [];
  fixture.mutate();
  assert.equal(fixture.changes.at(-1), false);
  fixture.stop();
});

test('moving a visible region into a dialog clears it even when it remains in the document', () => {
  const inline = element('FORM');
  const fixture = harness([inline]);
  fixture.io.callback([{ target: inline, isIntersecting: true }]);
  const dialog = element('DIALOG');
  dialog.closest = () => dialog;
  inline.closest = selector => selector === 'dialog' ? dialog : null;
  fixture.mutate([dialog]);
  assert.equal(fixture.root.contains(inline), true);
  assert.equal(fixture.io.targets.size, 0);
  assert.equal(fixture.changes.at(-1), false);
  inline.closest = () => null;
  fixture.mutate([inline]);
  assert.deepEqual([...fixture.io.targets], [inline]);
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
