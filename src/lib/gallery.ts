import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "gallery");

export interface GalleryItem {
  src: string;
  category: "homes" | "development";
  alt: string;
}

// Reads the curated photos in public/gallery. home-* = manufactured homes we've
// placed (finished or mid-setup); dev-* = land development / communities.
export function getGallery(): GalleryItem[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
  } catch {
    return [];
  }
  return files.sort().map((f) => {
    const isHome = f.startsWith("home-");
    return {
      src: `/gallery/${f}`,
      category: isHome ? "homes" : "development",
      alt: isHome
        ? "New manufactured home placed on land by Home Placer in Horry County, SC"
        : "Home Placer land development and manufactured-home community on the Grand Strand, SC",
    };
  });
}

export function galleryByCategory(cat: "homes" | "development") {
  return getGallery().filter((g) => g.category === cat);
}
