"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HomeMark } from "@/components/icons";
import { FallbackImage } from "@/components/fallback-image";

// Max thumbnails shown inline under the main image; the rest live behind a
// "+N" tile that opens the lightbox (whose filmstrip browses every photo).
const MAX_THUMBS = 12;

// Fallbacks for hotlinked manufacturer photos that 404 — reuse the house-mark
// placeholder look so a dead CDN image degrades to the empty state, not a broken
// icon. The container behind supplies the gradient (same as the no-photo case).
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
const STAGE_FALLBACK = (
  <div className="grid place-items-center p-12 text-white/40">
    <HomeMark className="size-24" strokeWidth={1} />
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const stripRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchX = useRef<number | null>(null);

  const count = images.length;
  const hero = images[0];

  const go = useCallback(
    (dir: number) => setActive((i) => (count ? (i + dir + count) % count : 0)),
    [count],
  );

  const close = useCallback(() => {
    setOpen(false);
    (lastTriggerRef.current ?? mainBtnRef.current)?.focus();
  }, []);

  // Keyboard + scroll-lock while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        // Trap focus inside the modal lightbox (it declares aria-modal).
        const root = dialogRef.current;
        if (!root) return;
        const f = root.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, go, close]);

  // Keep the active thumbnail centered in the lightbox filmstrip.
  useEffect(() => {
    if (!open) return;
    stripRefs.current[active]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active, open]);

  function openAt(i: number) {
    lastTriggerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    setActive(i);
    setOpen(true);
  }
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  }

  return (
    <div>
      {/* Main image */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-gradient-to-br from-brand-100 via-stone-surface to-accent-100">
        {hero ? (
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
              fetchPriority="high"
              decoding="async"
              responsiveWidths={[640, 960, 1200, 1600]}
              sizes="(max-width: 1023px) calc(100vw - 2.5rem), 55vw"
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
              fallback={HERO_FALLBACK}
            />
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-stone-ink/65 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              <ExpandIcon className="size-3.5" /> Expand
            </span>
          </button>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-brand-300/70">
            <HomeMark className="size-24" strokeWidth={1} />
          </div>
        )}
        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-stone-bg/90 px-3 py-1 text-sm font-semibold text-brand-800 shadow-sm">
          {brand}
        </span>
      </div>

      {/* Thumbnails — cap the inline grid; the lightbox filmstrip browses them all. */}
      {count > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2.5 sm:grid-cols-6">
          {(count > MAX_THUMBS ? images.slice(0, MAX_THUMBS - 1) : images).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => (i === active ? openAt(i) : setActive(i))}
              aria-label={i === active ? `Expand photo ${i + 1}` : `View photo ${i + 1}`}
              aria-pressed={i === active}
              className={
                "group relative aspect-square w-full overflow-hidden rounded-lg transition " +
                (i === active
                  ? "ring-2 ring-brand-600 ring-offset-1 ring-offset-stone-bg"
                  : "opacity-80 ring-1 ring-stone-line hover:opacity-100 hover:ring-brand-300")
              }
            >
              <FallbackImage
                src={src}
                alt={`${name} thumbnail ${i + 1}`}
                width={240}
                height={240}
                loading="lazy"
                decoding="async"
                responsiveWidths={[96, 160, 240]}
                sizes="(max-width: 639px) 25vw, 160px"
                className="size-full object-cover"
                fallback={TILE_FALLBACK}
              />
              {i === active && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center bg-stone-ink/25 opacity-0 transition group-hover:opacity-100">
                  <ExpandIcon className="size-4 text-white" />
                </span>
              )}
            </button>
          ))}
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
                responsiveWidths={[96, 160, 240]}
                sizes="(max-width: 639px) 25vw, 160px"
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

      {/* Lightbox */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${name} photos`}
            className="fixed inset-0 z-[100] flex flex-col bg-stone-ink/92 backdrop-blur-sm"
            onClick={close}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
              <span className="text-sm font-medium tabular-nums text-white/80">
                {active + 1} / {count}
              </span>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            {/* Stage */}
            <div
              className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6 sm:px-16"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {count > 1 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
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
                fallback={STAGE_FALLBACK}
              />

              {count > 1 && (
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
                >
                  <ChevronIcon className="size-6" />
                </button>
              )}
            </div>

            {/* Filmstrip */}
            {count > 1 && (
              <div
                className="flex justify-start gap-2 overflow-x-auto px-4 pb-5 sm:justify-center sm:px-6"
                onClick={(e) => e.stopPropagation()}
              >
                {images.map((src, i) => (
                  <button
                    key={i}
                    ref={(el) => {
                      stripRefs.current[i] = el;
                    }}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Go to photo ${i + 1}`}
                    aria-pressed={i === active}
                    className={
                      "size-14 shrink-0 overflow-hidden rounded-md transition " +
                      (i === active ? "ring-2 ring-white" : "opacity-50 hover:opacity-90")
                    }
                  >
                    <FallbackImage
                      src={src}
                      alt=""
                      width={112}
                      height={112}
                      loading="lazy"
                      decoding="async"
                      responsiveWidths={[56, 112]}
                      sizes="56px"
                      className="size-full object-cover"
                      fallback={TILE_FALLBACK}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
