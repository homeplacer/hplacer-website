import { getAllPlacedHomes } from "@/lib/placed-homes";
import { soldExampleImageSizes } from "@/lib/sold-example-images";
import { HistoricalProjectCard } from "@/components/historical-project-card";
export function SoldExamples() {
  const homes = getAllPlacedHomes().filter(h => h.photo && h.price > 0 && h.closeDate).sort((a,b) => b.closeDate!.localeCompare(a.closeDate!)).slice(0,3);
  return <section className="container-x py-20"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Proof, not promises</p><h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">Real homes, real sold prices</h2><p className="mt-3 text-stone-muted">Completed Home Placer projects. Historical sale prices include each specific home and property; these homes are sold and are not current offers or quotes.</p></div><div className="mt-9 grid gap-6 sm:grid-cols-3">{homes.map(h => <HistoricalProjectCard key={h.slug} home={h} sizes={soldExampleImageSizes} />)}</div></section>;
}
