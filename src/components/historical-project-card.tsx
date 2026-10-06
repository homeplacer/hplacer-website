import Link from "next/link";
import { asset } from "@/lib/asset";
import { formatPrice } from "@/lib/home-types";
import type { PlacedHome } from "@/lib/placed-homes";
import { historicalProjectPhoto } from "@/lib/historical-project-images";

type ProjectSummary = Pick<PlacedHome,
  "slug" | "address" | "town" | "beds" | "baths" | "style" | "price" |
  "photo" | "modelName" | "lotAcres" | "closeDate"
>;

// A published sold-project summary, never an available-property or model card.
// All photo metadata is resolved on the server; no gallery or client state.
export function HistoricalProjectCard({ home, sizes }: { home: ProjectSummary; sizes: string }) {
  const photo = historicalProjectPhoto(home.photo);
  const image = home.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset(home.photo)} alt={`Home placed at ${home.address}, ${home.town}`}
      width={photo?.width ?? 800} height={photo?.height ?? 600} loading="lazy" decoding="async" fetchPriority="low"
      className="aspect-[4/3] w-full bg-stone-bg object-cover transition duration-500 group-hover:scale-[1.03]" />
  ) : null;

  return (
    <Link href={`/recently-placed/${home.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-stone-line bg-stone-surface shadow-sm transition hover:border-brand-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
      {image && <div className="relative overflow-hidden">
        {photo ? <picture className="block"><source type="image/webp" srcSet={photo.srcSet} sizes={sizes} />{image}</picture> : image}
        <span className="absolute left-2 top-2 rounded-full bg-brand-700/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">Sold</span>
      </div>}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="break-words font-display text-lg font-semibold text-stone-ink">{home.address}</h3>
        <p className="mt-1 text-sm font-medium text-brand-700">{home.town}, SC · Sold</p>
        <p className="mt-2 text-sm text-stone-muted">
          {home.beds} beds · {home.baths} baths · {home.style}
          {home.lotAcres ? ` · ${home.lotAcres} ac` : ""}
        </p>
        {home.modelName && <p className="mt-2 text-xs text-stone-muted">Recorded model: {home.modelName}</p>}
        {home.price > 0 && <p className="mt-3 font-semibold text-brand-700">Sold for {formatPrice(home.price)}</p>}
        <p className="mt-1 text-xs text-stone-muted">Historical project · Not available</p>
        <p className="mt-auto pt-3 text-sm font-medium text-stone-muted group-hover:text-brand-700">
          {home.closeDate ? `Closed ${home.closeDate} · View project` : "View project"}
        </p>
      </div>
    </Link>
  );
}
