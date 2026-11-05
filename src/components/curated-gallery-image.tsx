import type { GalleryItem } from "@/lib/gallery";

// Server-rendered native responsive selection; no client/runtime image service.
export function CuratedGalleryImage({
  image,
  sizes,
  className,
  pictureClassName,
}: {
  image: GalleryItem;
  sizes: string;
  className: string;
  pictureClassName?: string;
}) {
  return (
    <picture className={pictureClassName}>
      <source type="image/webp" srcSet={image.webpSrcSet ?? image.webpSrc}
        sizes={image.webpSrcSet ? sizes : undefined} />
      {/* The original JPEG, alt text, geometry and lazy behavior remain intact. */}
      <img src={image.src} alt={image.alt} width={image.width} height={image.height}
        loading="lazy" className={className} />
    </picture>
  );
}
