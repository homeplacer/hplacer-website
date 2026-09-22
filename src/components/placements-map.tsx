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

type GoogleMap = { fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void };
type GoogleMarker = { setMap: (map: GoogleMap | null) => void };
type GoogleLatLngBounds = { extend: (point: { lat: number; lng: number }) => void };
type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Marker: new (options: { position: { lat: number; lng: number }; map: GoogleMap; title: string }) => GoogleMarker;
  InfoWindow: new (options: { content: HTMLElement }) => { open: (map: GoogleMap, marker: GoogleMarker) => void };
  LatLngBounds: new () => GoogleLatLngBounds;
  event: { clearInstanceListeners: (instance: GoogleMap) => void };
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsApi };
  }
}

const googleScriptId = "home-placer-google-maps";

function googleMaps() {
  return window.google?.maps;
}

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  const ready = googleMaps();
  if (ready) return Promise.resolve(ready);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(googleScriptId) as HTMLScriptElement | null;
    const finish = () => {
      const api = googleMaps();
      if (api) resolve(api);
      else reject(new Error("Google Maps JavaScript API did not load."));
    };

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps script failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = googleScriptId;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps script failed to load.")), { once: true });
    document.head.appendChild(script);
  });
}

function popupContent(point: Placement) {
  const content = document.createElement("div");
  content.style.maxWidth = "220px";

  if (point.photo) {
    const link = document.createElement("a");
    link.href = point.photo;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const image = document.createElement("img");
    image.src = point.photo;
    image.alt = point.address;
    image.style.cssText = "width:100%;height:auto;border-radius:6px;display:block;margin-bottom:6px";
    link.appendChild(image);
    content.appendChild(link);
  }

  const address = document.createElement("strong");
  address.textContent = point.address;
  content.appendChild(address);
  content.appendChild(document.createElement("br"));
  const details = document.createElement("span");
  details.textContent = `${point.model ? `${point.model} · ` : ""}${point.city}, SC · $${point.price.toLocaleString("en-US")}`;
  content.appendChild(details);
  return content;
}

// Interactive map of every Home Placer project. Google Maps is used whenever a
// restricted browser key is configured. The Leaflet fallback keeps the real map
// available during local development and if a Maps configuration is unavailable.
export function PlacementsMap({ points, apiKey }: { points: Placement[]; apiKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletMap | null = null;
    let googleMap: GoogleMap | null = null;
    const markers: GoogleMarker[] = [];
    let cancelled = false;

    const fitCoreBounds = (bounds: [number, number][]) => {
      const sLat = points.map((p) => p.lat).sort((a, b) => a - b);
      const sLon = points.map((p) => p.lon).sort((a, b) => a - b);
      const mLat = sLat[Math.floor(sLat.length / 2)];
      const mLon = sLon[Math.floor(sLon.length / 2)];
      return bounds.filter(([lat, lon]) => Math.abs(lat - mLat) < 0.5 && Math.abs(lon - mLon) < 0.5);
    };

    (async () => {
      try {
        if (apiKey && ref.current) {
          const maps = await loadGoogleMaps(apiKey);
          if (cancelled || !ref.current) return;
          const activeMap = new maps.Map(ref.current, {
            center: { lat: 33.84, lng: -78.95 },
            zoom: 9,
            gestureHandling: "cooperative",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          googleMap = activeMap;
          const bounds = new maps.LatLngBounds();
          const core = fitCoreBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
          const coreBounds = new maps.LatLngBounds();

          points.forEach((point) => {
            const marker = new maps.Marker({
              position: { lat: point.lat, lng: point.lon },
              map: activeMap,
              title: point.address,
            });
            const popup = new maps.InfoWindow({ content: popupContent(point) });
            marker.setMap(activeMap);
            markers.push(marker);
            // Google Maps events are attached through the instance, which avoids
            // constructing HTML from listing data and keeps popups safe.
            (marker as GoogleMarker & { addListener?: (event: string, handler: () => void) => void }).addListener?.("click", () => popup.open(activeMap, marker));
            bounds.extend({ lat: point.lat, lng: point.lon });
            if (core.some(([lat, lon]) => lat === point.lat && lon === point.lon)) coreBounds.extend({ lat: point.lat, lng: point.lon });
          });
          if (points.length) activeMap.fitBounds(core.length ? coreBounds : bounds, 30);
          return;
        }

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
        const core = fitCoreBounds(bounds);
        if (bounds.length) activeMap.fitBounds(core.length ? core : bounds, { padding: [30, 30] });
      } catch {
        // A configured Google Maps key can fail due to an expired restriction or
        // temporary network issue. Fall back to the existing reliable map rather
        // than leaving buyers with an empty section.
        if (apiKey && !cancelled) {
          try {
            const L = await import("leaflet");
            if (!ref.current) return;
            const activeMap = L.map(ref.current, { scrollWheelZoom: false });
            map = activeMap;
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
              attribution: "&copy; OpenStreetMap contributors",
              maxZoom: 18,
            }).addTo(activeMap);
            const bounds: [number, number][] = [];
            points.forEach((point) => {
              L.circleMarker([point.lat, point.lon], { radius: 7, color: "#ffffff", weight: 2, fillColor: "#db2777", fillOpacity: 0.95 }).addTo(activeMap);
              bounds.push([point.lat, point.lon]);
            });
            if (bounds.length) activeMap.fitBounds(fitCoreBounds(bounds), { padding: [30, 30] });
          } catch {
            /* map libraries failed to load — leave the placeholder */
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      markers.forEach((marker) => marker.setMap(null));
      if (googleMap) googleMaps()?.event.clearInstanceListeners(googleMap);
    };
  }, [apiKey, points]);

  return <div ref={ref} className="h-[480px] w-full rounded-card border border-stone-line bg-stone-bg" />;
}
