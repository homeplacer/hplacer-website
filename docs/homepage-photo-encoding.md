# Homepage photo encoding

The homepage's 960w candidate uses a separate `01-homepage-960.webp` URL. The authentic original JPEG, model-gallery derivatives, 640w/1200w homepage candidates, fallback, responsive slot hints, priority and 4:3 CSS crop are unchanged. The model-detail gallery continues to use `01-gallery-960.webp`.

The dedicated candidate is 97,176 bytes versus the existing 108,332-byte gallery candidate: 11,156 bytes (10.3%) less when this candidate is selected. Mobile 372×279, desktop 502×377 and native-detail comparisons were inspected independently; quality 80 / effort 6 was visually close to the existing quality 82 / effort 5 encoding. Lower-quality trials softened fine texture and were not selected. This is a bounded transfer reduction, not a measured LCP gain or clearance of Semrush findings; the homepage's observed LCP element was introductory text.

After `npm ci`, the explicit local operation is:

```sh
node scripts/build-homepage-photo-asset.mjs
```

The script resolves sharp from the locked Next dependency tree (reviewed with Next 16.3.8, sharp 0.35.5, libwebp 1.6.0). It reads only `/models/ultra-flex-28-52/01.jpg`, verifies its SHA-256 `6711287279b470374c7f60f00761a859d16d6fd565c7c36252b2b1a4e9cf9f80` and 1600×899 dimensions, then applies `resize({ width: 960, withoutEnlargement: true })` and `webp({ quality: 80, effort: 6 })`. The reviewed 960×539 result has SHA-256 `b98de869db174ccf0445d9a4b361aaab2bae77be1b6c46c7caec2e343b13573c` and a 98,000-byte maximum budget. Source, encoder or output changes require renewed inspection before updating these checks.

Repeating the operation retains identical output bytes and timestamps. An unexpected existing output is refused, rather than overwritten. No normal build/development command invokes this script; the committed asset is served normally. The global gallery encoder is unchanged and does not regenerate this dedicated file. No remote image, MLS data, runtime image service, tracking, cache policy or paid provider is involved.

A reviewed release should verify the new URL's served bytes and the unchanged fallback/layout under existing deployment safeguards. The new URL avoids replacing a shared cached gallery asset.
