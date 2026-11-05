"use client";

import { useEffect, useRef, useState } from "react";
import { mlsPhotoSrcSet } from "@/lib/mls-photo";

export function MlsPackagePhoto({ listingKey, photoUrl, alt, className, sizes, loading }: {
  listingKey: string; photoUrl: string; alt: string; className: string; sizes: string; loading?: "lazy" | "eager";
}) {
  const [failedSource, setFailedSource] = useState<string>();
  const imageRef = useRef<HTMLImageElement>(null);
  const srcSet = failedSource === photoUrl ? undefined : mlsPhotoSrcSet(listingKey, photoUrl);
  useEffect(() => {
    // A failed candidate may finish before React attaches onError during hydration.
    const image = imageRef.current;
    if (srcSet && image?.complete && image.naturalWidth === 0) setFailedSource(photoUrl);
  }, [photoUrl, srcSet]);
  return (
    <>
      <noscript>
        <style>{".mls-js-photo{display:none!important}"}</style>
        {/* No JavaScript means no error handler: use the original directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={alt} className={className} loading={loading} decoding="async" />
      </noscript>
      {/* The authentic upstream src is also the fallback. Errors drop ALL candidates. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imageRef} src={photoUrl} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} className={`mls-js-photo ${className}`}
        loading={loading} decoding="async" onError={() => { if (srcSet) setFailedSource(photoUrl); }} />
    </>
  );
}
