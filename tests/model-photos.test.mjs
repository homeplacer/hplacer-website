import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const models = JSON.parse(readFileSync("data/models.json", "utf8"));
const model = (slug) => {
  const record = models.find((candidate) => candidate.slug === slug);
  assert.ok(record, `Model remains present: ${slug}`);
  return record;
};

// Exact replacements verified against the manufacturer's own model galleries.
// No HTTP requests run in these regression tests; a CDN outage cannot make CI fail.
const verifiedCorrections = [
  {
    slug: "birdie",
    index: 7,
    expected: "https://api.claytonhomes.com/images/mfg/int/4564099a-67a3-4896-adcf-f7bacb063ef8.png",
    rejected: "4564099a-67a3-4896-adcf-f7bacb063fd8",
  },
  {
    slug: "limelight",
    index: 4,
    expected: "https://api.claytonhomes.com/images/mfg/ext/e378ba3d-bc54-4bf6-a025-e91459f98e44.jpg?width=992",
    rejected: "e378ba3d-bcf6-a025-e91459f98e44",
  },
  {
    slug: "limelight",
    index: 13,
    expected: "https://api.claytonhomes.com/images/mfg/int/3227d8d6-fac2-497e-a454-a197658fe6e1.jpg?width=992",
    rejected: "3227d8d6-fce2-497e-a454-a197658fe6e1",
  },
  {
    slug: "phoenix",
    index: 2,
    expected: "https://api.claytonhomes.com/images/mfg/int/7c892d90-4d22-433c-8c90-5439daf55c52.png?width=992",
    rejected: "7c892d90-4d22-433c-b612-8730ffa0e6f6",
  },
];

test("manufacturer-backed photo corrections replace only the malformed gallery URLs", () => {
  const allGalleryUrls = models.flatMap((record) => record.imageUrls ?? []);
  for (const correction of verifiedCorrections) {
    assert.equal(model(correction.slug).imageUrls[correction.index], correction.expected);
    assert.equal(allGalleryUrls.some((url) => url.includes(correction.rejected)), false);
  }
  assert.equal(model("birdie").imageUrls.length, 12);
  assert.equal(model("limelight").imageUrls.length, 15);
  assert.equal(model("phoenix").imageUrls.length, 7);
});

test("Empower retains all fourteen working images in order without the unavailable image", () => {
  const expected = [
    ["ext", "817abc62-e443-4740-81f3-a2a156f34af5"],
    ["ext", "7f657d42-4762-448b-aa58-1c594056a5f3"],
    ["ext", "5fe3272d-559b-48b7-a461-3bb67361792a"],
    ["int", "9f197a26-572c-4dc0-800f-a3f110f2b17f"],
    ["int", "4a644b5c-a187-434e-b074-083f4a184844"],
    ["int", "0c7eb741-7ef5-4f03-9abb-d15b816627eb"],
    ["int", "4b616a36-057a-46c3-9765-58841d0d99aa"],
    ["int", "2c5d82d4-460f-429c-92b3-74606adab329"],
    ["int", "18d55d1c-f6ad-4d92-9afe-35d82c8d88ca"],
    ["int", "5b5018db-ca15-47f3-8c90-4b920a039518"],
    ["int", "15ba87c1-f59b-4eb3-a66d-f121c383324c"],
    ["int", "3fa698df-e0d5-4539-96a0-2dd21df49daa"],
    ["int", "07f1bc14-28d8-4378-9d69-5e26e9075e3c"],
    ["int", "dbc50683-f669-495c-8bf6-65e6f80593f7"],
  ].map(([kind, id]) => `https://api.claytonhomes.com/images/mfg/${kind}/${id}.jpg?width=992`);
  assert.deepEqual(model("empower").imageUrls, expected);
  assert.equal(models.some((record) => record.imageUrls?.some((url) => url.includes("ef67a3fe-b8e3-4e76-9611-97eb93619903"))), false);
});

test("Cavco models retain their own verified image and local floor plan, not the shared Rose interior", () => {
  const expectedImages = {
    "summit-32483a": "https://cdn2.cavco.com/public/phhweb/gallery/file/2B2AE2D5051C406285E57F8856A2675B/26ts32483a_rf0_1768853607714_990_12.jpg",
    "summit-28564t": "https://cdn2.cavco.com/public/phhweb/gallery/file/5ECF5E61354D45068AD9A59887725F8D/26ts28564t_rf0_1134_12.jpg",
    "pinnacle-16763b": "https://cdn2.cavco.com/public/phhweb/gallery/file/E9567CC674B7491FB87D74678C1A5AC8/26pn16763b_rf0_1134_12.jpg",
  };
  for (const [slug, expectedImage] of Object.entries(expectedImages)) {
    const record = model(slug);
    assert.deepEqual(record.imageUrls, [expectedImage]);
    assert.deepEqual(record.floorPlans, [{ url: `/models/${slug}/02.jpg` }]);
    assert.ok(existsSync(`public/models/${slug}/02.jpg`));
  }
  assert.equal(models.some((record) => record.imageUrls?.some((url) => url.includes("24_fw-260_therose-kh12401u"))), false);
});
