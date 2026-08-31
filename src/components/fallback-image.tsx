"use client";

import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

function responsiveVariant(src: string, width: number): string | null {
  try {
    const url = new URL(src);
    if (url.hostname === "api.claytonhomes.com") {
      url.searchParams.set("width", String(width));
      return url.toString();
    }
    if (url.hostname === "res.cloudinary.com") {
      // The current Champion fetch URLs are signed; changing a transformation
      // invalidates that signature. Only synthesize variants for unsigned URLs.
      if (/\/s--[^/]+--\//.test(url.pathname)) return null;
      const widthMatch = url.pathname.match(/\bw_(\d+)\b/);
      if (!widthMatch) return null;
      const originalWidth = Number(widthMatch[1]);
      url.pathname = url.pathname.replace(/\bw_\d+\b/, `w_${width}`);
      const heightMatch = url.pathname.match(/\bh_(\d+)\b/);
      if (heightMatch && originalWidth > 0) {
        const scaledHeight = Math.max(1, Math.round(Number(heightMatch[1]) * width / originalWidth));
        url.pathname = url.pathname.replace(/\bh_\d+\b/, `h_${scaledHeight}`);
      }
      return url.toString();
    }
  } catch {
    // Local paths and malformed URLs simply use their original source.
  }
  return null;
}

function responsiveSrcSet(src: string | undefined, widths: number[] | undefined): string | undefined {
  if (!src || !widths?.length) return undefined;
  const candidates = [...new Set(widths)]
    .filter((width) => Number.isInteger(width) && width > 0)
    .sort((a, b) => a - b)
    .map((width) => {
      const variant = responsiveVariant(src, width);
      return variant ? `${variant} ${width}w` : null;
    })
    .filter((candidate): candidate is string => candidate != null);
  return candidates.length ? candidates.join(", ") : undefined;
}

// A hotlinked <img> with a graceful fallback. Home photos are served from ~20
// third-party manufacturer CDNs we don't control, so a 404 / CDN outage on a
// populated URL would otherwise render the browser's broken-image icon. On error
// we swap in `fallback` — the same house-mark placeholder used when a home has no
// photo at all — so a dead image degrades to the empty-state look instead.
//
// When the `src` can change in place (e.g. a gallery's active image), pass a
// `key={src}` at the call site so React remounts and the error state resets for
// the new image.
export function FallbackImage({
  src,
  fallback,
  responsiveWidths,
  srcSet,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fallback: ReactNode; responsiveWidths?: number[] }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // `alt` (and the rest) come from the caller via {...props}; every call site
    // passes one. eslint can't see that statically, so silence both img rules.
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      src={src}
      srcSet={srcSet ?? responsiveSrcSet(typeof src === "string" ? src : undefined, responsiveWidths)}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
