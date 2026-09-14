import Link from "next/link";
import { getAllPlacedHomes } from "@/lib/placed-homes";
import { formatPrice } from "@/lib/homes";
import { asset } from "@/lib/asset";
export function SoldExamples() {
  const homes = getAllPlacedHomes().filter(h => h.photo && h.price > 0 && h.closeDate).sort((a,b) => b.closeDate!.localeCompare(a.closeDate!)).slice(0,3);
  return <section className="container-x py-20"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Proof, not promises</p><h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">Real homes, real sold prices</h2><p className="mt-3 text-stone-muted">Completed Home Placer projects. Historical sale prices include each specific home and property; these homes are sold and are not current offers or quotes.</p></div><div className="mt-9 grid gap-6 sm:grid-cols-3">{homes.map(h => <Link key={h.slug} href={`/recently-placed/${h.slug}`} className="group overflow-hidden rounded-2xl border border-stone-line bg-stone-surface shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={asset(h.photo)} alt={`Home placed at ${h.address}, ${h.town}`} width={800} height={600} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]"/><div className="p-5"><h3 className="font-display text-lg font-semibold text-stone-ink">{h.address} · {h.town}</h3><p className="mt-1 text-sm text-stone-muted">{h.beds} beds · {h.baths} baths</p><p className="mt-3 font-semibold text-brand-700">Sold for {formatPrice(h.price)}</p><p className="mt-1 text-sm font-medium text-stone-muted group-hover:text-brand-700">Closed {h.closeDate} · View project</p></div></Link>)}</div></section>;
}
