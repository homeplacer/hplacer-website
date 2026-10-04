"use client";

import { useEffect, useRef } from "react";
import { FallbackImage } from "@/components/fallback-image";
import { HomeMark } from "@/components/icons";
import { modelGallerySrcSet } from "@/lib/model-gallery-images";

// Rendered only after a visitor expands a photo. Original JPEGs remain available
// at full resolution; the filmstrip uses the same compact photo derivatives.
export function HomeGalleryLightbox({
  images,
  name,
  active,
  onSelect,
  onNext,
  onPrevious,
}: {
  images: string[];
  name: string;
  active: number;
  onSelect: (index: number) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const stripRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    stripRefs.current[active]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [active]);
  return (
    <>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-6 sm:px-16"
        onTouchStart={(event) => {
          touchX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          if (touchX.current != null) {
            const delta = event.changedTouches[0].clientX - touchX.current;
            if (Math.abs(delta) > 40) {
              if (delta < 0) onNext();
              else onPrevious();
            }
          }
          touchX.current = null;
        }}
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 sm:left-4"
          >
            <ChevronIcon className="size-6 rotate-180" />
          </button>
        )}
        <FallbackImage
          key={images[active]}
          src={images[active]}
          alt={`${name} — photo ${active + 1}`}
          width={1600}
          height={1200}
          decoding="async"
          responsiveWidths={[960, 1280, 1600, 1920]}
          sizes="100vw"
          className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
          draggable={false}
          fallback={
            <div className="grid place-items-center p-12 text-white/40">
              <HomeMark className="size-24" strokeWidth={1} />
            </div>
          }
        />
        {images.length > 1 && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 sm:right-4"
          >
            <ChevronIcon className="size-6" />
          </button>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex shrink-0 justify-start gap-2 overflow-x-auto px-4 pb-5 sm:px-6">
          {images.map((src, index) => (
            <button
              key={src}
              ref={(element) => {
                stripRefs.current[index] = element;
              }}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Go to photo ${index + 1}`}
              aria-pressed={index === active}
              className={
                "size-14 shrink-0 overflow-hidden rounded-md transition " +
                (index === active
                  ? "ring-2 ring-white"
                  : "opacity-50 hover:opacity-90")
              }
            >
              <FallbackImage
                src={src}
                alt=""
                width={112}
                height={112}
                loading="lazy"
                decoding="async"
                srcSet={modelGallerySrcSet(src, "thumbnail")}
                responsiveWidths={[56, 112]}
                sizes="56px"
                className="size-full object-cover"
                fallback={
                  <div className="grid size-full place-items-center bg-stone-surface text-brand-300/60">
                    <HomeMark className="size-6" strokeWidth={1.25} />
                  </div>
                }
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
