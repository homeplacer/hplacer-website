import type { PlacedHome } from "./placed-homes";

// Keep the public address and town intact. "Sold" distinguishes this archive
// from current inventory; the root title template supplies the business name.
export function placedHomeMetadata(
  home: Pick<PlacedHome, "address" | "town" | "slug">,
) {
  return {
    title: `${home.address}, ${home.town}, SC · Sold`,
    alternates: { canonical: `/recently-placed/${home.slug}` },
  };
}
