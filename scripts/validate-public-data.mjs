import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const text = ts.transpileModule(
  readFileSync("src/lib/package-policy.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const policy = await import(
  `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`
);
const data = json("data/land-home-packages.json");
const models = new Set(json("data/models.json").map((m) => m.slug));
const ids = new Set();
const errors = [];
if (data.schemaVersion !== 1) errors.push("Unknown package schema");
for (const p of data.packages) {
  try {
    errors.push(...policy.packageErrors(p, models).map((e) => `${p.id}: ${e}`));
  } catch {
    errors.push(`${p.id}: malformed package record`);
  }
  if (ids.has(p.id)) errors.push(`Duplicate ID ${p.id}`);
  ids.add(p.id);
  for (const photo of p.publicPhotos || [])
    if (!existsSync(`public${photo}`))
      errors.push(`Missing package photo ${photo}`);
}
const guides = json("data/land-readiness-guides.json").guides;
for (const g of guides) {
  if (
    !g.slug ||
    !g.title ||
    !g.sourceCheckedAt ||
    !g.sections.length ||
    !g.sources.length
  )
    errors.push("Incomplete guide");
  if (g.staffReviewStatus === "approved" && !g.staffReviewer)
    errors.push(`${g.slug}: no actual reviewer`);
  for (const s of g.sources)
    if (
      !/^https:\/\/(www\.)?(horrycountysc\.gov|gtcounty\.org|brunswickcountync\.gov|columbusco\.org)\//.test(
        s.url,
      )
    )
      errors.push(`${g.slug}: unapproved official source`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Public data valid: ${ids.size} package records, ${guides.length} planning checklists.`,
);
