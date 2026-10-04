import galleryAssets from "./model-gallery-assets.json";

// Current local galleries have committed, photo-preserving WebP derivatives.
// Keep the source JPEG as the fallback and full-resolution lightbox image.
// Unknown/new files never receive an invented derivative URL.
const localPhotos: Record<string, number[]> = galleryAssets;

export function modelGallerySrcSet(
  src: string,
  usage: "hero" | "thumbnail",
): string | undefined {
  if (!Object.hasOwn(localPhotos, src)) return undefined;
  const stem = src.slice(0, -4);
  const widths = localPhotos[src].filter((width) =>
    usage === "hero" ? width >= 640 : width <= 320,
  );
  if (!widths.length) return undefined;
  return widths
    .map((width) => `${stem}-gallery-${width}.webp ${width}w`)
    .join(", ");
}

// Match the actual 76rem shell, its padding, and the two-column gallery grid.
export const modelGalleryHeroSizes =
  "(min-width: 1216px) 556px, (min-width: 1024px) calc((100vw - 6.5rem) / 2), (min-width: 768px) calc(100vw - 4rem), calc(100vw - 2.5rem)";
export const modelGalleryThumbnailSizes =
  "(max-width: 639px) calc((100vw - 4.375rem) / 4), (max-width: 767px) calc((100vw - 5.625rem) / 6), (max-width: 1023px) calc((100vw - 7.125rem) / 6), 85px";
