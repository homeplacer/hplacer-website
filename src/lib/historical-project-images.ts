import assets from "./historical-project-assets.json";
import { asset } from "./asset";

const localPhotos: Record<string, { width: number; height: number; widths: number[] }> = assets;

// Reuse the established sold-photo encoder and only advertise committed files.
export function historicalProjectPhoto(src: string) {
  if (!Object.hasOwn(localPhotos, src)) return undefined;
  const photo = localPhotos[src];
  return {
    width: photo.width,
    height: photo.height,
    srcSet: photo.widths.map((width) =>
      `${asset(`${src.slice(0, -4)}-sold-${width}.webp`)} ${width}w`).join(", "),
  };
}

// gap-4, one/two/three columns, within the 76rem container's 20px/32px padding.
export const relatedProjectImageSizes =
  "(min-width: 76rem) 23.208333rem, (min-width: 64rem) calc((100vw - 6rem) / 3 - 2px), (min-width: 48rem) calc((100vw - 5rem) / 2 - 2px), (min-width: 40rem) calc((100vw - 3.5rem) / 2 - 2px), calc(100vw - 2.625rem)";

// Same grid inside a border and p-6 panel: subtract another 50px from the shell.
export const insetProjectImageSizes =
  "(min-width: 76rem) 22.166667rem, (min-width: 64rem) calc((100vw - 9.125rem) / 3 - 2px), (min-width: 48rem) calc((100vw - 8.125rem) / 2 - 2px), (min-width: 40rem) calc((100vw - 6.625rem) / 2 - 2px), calc(100vw - 5.75rem)";
