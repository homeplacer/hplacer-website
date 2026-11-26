import type { Metadata } from "next";
import { site } from "./site";

/** Social cards use an absolute title when the page sets one, and a string title otherwise. */
function socialTitle(title: Metadata["title"]) {
  if (typeof title === "string") return title;
  if (title && "absolute" in title && title.absolute) return title.absolute;
  return site.name;
}

export function pageMetadata(meta: Metadata): Metadata {
  const title = socialTitle(meta.title);
  const description = meta.description || site.blurb;
  const url = String(meta.alternates?.canonical || "/");
  return { ...meta, openGraph: { type: "website", siteName: site.name, locale: "en_US", title, description, url, ...meta.openGraph }, twitter: { card: "summary_large_image", title, description, ...meta.twitter } };
}
