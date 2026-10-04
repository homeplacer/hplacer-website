"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HomeMark } from "@/components/icons";
import { FallbackImage } from "@/components/fallback-image";
import { HomeGalleryLightbox } from "@/components/home-gallery-lightbox";
import {
  modelGalleryHeroSizes,
  modelGallerySrcSet,
  modelGalleryThumbnailSizes,
} from "@/lib/model-gallery-images";

// Keep one compact row on desktop; the on-demand filmstrip retains every photo.
const MAX_THUMBS = 6;
const HERO_FALLBACK = (
  <div className="grid size-full place-items-center text-brand-300/70">
    <HomeMark className="size-24" strokeWidth={1} />
  </div>
);
const TILE_FALLBACK = (
  <div className="grid size-full place-items-center bg-stone-surface text-brand-300/60">
    <HomeMark className="size-6" strokeWidth={1.25} />
  </div>
);

export function HomeGallery({
  images,
  name,
  brand,
}: {
  images: string[];
  name: string;
  brand: string;
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const mainBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const count = images.length;
  const go = useCallback(
    (direction: number) =>
      setActive((index) => (count ? (index + direction + count) % count : 0)),
    [count],
  );
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = lastTriggerRef.current ?? mainBtnRef.current;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeBtnRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  function openAt(index: number) {
    lastTriggerRef.current = document.activeElement as HTMLElement | null;
    setActive(index);
    setOpen(true);
  }

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-gradient-to-br from-brand-100 via-stone-surface to-accent-100">
        {images[0] ? (
          <button
            ref={mainBtnRef}
            type="button"
            onClick={() => openAt(active)}
            aria-label={`Expand photo ${active + 1} of ${count}`}
            className="group absolute inset-0 cursor-zoom-in"
          >
            <FallbackImage
              key={images[active]}
              src={images[active]}
              alt={`${name} — photo ${active + 1}`}
              width={1200}
              height={900}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              srcSet={modelGallerySrcSet(images[active], "hero")}
              responsiveWidths={[640, 960, 1200, 1600]}
              sizes={modelGalleryHeroSizes}
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
              fallback={HERO_FALLBACK}
            />
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-stone-ink/65 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              <ExpandIcon className="size-3.5" /> Expand
            </span>
          </button>
        ) : (
          HERO_FALLBACK
        )}
        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-stone-bg/90 px-3 py-1 text-sm font-semibold text-brand-800 shadow-sm">
          {brand}
        </span>
      </div>
      {count > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2.5 sm:grid-cols-6">
          {(count > MAX_THUMBS ? images.slice(0, MAX_THUMBS - 1) : images).map(
            (src, index) => (
              <button
                key={src}
                type="button"
                onClick={() =>
                  index === active ? openAt(index) : setActive(index)
                }
                aria-label={
                  index === active
                    ? `Expand photo ${index + 1}`
                    : `View photo ${index + 1}`
                }
                aria-pressed={index === active}
                className={
                  "group relative aspect-square w-full overflow-hidden rounded-lg transition " +
                  (index === active
                    ? "ring-2 ring-brand-600 ring-offset-1 ring-offset-stone-bg"
                    : "opacity-80 ring-1 ring-stone-line hover:opacity-100 hover:ring-brand-300")
                }
              >
                <FallbackImage
                  src={src}
                  alt={`${name} thumbnail ${index + 1}`}
                  width={240}
                  height={240}
                  loading="lazy"
                  decoding="async"
                  srcSet={modelGallerySrcSet(src, "thumbnail")}
                  responsiveWidths={[96, 160, 240]}
                  sizes={modelGalleryThumbnailSizes}
                  className="size-full object-cover"
                  fallback={TILE_FALLBACK}
                />
                {index === active && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center bg-stone-ink/25 opacity-0 transition group-hover:opacity-100">
                    <ExpandIcon className="size-4 text-white" />
                  </span>
                )}
              </button>
            ),
          )}
          {count > MAX_THUMBS && (
            <button
              type="button"
              onClick={() => openAt(MAX_THUMBS - 1)}
              aria-label={`See all ${count} photos`}
              className="relative aspect-square w-full overflow-hidden rounded-lg ring-1 ring-stone-line transition hover:ring-brand-300"
            >
              <FallbackImage
                src={images[MAX_THUMBS - 1]}
                alt=""
                width={240}
                height={240}
                loading="lazy"
                decoding="async"
                srcSet={modelGallerySrcSet(images[MAX_THUMBS - 1], "thumbnail")}
                responsiveWidths={[96, 160, 240]}
                sizes={modelGalleryThumbnailSizes}
                className="size-full object-cover"
                fallback={TILE_FALLBACK}
              />
              <span className="absolute inset-0 grid place-items-center bg-stone-ink/65 text-sm font-semibold text-white">
                +{count - (MAX_THUMBS - 1)}
              </span>
            </button>
          )}
        </div>
      )}
      {count > 0 && (
        <noscript>
          <p>Open full-size photos:</p>
          <ul>
            {images.map((src, index) => (
              <li key={index}>
                <a href={src} target="_blank" rel="noopener noreferrer">
                  {name} — photo {index + 1}
                </a>
              </li>
            ))}
          </ul>
        </noscript>
      )}
      {open && (
        <dialog
          ref={dialogRef}
          aria-label={`${name} photos`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClose={close}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              go(event.key === "ArrowRight" ? 1 : -1);
            } else if (event.key === "Tab") {
              const buttons =
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not([disabled])",
                );
              const first = buttons[0];
              const last = buttons[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
          className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col border-0 bg-stone-ink/95 p-0 text-white open:flex backdrop:bg-stone-ink/95"
        >
          <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
            <span className="text-sm font-medium tabular-nums text-white/80">
              {active + 1} / {count}
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={close}
              aria-label="Close photos"
              className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          <HomeGalleryLightbox
            images={images}
            name={name}
            active={active}
            onSelect={setActive}
            onNext={() => go(1)}
            onPrevious={() => go(-1)}
          />
        </dialog>
      )}
    </div>
  );
}

function ExpandIcon({ className }: { className?: string }) {
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
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
