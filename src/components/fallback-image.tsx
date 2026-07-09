"use client";

import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

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
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // `alt` (and the rest) come from the caller via {...props}; every call site
    // passes one. eslint can't see that statically, so silence both img rules.
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} onError={() => setFailed(true)} {...props} />
  );
}
