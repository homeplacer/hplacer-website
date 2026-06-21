// Transforms the manufacturer-extraction workflow output into data/models.json
// (the site's inventory source). Re-run with a new extract file as needed:
//   node scripts/build-models.mjs [path-to-workflow-output.json]
import fs from "node:fs";

// Merge every extraction source: round-1 workflow (59), round-2 Clayton
// workflow (31), and the manually-captured Cavco models (4). Each may be a raw
// workflow output ({result:{models}}), a {models} object, or a bare array.
const TASKS = "/private/tmp/claude-501/-Users-spencer/8faff905-2d22-4296-8f1e-4ff656f03134/tasks/";
const SOURCES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [TASKS + "w1rjo0zi2.output", TASKS + "wi3ogksxw.output", "data/_cavco-extra.json"];

function extractModels(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  return j.result?.models || j.models || (Array.isArray(j) ? j : []);
}

const allRaw = SOURCES.flatMap(extractModels);
fs.writeFileSync("data/_models-raw.json", JSON.stringify(allRaw, null, 2)); // stable backup
const models = allRaw.filter((m) => m.extractionOk && m.widthFt && m.lengthFt);

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Oxford "Ultra Pro Flex" model names came back synthesized ("Big Boy") — use a
// clean size-based name instead. Everything else has real marketing names.
function cleanName(m) {
  if (/ultra\s*(pro\s*)?flex/i.test(m.series || "")) {
    return `Ultra Flex ${m.widthFt}×${m.lengthFt}`;
  }
  return String(m.modelName || "").replace(/\s+/g, " ").trim();
}

// Rank images so exterior photos lead, floor plans trail — the card/hero should
// show the home, not a blueprint. (Clayton: /ext/ /int/ /flp/; Champion:
// elevations/exterior vs fpcategories/floorplan.)
function imgRank(u) {
  const s = u.toLowerCase();
  if (/\/flp\/|floorplan|fpcategories|\/fp\//.test(s)) return 3;
  if (/\/ext\/|elevation|exterior/.test(s)) return 0;
  if (/\/int\/|interior/.test(s)) return 1;
  return 2;
}
const sortImages = (urls) =>
  urls.map((u, i) => [u, i]).sort((a, b) => imgRank(a[0]) - imgRank(b[0]) || a[1] - b[1]).map((x) => x[0]);

const seen = new Set();
const out = models.map((m) => {
  const name = cleanName(m);
  let slug = slugify(name);
  if (seen.has(slug)) slug = slugify(`${name}-${(m.modelCode || "").slice(-4)}`);
  let i = 2;
  while (seen.has(slug)) slug = `${slugify(name)}-${i++}`;
  seen.add(slug);

  return {
    slug,
    brand: m.brand, // Clayton | Cavco | Champion
    series: (m.series || "").trim(),
    name,
    modelCode: m.modelCode || "",
    widthFt: m.widthFt,
    lengthFt: m.lengthFt,
    sqft: m.computedSqft, // width × length, per MLS rule
    beds: m.beds,
    baths: m.baths,
    description: String(m.description || "").trim(),
    decorOptions: Array.isArray(m.decorOptions) ? m.decorOptions : [],
    imageUrls: sortImages(
      (m.imageUrls || []).filter(
        (u) => /^https?:\/\//.test(u) && !/\.(pdf|mp4|mov|webm)(\?|$)/i.test(u),
      ),
    ),
    sourceUrl: m.sourceUrl,
  };
});

fs.writeFileSync("data/models.json", JSON.stringify(out, null, 2));
const byBrand = out.reduce((a, m) => ((a[m.brand] = (a[m.brand] || 0) + 1), a), {});
console.log(`wrote data/models.json — ${out.length} models`, byBrand);
