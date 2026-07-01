import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";
import { getAllHomes } from "@/lib/homes";
import { getAllPosts } from "@/lib/blog";
import { locations } from "@/lib/locations";
import { getAllPlacedHomes } from "@/lib/placed-homes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const lastModified = new Date("2026-06-21");

  const placedHomes = getAllPlacedHomes();
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
    lastModified,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
    ...(p === "/recently-placed" ? { images: placedCardImages } : {}),
  }));

  // Each placed home gets its own page, with all its real geotagged photos
  // declared so Google image-search can discover them on the right URL.
  const placedHomeEntries: MetadataRoute.Sitemap = placedHomes.map((h) => ({
    url: `${base}/recently-placed/${h.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
    ...(h.photos.length ? { images: h.photos.map((p) => `${base}${p}`) } : {}),
  }));

  const locationEntries: MetadataRoute.Sitemap = locations.map((l) => ({
    url: `${base}/locations/${l.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const homeEntries: MetadataRoute.Sitemap = getAllHomes().map((h) => ({
    url: `${base}/homes/${h.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const postEntries: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(`${p.date}T00:00:00`),
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...staticEntries, ...placedHomeEntries, ...locationEntries, ...homeEntries, ...postEntries];
}
