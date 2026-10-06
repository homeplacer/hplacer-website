import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createElement } from "react";
import * as react from "react";
import { renderToStaticMarkup } from "react-dom/server";
import jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import sharp from "sharp";

const read = (path) => readFileSync(path, "utf8");
const models = JSON.parse(read("data/models.json"));
const assets = JSON.parse(read("src/lib/model-gallery-assets.json"));
const load = (path, imports = {}) => {
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
    compiled,
    compiled.exports,
  );
  return compiled.exports;
};
const galleryImages = load("src/lib/model-gallery-images.ts", {
  "./model-gallery-assets.json": assets,
});
const { FallbackImage } = load("src/components/fallback-image.tsx", {
  react,
  "react/jsx-runtime": jsxRuntime,
});
const componentImports = {
  react,
  "react/jsx-runtime": jsxRuntime,
  "@/components/icons": { HomeMark: () => null },
  "@/components/fallback-image": { FallbackImage },
  "@/lib/model-gallery-images": galleryImages,
};
const { HomeGallery } = load("src/components/home-gallery.tsx", {
  ...componentImports,
  "@/components/home-gallery-lightbox": {
    HomeGalleryLightbox: () => createElement("span", null, "On-demand viewer"),
  },
});
const { HomeGalleryLightbox } = load(
  "src/components/home-gallery-lightbox.tsx",
  componentImports,
);
const { ModelVirtualTour } = load("src/components/model-virtual-tour.tsx", {
  react,
  "react/jsx-runtime": jsxRuntime,
});
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("manifest covers every current local gallery source without inventing gapped or remote paths", () => {
  const sources = models
    .flatMap((model) => model.imageUrls)
    .filter((source) => source.startsWith("/models/"));
  assert.deepEqual(Object.keys(assets).sort(), [...new Set(sources)].sort());
  for (const source of sources) {
    assert.ok(galleryImages.modelGallerySrcSet(source, "hero"));
    assert.ok(galleryImages.modelGallerySrcSet(source, "thumbnail"));
  }
  for (const source of [
    "/models/beacon/03.jpg",
    "/models/eclipse/16.jpg",
    "/models/unknown/01.jpg",
    "/models/eclipse/03-640.webp",
    "https://api.claytonhomes.com/image.jpg",
  ]) {
    assert.equal(galleryImages.modelGallerySrcSet(source, "hero"), undefined);
  }
  assert.match(
    galleryImages.modelGallerySrcSet("/models/eclipse/03.jpg", "hero"),
    /03-gallery-960.webp 960w/,
  );
  assert.match(
    galleryImages.modelGallerySrcSet("/models/eclipse/03.jpg", "hero"),
    /03-gallery-768.webp 768w/,
  );
  assert.match(
    galleryImages.modelGallerySrcSet("/models/beacon/00.jpg", "hero"),
    /00-gallery-640.webp 640w/,
  );
});

test("every derivative exists, has a truthful width and preserves photo proportions without enlargement", async () => {
  for (const [source, widths] of Object.entries(assets)) {
    const original = await sharp(`public${source}`).metadata();
    assert.equal(new Set(widths).size, widths.length, source);
    assert.ok(widths.length <= 6, source);
    assert.ok(widths.includes(Math.min(768, original.width)), source);
    for (const width of widths) {
      assert.ok(width <= original.width, source);
      const path = `public${source.slice(0, -4)}-gallery-${width}.webp`;
      assert.ok(statSync(path).size > 0, path);
      const variant = await sharp(path).metadata();
      assert.equal(variant.format, "webp", path);
      assert.equal(variant.width, width, path);
      assert.ok(
        Math.abs(variant.height - (original.height * width) / original.width) <=
          1,
        path,
      );
    }
  }
});

test("all source photos remain byte-for-byte unchanged from the task base", () => {
  for (const path of [
    ...Object.keys(assets).map((source) => `public${source}`),
  ]) {
    const original = execFileSync("git", ["show", `5030cdf:${path}`], {
      maxBuffer: 10 * 1024 * 1024,
    });
    assert.equal(digest(readFileSync(path)), digest(original), path);
  }
});

test("catalog preserves the task base except the verified exact-plan Tradition 68 tour repair", () => {
  const original = JSON.parse(execFileSync("git", ["show", "5030cdf:data/models.json"], {
    encoding: "utf8",
  }));
  const tradition = original.find((model) => model.slug === "tradition-68");
  assert.equal(tradition.tourUrl, "https://my.matterport.com/show/?m=aa2GGU46jcX");
  tradition.tourUrl = "https://my.matterport.com/show/?m=sFnvNkUWzgV";
  assert.deepEqual(models, original);
});

test("server-readable galleries prioritize the true hero and limit initial thumbnails without losing originals", () => {
  for (const slug of ["ultra-flex-28-68", "eclipse", "beacon"]) {
    const model = models.find((candidate) => candidate.slug === slug);
    const html = renderToStaticMarkup(
      createElement(HomeGallery, {
        images: model.imageUrls,
        name: model.name,
        brand: model.brand,
      }),
    );
    assert.match(html, /loading="eager" fetchPriority="high"/);
    assert.ok(html.includes(`src="${model.imageUrls[0]}"`));
    assert.ok(
      html.includes(
        `srcSet="${galleryImages.modelGallerySrcSet(model.imageUrls[0], "hero")}"`,
      ),
    );
    assert.equal((html.match(/<img /g) ?? []).length, 7);
    assert.equal((html.match(/loading="lazy"/g) ?? []).length, 6);
    assert.ok(html.includes(`See all ${model.imageUrls.length} photos`));
    for (const src of model.imageUrls)
      assert.ok(html.includes(`href="${src}"`), src);
    assert.match(html, /<noscript>/);
    assert.doesNotMatch(html, /<dialog|On-demand viewer/);
    const viewer = renderToStaticMarkup(
      createElement(HomeGalleryLightbox, {
        images: model.imageUrls,
        name: model.name,
        active: 0,
        onSelect: () => {},
        onNext: () => {},
        onPrevious: () => {},
      }),
    );
    for (let index = 0; index < model.imageUrls.length; index += 1)
      assert.ok(viewer.includes(`Go to photo ${index + 1}`));
    assert.ok(viewer.includes(`src="${model.imageUrls[0]}"`));
  }
});

test("viewer renders only on request and retains native modality, Escape, arrows, focus return, scroll lock, and swipe", () => {
  const shell = read("src/components/home-gallery.tsx");
  assert.doesNotMatch(shell, /next\/dynamic/);
  assert.match(shell, /\{open && \(/);
  assert.match(shell, /dialog\.showModal\(\)/);
  assert.match(shell, /onCancel=/);
  assert.match(shell, /ArrowRight.*ArrowLeft/);
  assert.match(shell, /trigger\?\.focus\(\)/);
  assert.match(shell, /first\?\.focus\(\)/);
  assert.match(shell, /last\?\.focus\(\)/);
  assert.match(shell, /lastTriggerRef\.current = trigger/);
  assert.match(shell, /openAt\(active, event\.currentTarget\)/);
  assert.match(shell, /openAt\(index, event\.currentTarget\)/);
  assert.match(shell, /openAt\(MAX_THUMBS - 1, event\.currentTarget\)/);
  assert.doesNotMatch(
    shell,
    /lastTriggerRef\.current = document\.activeElement/,
  );
  assert.match(shell, /document\.body\.style\.overflow = "hidden"/);
  assert.match(shell, /document\.body\.style\.overflow = previousOverflow/);
  const viewer = read("src/components/home-gallery-lightbox.tsx");
  assert.match(viewer, /onTouchStart=/);
  assert.match(viewer, /onTouchEnd=/);
  assert.match(viewer, /Previous photo/);
  assert.match(viewer, /Next photo/);
  assert.match(viewer, /Rendered only after a visitor expands a photo/);
});

test("tour has a real start button and no initial iframe, with a server-readable original URL fallback", () => {
  const url = "https://momento360.com/e/u/test";
  const html = renderToStaticMarkup(
    createElement(ModelVirtualTour, { url, name: "Eclipse" }),
  );
  assert.match(html, /<button type="button"/);
  assert.match(html, /Start Eclipse virtual tour/);
  assert.ok(
    html.includes(`href="${url}" target="_blank" rel="noopener noreferrer"`),
  );
  assert.doesNotMatch(html, /<iframe/);
  const { ModelVirtualTour: StartedTour } = load(
    "src/components/model-virtual-tour.tsx",
    {
      react: { ...react, useState: () => [true, () => {}] },
      "react/jsx-runtime": jsxRuntime,
    },
  );
  const started = renderToStaticMarkup(
    createElement(StartedTour, { url, name: "Eclipse" }),
  );
  assert.match(started, /<iframe/);
  assert.ok(
    started.includes(`href="${url}" target="_blank" rel="noopener noreferrer"`),
  );
  assert.match(
    read("src/components/model-virtual-tour.tsx"),
    /iframeRef\.current\?\.focus\(\)/,
  );
  assert.match(
    read("src/components/model-virtual-tour.tsx"),
    /started \? <iframe|started \? \(/,
  );
  const page = read("src/app/homes/[slug]/page.tsx");
  assert.match(page, /<ModelVirtualTour url=\{tourUrl\} name=\{home\.name\}/);
  assert.match(page, /trustedVirtualTourUrl\(home\.tourUrl\)/);
});

test("cards keep all eighteen verified legacy covers and use capped variants for the two non-01 covers", async () => {
  const card = read("src/components/home-card.tsx");
  assert.match(card, /const photo = home\.imageUrls\[0\]/);
  assert.match(card, /srcSet=\{modelCardSrcSet\(photo\)\}/);
  const covers = models.filter((model) =>
    model.imageUrls[0]?.startsWith("/models/"),
  );
  assert.equal(covers.length, 20);
  let legacy = 0;
  for (const model of covers) {
    const source = model.imageUrls[0];
    const set = galleryImages.modelCardSrcSet(source);
    assert.ok(set, source);
    const variants = set.split(", ").map((candidate) => {
      const [url, width] = candidate.split(" ");
      return { url, width: Number.parseInt(width, 10) };
    });
    for (const variant of variants) {
      assert.ok(variant.width <= 640, source);
      assert.equal(
        (await sharp(`public${variant.url}`).metadata()).width,
        variant.width,
      );
    }
    if (source.endsWith("/01.jpg")) {
      legacy += 1;
      const stem = source.slice(0, -4);
      assert.equal(set, `${stem}-480.webp 480w, ${stem}-640.webp 640w`);
      for (const variant of variants) {
        const path = `public${variant.url}`;
        const original = execFileSync("git", ["show", `5030cdf:${path}`]);
        assert.equal(digest(readFileSync(path)), digest(original), path);
      }
    } else {
      assert.ok(["beacon", "eclipse"].includes(model.slug));
      assert.deepEqual(
        variants.map((variant) => variant.width),
        [320, 640],
      );
    }
  }
  assert.equal(legacy, 18);
});

test("375px DPR 2 and 3 catalog cover budgets have zero per-cover regression", () => {
  const covers = models.filter((model) =>
    model.imageUrls[0]?.startsWith("/models/"),
  );
  const select = (set, needed) => {
    const variants = set.split(", ").map((candidate) => {
      const [url, width] = candidate.split(" ");
      return { url, width: Number.parseInt(width, 10) };
    });
    return (
      variants.find((variant) => variant.width >= needed) ?? variants.at(-1)
    ).url;
  };
  for (const dpr of [2, 3]) {
    let beforeTotal = 0;
    let afterTotal = 0;
    let unchanged = 0;
    for (const model of covers) {
      const source = model.imageUrls[0];
      const stem = source.slice(0, -4);
      const legacy = /^\/models\/[^/]+\/01\.jpg$/.test(source);
      const beforeUrl = legacy
        ? select(
            `${stem}-480.webp 480w, ${stem}-640.webp 640w`,
            (375 - 40) * dpr,
          )
        : source;
      const afterUrl = select(
        galleryImages.modelCardSrcSet(source),
        (375 - 40) * dpr,
      );
      const before = statSync(`public${beforeUrl}`).size;
      const after = statSync(`public${afterUrl}`).size;
      assert.ok(
        after <= before,
        `${model.slug} DPR${dpr}: ${after} > ${before}`,
      );
      if (legacy) {
        assert.equal(afterUrl, beforeUrl);
        unchanged += 1;
      }
      beforeTotal += before;
      afterTotal += after;
    }
    assert.equal(unchanged, 18);
    assert.ok(afterTotal < beforeTotal * 0.5);
  }
});

test("mobile heroes have a smaller 768w candidate while preserving gallery originals", () => {
  for (const slug of ["ultra-flex-28-68", "eclipse"]) {
    const model = models.find((candidate) => candidate.slug === slug);
    const heroSet = galleryImages.modelGallerySrcSet(model.imageUrls[0], "hero");
    const candidates = heroSet.split(", ").map((candidate) => {
      const [url, width] = candidate.split(" ");
      return { url, width: Number.parseInt(width, 10) };
    });
    for (const dpr of [1.75, 2]) {
      const needed = 372 * dpr;
      const selected = candidates.find((candidate) => candidate.width >= needed);
      assert.equal(selected.width, 768, `${slug} DPR ${dpr}`);
      const previous = candidates
        .filter((candidate) => candidate.width !== 768)
        .find((candidate) => candidate.width >= needed);
      assert.equal(previous.width, 960, `${slug} DPR ${dpr}`);
      assert.ok(
        statSync(`public${selected.url}`).size <
          statSync(`public${previous.url}`).size * 0.75,
        `${slug}: 768w should save at least 25% against the previous 960w candidate`,
      );
    }
    // The original hero and its thumbnail share one URL and transfer only once.
    const before = model.imageUrls
      .slice(0, 12)
      .reduce((bytes, source) => bytes + statSync(`public${source}`).size, 0);
    // A ~372 CSS pixel hero at DPR 1.75 or 2 has a 768w candidate;
    // ~80 CSS pixel tiles retain their compact 160w candidate.
    const after =
      statSync(`public${model.imageUrls[0].slice(0, -4)}-gallery-768.webp`)
        .size +
      model.imageUrls
        .slice(0, 6)
        .reduce(
          (bytes, source) =>
            bytes +
            statSync(`public${source.slice(0, -4)}-gallery-160.webp`).size,
          0,
        );
    assert.ok(after < before * 0.1, `${slug}: ${after} vs ${before}`);
  }
});
