import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";
import { getAllHomes } from "@/lib/homes";
import { getAllPosts } from "@/lib/blog";
import { locations } from "@/lib/locations";
import { getAllPlacedHomes } from "@/lib/placed-homes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;

  const placedHomes = getAllPlacedHomes();
  const posts = getAllPosts();
  const homes = getAllHomes();

  // Parse an ISO yyyy-mm-dd to a Date (UTC midnight); null/blank/invalid → null.
  const isoDate = (s?: string | null): Date | null => {
    if (!s) return null;
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // "Site last updated" for pages that don't carry their own content date
  // (static pages, locations, model pages). Derived from the freshest real
  // content date on the site — newest published blog post or most recent
  // placed-home closing — so it advances automatically as content ships, instead
  // of a hardcoded date that silently goes stale. The baseline floor keeps it
  // sane if both sets are ever empty.
  const contentDates = [
    new Date("2026-06-21"),
    ...posts.map((p) => isoDate(p.date)),
    ...placedHomes.map((h) => isoDate(h.closeDate)),
  ].filter((d): d is Date => d != null);
  const siteUpdated = new Date(Math.max(...contentDates.map((d) => d.getTime())));

  // The /recently-placed index shows one card photo per home.
  const placedCardImages = placedHomes.map((h) => `${base}${h.photo}`);

  const staticPaths = [
    "",
    "/homes",
    "/brands",
    "/land-packages",
    "/gallery",
    "/recently-placed",
    "/financing",
    "/process",
    "/warranty",
    "/faq",
    "/glossary",
    "/manufactured-vs-site-built",
    "/modular-vs-manufactured-homes",
    "/mobile-home-vs-manufactured-home",
    "/manufactured-home-drywall-vs-wall-strips",
    "/locations",
    "/blog",
    "/about",
    "/team",
    "/contact",
    "/service-request",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${base}${p}`,
    lastModified: siteUpdated,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
    ...(p === "/recently-placed" ? { images: placedCardImages } : {}),
  }));

  // Each placed home gets its own page, with all its real geotagged photos
  // declared so Google image-search can discover them on the right URL. Its
  // lastModified is the real Paragon closing date when we have it.
  const placedHomeEntries: MetadataRoute.Sitemap = placedHomes.map((h) => ({
    url: `${base}/recently-placed/${h.slug}`,
    lastModified: isoDate(h.closeDate) ?? siteUpdated,
    changeFrequency: "monthly",
    priority: 0.6,
    ...(h.photos.length ? { images: h.photos.map((p) => `${base}${p}`) } : {}),
  }));

  const locationEntries: MetadataRoute.Sitemap = locations.map((l) => ({
    url: `${base}/locations/${l.slug}`,
    lastModified: siteUpdated,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const homeEntries: MetadataRoute.Sitemap = homes.map((h) => ({
    url: `${base}/homes/${h.slug}`,
    lastModified: siteUpdated,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: isoDate(p.date) ?? siteUpdated,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...staticEntries, ...placedHomeEntries, ...locationEntries, ...homeEntries, ...postEntries];
}
