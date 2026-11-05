import assets from "./sold-example-assets.json";
import { asset } from "./asset";

const localPhotos: Record<string, { width: number; height: number; widths: number[] }> = assets;

// Only committed, dimension-verified local files receive width descriptors.
export function soldExamplePhoto(src: string) {
  if (!Object.hasOwn(localPhotos, src)) return undefined;
  const photo = localPhotos[src];
  return {
    width: photo.width,
    height: photo.height,
    srcSet: photo.widths.map((width) =>
      `${asset(`${src.slice(0, -4)}-sold-${width}.webp`)} ${width}w`).join(", "),
  };
}

// 76rem shell, responsive padding, gap-6, three columns from sm, and the
// card's two 1px borders. Below sm the original single-column layout remains.
export const soldExampleImageSizes =
  "(min-width: 76rem) 22.875rem, (min-width: 48rem) calc((100vw - 7rem) / 3 - 2px), (min-width: 40rem) calc((100vw - 5.5rem) / 3 - 2px), calc(100vw - 2.625rem)";
