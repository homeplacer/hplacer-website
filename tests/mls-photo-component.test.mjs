import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureProps, loadComponent, renderFixture } from './fixtures/mls-photo-preview.mjs';

test('actual SSR reserves the existing photo box and authentic alt, with bounded own-site candidates', () => {
  const html = renderFixture();
  assert.match(html, /src="https:\/\/forturro.com\/api\/img\/1234567890\/1"/);
  assert.match(html, /srcSet="\/api\/mls-photo\/1234567890\/320 320w, .*1200 1200w"/);
  assert.match(html, /sizes="372px"/);
  assert.match(html, /alt="Synthetic MLS image fixture"/);
  assert.match(html, /class="mls-js-photo photo"/);
  assert.match(html, /loading="lazy" decoding="async"/);
  assert.match(html, /<noscript><style>\.mls-js-photo\{display:none!important\}<\/style><img[^>]+src="https:\/\/forturro.com/);
});

test('detail default loading remains eager in the original noscript fallback without duplicate original preload', () => {
  const html = renderFixture({ ...fixtureProps, loading: undefined });
  const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
  assert.ok(fallback);
  assert.doesNotMatch(fallback, /loading="lazy"/);
  assert.doesNotMatch(html, /<link[^>]*href="https:\/\/forturro.com/);
});

function driver() {
  let state;
  const ref = { current: null };
  let effects = [];
  const Component = loadComponent({
    useState: () => [state, next => { state = next; }],
    useRef: () => ref,
    useEffect: effect => { effects.push(effect); },
  });
  const render = (props = fixtureProps) => {
    effects = [];
    return Component(props).props.children[1];
  };
  return { ref, render, effects: () => effects.forEach(effect => effect()) };
}

test('an image error removes every responsive candidate and restores the original without an error loop', () => {
  const view = driver();
  const first = view.render();
  assert.ok(first.props.srcSet);
  first.props.onError();
  const fallback = view.render();
  assert.equal(fallback.props.src, fixtureProps.photoUrl);
  assert.equal(fallback.props.srcSet, undefined);
  assert.equal(fallback.props.sizes, undefined);
  assert.equal(fallback.props.alt, fixtureProps.alt);
  fallback.props.onError();
  assert.equal(view.render().props.srcSet, undefined);
  const changed = view.render({ ...fixtureProps, listingKey: '999', photoUrl: 'https://forturro.com/api/img/999/1' });
  assert.ok(changed.props.srcSet, 'a new photo is not permanently disabled by an earlier failure');
});

test('a candidate that failed before hydration still switches to the original', () => {
  const view = driver();
  view.render();
  view.ref.current = { complete: true, naturalWidth: 0 };
  view.effects();
  assert.equal(view.render().props.srcSet, undefined);
});
