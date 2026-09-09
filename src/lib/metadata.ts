import type { Metadata } from "next";
import { site } from "./site";

export function pageMetadata(meta: Metadata): Metadata {
  const title = typeof meta.title === "string" ? meta.title : site.name;
  const description = meta.description || site.blurb;
  const url = String(meta.alternates?.canonical || "/");
  return { ...meta, openGraph: { type: "website", siteName: site.name, locale: "en_US", title, description, url, ...meta.openGraph }, twitter: { card: "summary_large_image", title, description, ...meta.twitter } };
}
