import type { PlacedHome } from "@/lib/placed-homes";

// The client-side sold-home sorter needs card summaries, not each project's
// complete gallery. Keep full records for the map, schema, and detail pages.
export type PlacedHomeCard = Pick<PlacedHome,
  "slug" | "address" | "town" | "beds" | "baths" | "style" | "price" |
  "photo" | "modelName" | "lotAcres" | "closeDate"
> & { photoCount: number };

export function toPlacedHomeCard(home: PlacedHome): PlacedHomeCard {
  return {
    slug: home.slug,
    address: home.address,
    town: home.town,
    beds: home.beds,
    baths: home.baths,
    style: home.style,
    price: home.price,
    photo: home.photo,
    photoCount: home.photos.length,
    modelName: home.modelName,
    lotAcres: home.lotAcres,
    closeDate: home.closeDate,
  };
}
