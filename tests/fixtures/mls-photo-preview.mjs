// Isolated actual-component preview. Photos and failures are local fixtures;
// no upstream feed, Images service, tracking, or production requests are made.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import sharp from 'sharp';

const filename = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(filename), '../..');
const require = createRequire(import.meta.url);
const serverBundle = await build({
  absWorkingDir: projectRoot, entryPoints: ['src/components/mls-package-photo.tsx'],
  bundle: true, write: false, jsx: 'automatic', platform: 'node', format: 'cjs',
  external: ['react', 'react/*'], logLevel: 'silent',
});
export const fixtureProps = {
  listingKey: '1234567890', photoUrl: 'https://forturro.com/api/img/1234567890/1',
  alt: 'Synthetic MLS image fixture', className: 'photo', sizes: '372px', loading: 'lazy',
};
export function loadComponent(react = React, text = serverBundle.outputFiles[0].text) {
  const compiled = { exports: {} };
  runInNewContext(text, { module: compiled, exports: compiled.exports, require: name => name === 'react' ? react : require(name) });
  return compiled.exports.MlsPackagePhoto;
}
export function renderFixture(props = fixtureProps) {
  return renderToString(React.createElement(loadComponent(), props));
}

async function start() {
  // Preserve actual helper validation by aliasing ONLY the fixture's original
  // URL to the known synthetic canonical URL before calling the real helper.
  const fixtureAlias = {
    name: 'loopback-mls-photo', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/mls-photo$/ }, () => ({ path: 'helper', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/src\/lib\/mls-photo\.ts$/, namespace: 'fixture' }, args => ({ path: args.path, namespace: 'file' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `
        import { mlsPhotoSrcSet as real } from ${JSON.stringify(resolve(projectRoot, 'src/lib/mls-photo.ts'))};
        export function mlsPhotoSrcSet(key, original) {
          return real(key, original === '/original.jpg' ? 'https://forturro.com/api/img/1234567890/1' : original);
        }
      ` }));
    },
  };
  const props = { ...fixtureProps, photoUrl: '/original.jpg' };
  const shared = { absWorkingDir: projectRoot, bundle: true, write: false, jsx: 'automatic', logLevel: 'silent', plugins: [fixtureAlias] };
  const fixtureServer = await build({ ...shared, entryPoints: ['src/components/mls-package-photo.tsx'], platform: 'node', format: 'cjs', external: ['react', 'react/*'] });
  const html = renderToString(React.createElement(loadComponent(React, fixtureServer.outputFiles[0].text), props));
  const browser = await build({ ...shared, platform: 'browser', format: 'iife', stdin: {
    resolveDir: projectRoot, sourcefile: 'mls-photo-fixture.jsx', contents: `
      import { createElement } from 'react';
      import { hydrateRoot } from 'react-dom/client';
      import { MlsPackagePhoto } from './src/components/mls-package-photo';
      document.getElementById('hydrate').addEventListener('click', e => {
        e.currentTarget.disabled = true;
        hydrateRoot(document.getElementById('root'), createElement(MlsPackagePhoto, ${JSON.stringify(props)}));
      });
      function inspect() {
        const image = document.querySelector('#root .mls-js-photo');
        document.getElementById('diagnostics').textContent = JSON.stringify({
          src: image?.getAttribute('src'), srcSet: image?.getAttribute('srcset'),
          currentSrc: image?.currentSrc, naturalWidth: image?.naturalWidth,
          complete: image?.complete, renderedWidth: image?.getBoundingClientRect().width
        }, null, 2);
      }
      new MutationObserver(inspect).observe(document.getElementById('root'), { attributes: true, subtree: true, childList: true });
      document.addEventListener('load', inspect, true);
      document.addEventListener('error', inspect, true);
      inspect();
    `,
  } });
  const original = await sharp({ create: { width: 1412, height: 941, channels: 3, background: '#738490' } }).jpeg().toBuffer();
  const derivatives = new Map();
  for (const width of [320, 480, 640, 768, 1200]) derivatives.set(width, await sharp(original).resize({ width }).webp({ quality: 75 }).toBuffer());
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(browser.outputFiles[0].contents); return; }
    if (url.pathname === '/original.jpg') { response.setHeader('Content-Type', 'image/jpeg'); response.end(original); return; }
    const candidate = url.pathname.match(/^\/api\/mls-photo\/1234567890\/([0-9]+)$/);
    if (candidate) {
      const failing = request.headers.referer?.includes('mode=fail');
      const bytes = derivatives.get(Number(candidate[1]));
      if (failing || !bytes) { response.writeHead(503).end('Synthetic missing binding'); return; }
      response.setHeader('Content-Type', 'image/webp'); response.end(bytes); return;
    }
    if (url.pathname !== '/') { response.writeHead(404).end('No other route exists'); return; }
    const scriptsBlocked = url.searchParams.get('mode') === 'scripts-blocked';
    response.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src ${scriptsBlocked ? "'none'" : "'self'"}; connect-src 'none'; form-action 'none'; base-uri 'none'`);
    response.setHeader('Content-Type', 'text/html');
    response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated MLS photo preview</title><style>body{font:16px system-ui;margin:20px}#root{max-width:372px}.photo{aspect-ratio:3/2;width:100%;object-fit:cover}pre{white-space:pre-wrap}</style></head><body><h1>MLS photo: ${url.searchParams.get('mode') || 'success'}</h1><p>Synthetic local image only; no real API or provider usage. Scripts-blocked is NOT browser scripting disabled and does not exercise noscript.</p><p><a href="/">Success</a> · <a href="/?mode=fail">Failure before hydration</a> · <a href="/?mode=scripts-blocked">Scripts blocked</a></p>${scriptsBlocked ? '' : '<button id="hydrate">Hydrate actual component</button>'}<div id="root">${html}</div><pre id="diagnostics">SSR snapshot</pre>${scriptsBlocked ? '' : '<script src="/fixture.js"></script>'}</body></html>`);
  });
  server.listen(18063, '127.0.0.1', () => console.log('Isolated MLS photo fixture: http://127.0.0.1:18063/ (also ?mode=fail and ?mode=scripts-blocked)'));
}
if (process.argv[1] && resolve(process.argv[1]) === filename) await start();
