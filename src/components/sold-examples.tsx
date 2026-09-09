import Link from "next/link";
import { getAllPlacedHomes } from "@/lib/placed-homes";
import { formatPrice } from "@/lib/homes";
import { asset } from "@/lib/asset";
export function SoldExamples() {
  const homes = getAllPlacedHomes().filter(h => h.photo && h.price > 0 && h.closeDate).sort((a,b) => b.closeDate!.localeCompare(a.closeDate!)).slice(0,3);
  return <section className="container-x py-16"><h2 className="font-display text-3xl font-semibold">Real homes, real sold prices</h2><p className="mt-3 text-stone-muted">Completed Home Placer projects. Historical sale prices include each specific home and property; these homes are sold and are not current offers or quotes.</p><div className="mt-8 grid gap-6 sm:grid-cols-3">{homes.map(h => <Link key={h.slug} href={`/recently-placed/${h.slug}`} className="overflow-hidden rounded-card border border-stone-line bg-stone-surface">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={asset(h.photo)} alt={`Home placed at ${h.address}, ${h.town}`} width={800} height={600} loading="lazy" className="aspect-[4/3] w-full object-cover"/><div className="p-5"><h3 className="font-semibold">{h.address} · {h.town}</h3><p>{h.beds} beds · {h.baths} baths</p><p className="mt-2 font-semibold text-brand-700">Sold for {formatPrice(h.price)}</p><p className="text-sm text-stone-muted">Closed {h.closeDate} · View project</p></div></Link>)}</div></section>;
}
