"use client";

import { useEffect, useRef } from "react";

export type Placement = {
  lat: number;
  lon: number;
  address: string;
  model: string;
  price: number;
  city: string;
  photo?: string | null;
};

// Interactive map of every home Home Placer has placed, plotted as dots.
// Loads Leaflet + OpenStreetMap tiles client-side (no API key, no map-vendor cost).
export function PlacementsMap({ points }: { points: Placement[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    const ensure = (tag: "link" | "script", attrs: Record<string, string>) =>
      new Promise<void>((resolve, reject) => {
        const sel =
          tag === "link" ? `link[href="${attrs.href}"]` : `script[src="${attrs.src}"]`;
        if (document.querySelector(sel)) return resolve();
        const el = document.createElement(tag);
        Object.assign(el, attrs);
        el.addEventListener("load", () => resolve());
        el.addEventListener("error", reject);
        (tag === "link" ? document.head : document.body).appendChild(el);
      });

    (async () => {
      try {
        await ensure("link", {
          rel: "stylesheet",
          href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(window as any).L) {
          await ensure("script", { src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" });
        }
        if (cancelled || !ref.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as any).L;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((ref.current as any)._leaflet_id) return;

        map = L.map(ref.current, { scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);

        const bounds: [number, number][] = [];
        points.forEach((p) => {
          const marker = L.circleMarker([p.lat, p.lon], {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor: "#db2777",
            fillOpacity: 0.95,
          }).addTo(map);
          const photoHtml = p.photo
            ? `<a href="${p.photo}" target="_blank" rel="noopener"><img src="${p.photo}" alt="${p.address}" style="width:100%;max-width:220px;height:auto;border-radius:6px;display:block;margin-bottom:6px" /></a>`
            : "";
          marker.bindPopup(
            `${photoHtml}<strong>${p.address}</strong><br>${p.model ? p.model + " &middot; " : ""}${p.city}, SC &middot; $${p.price.toLocaleString("en-US")}`,
            p.photo ? { minWidth: 220 } : undefined,
          );
          bounds.push([p.lat, p.lon]);
        });
        // Fit the opening view to the dense cluster so a lone outlier (e.g. Sumter, ~80mi
        // west) doesn't zoom the whole map out to the state. Outliers stay plotted, just
        // off the default view — a zoom-out reveals them.
        const sLat = points.map((p) => p.lat).sort((a, b) => a - b);
        const sLon = points.map((p) => p.lon).sort((a, b) => a - b);
        const mLat = sLat[Math.floor(sLat.length / 2)];
        const mLon = sLon[Math.floor(sLon.length / 2)];
        const core = bounds.filter(([la, lo]) => Math.abs(la - mLat) < 0.5 && Math.abs(lo - mLon) < 0.5);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (bounds.length) (map as any).fitBounds(core.length ? core : bounds, { padding: [30, 30] });
      } catch {
        /* tiles/library failed to load — leave the placeholder */
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [points]);

  return <div ref={ref} className="h-[480px] w-full rounded-card border border-stone-line bg-stone-bg" />;
}
