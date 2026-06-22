import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getAllHomes } from "@/lib/homes";
import { getAllPosts } from "@/lib/blog";
import { locations } from "@/lib/locations";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const lastModified = new Date("2026-06-21");

  const staticPaths = [
    "",
    "/homes",
    "/brands",
    "/land-packages",
    "/gallery",
    "/financing",
    "/process",
    "/faq",
    "/glossary",
    "/manufactured-vs-site-built",
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

  return [...staticEntries, ...locationEntries, ...homeEntries, ...postEntries];
}
