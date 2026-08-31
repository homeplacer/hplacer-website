"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

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
// Leaflet is bundled with the app; only the OpenStreetMap image tiles are fetched
// from a third party at runtime (no API key or map-vendor script dependency).
export function PlacementsMap({ points }: { points: Placement[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;

    (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !ref.current) return;

        const activeMap = L.map(ref.current, { scrollWheelZoom: false });
        map = activeMap;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(activeMap);

        const bounds: [number, number][] = [];
        points.forEach((p) => {
          const marker = L.circleMarker([p.lat, p.lon], {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor: "#db2777",
            fillOpacity: 0.95,
          }).addTo(activeMap);
          // Escape popup values before building innerHTML — data is internal
          // today, but never inject unescaped strings into a DOM string.
          const esc = (s: string) =>
            s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
          const photoHtml = p.photo
            ? `<a href="${esc(p.photo)}" target="_blank" rel="noopener noreferrer"><img src="${esc(p.photo)}" alt="${esc(p.address)}" style="width:100%;max-width:220px;height:auto;border-radius:6px;display:block;margin-bottom:6px" /></a>`
            : "";
          marker.bindPopup(
            `${photoHtml}<strong>${esc(p.address)}</strong><br>${p.model ? esc(p.model) + " &middot; " : ""}${esc(p.city)}, SC &middot; $${p.price.toLocaleString("en-US")}`,
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
        if (bounds.length) activeMap.fitBounds(core.length ? core : bounds, { padding: [30, 30] });
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
