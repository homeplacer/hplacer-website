"use client";

import { useEffect, useRef, useState } from "react";

export function ModelVirtualTour({ url, name }: { url: string; name: string }) {
  const [started, setStarted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (started) iframeRef.current?.focus();
  }, [started]);
  return (
    <div className="mt-5">
      <div className="aspect-video overflow-hidden rounded-card border border-stone-line bg-stone-sunken">
        {started ? (
          <iframe
            ref={iframeRef}
            tabIndex={0}
            src={url}
            title={`${name} 3D virtual tour`}
            allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
            allowFullScreen
            className="size-full"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center sm:p-6">
            <p className="max-w-md text-sm text-stone-muted">
              Start the interactive tour when you are ready. Photos and floor
              plans remain available on this page.
            </p>
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              Start {name} virtual tour
            </button>
          </div>
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline underline-offset-4"
      >
        Open tour in a new tab
      </a>
    </div>
  );
}
