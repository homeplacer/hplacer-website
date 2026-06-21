// From the Champion exterior re-fetch, keep only a model's OWN exterior photo
// (not the recurring related-model thumbnails or logos). Writes
// data/_champion-exteriors.json (slug -> exterior url) for build-models to apply.
import fs from "node:fs";

const SRC =
  process.argv[2] ||
  "/private/tmp/claude-501/-Users-spencer/8faff905-2d22-4296-8f1e-4ff656f03134/tasks/w2fka6kbu.output";

const need = JSON.parse(fs.readFileSync("/tmp/champ_need.json", "utf8"));
const urlBySlug = Object.fromEntries(need.map((n) => [n.slug, n.url]));
const results = JSON.parse(fs.readFileSync(SRC, "utf8")).result.results;

const map = {};
for (const r of results) {
  const seg = (urlBySlug[r.slug] || "").split("/").pop().toLowerCase(); // e.g. dutch-elite-3262-02-silver-birch
  const codeTok = seg.split("-").filter((t) => /\d/.test(t)).join("-"); // numeric code, e.g. 2856-09
  const nameTok = seg.split("-").filter((t) => t.length > 3 && !/\d/.test(t)).pop(); // e.g. silverbirch->birch
  const candidates = (r.allImageUrls || []).filter((u) => {
    const s = u.toLowerCase();
    return /exterior|elevation/.test(s) && !/logo|websiteslogos/.test(s);
  });
  // accept only if it references THIS model (own code or distinctive name token)
  const own = candidates.find((u) => {
    const s = u.toLowerCase();
    return (codeTok && s.includes(codeTok)) || (nameTok && s.includes(nameTok)) || s.includes(seg);
  });
  if (own) map[r.slug] = own;
}

fs.writeFileSync("data/_champion-exteriors.json", JSON.stringify(map, null, 2));
console.log(`own-exteriors found: ${Object.keys(map).length}/${results.length}`);
console.log(Object.keys(map).join(", ") || "(none)");
