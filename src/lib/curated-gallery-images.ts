import galleryAssets from "./curated-gallery-assets.json";
import { asset } from "./asset";

// Only the encoder's verified local files get width descriptors. Keep existing
// full-size WebPs as the largest candidates and unknown photos on their fallback.
const localPhotos: Record<string, { width: number; widths: number[] }> = galleryAssets;

export function curatedGallerySrcSet(src: string): string | undefined {
  if (!Object.hasOwn(localPhotos, src)) return undefined;
  const { width, widths } = localPhotos[src];
  const stem = src.slice(0, -4);
  return [
    ...widths.map((candidate) => `${asset(`${stem}-responsive-${candidate}.webp`)} ${candidate}w`),
    `${asset(`${stem}.webp`)} ${width}w`,
  ].join(", ");
}

// Match the 76rem shell, 1.25rem/2rem padding and actual gap-4 grid/columns.
export const homepageWorkImageSizes =
  "(min-width: 76rem) 23.333333rem, (min-width: 48rem) calc((100vw - 6rem) / 3), (min-width: 40rem) calc((100vw - 4.5rem) / 3), calc((100vw - 3.5rem) / 2)";
export const galleryMasonryImageSizes =
  "(min-width: 76rem) 23.333333rem, (min-width: 64rem) calc((100vw - 6rem) / 3), (min-width: 48rem) calc((100vw - 5rem) / 2), (min-width: 40rem) calc((100vw - 3.5rem) / 2), calc(100vw - 2.5rem)";
