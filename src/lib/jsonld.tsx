import { site, liveSocialUrls } from "@/lib/site";
import type { Home } from "@/lib/home-types";
import {
  locations as allLocations,
  counties as allCounties,
} from "@/lib/locations";

const stateName = (abbr: string) =>
  abbr === "NC" ? "North Carolina" : "South Carolina";

// Renders a JSON-LD <script>. Data comes only from our own content; we still
// escape `<` (→ <) so a stray "</script>" in any value can't break out of
// the script tag.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function localBusinessLd() {
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${site.url}/#business`,
    name: site.legalName,
    alternateName: site.name,
    image: `${site.url}/opengraph-image`,
    logo: { "@type": "ImageObject", url: `${site.url}/icon.png` },
    url: site.url,
    telephone: site.phoneDial,
    email: site.email,
    // Keep the primary inquiry route explicit for search engines and assistants.
    // These are the same public sales contacts rendered in the site header,
    // footer, contact page, and conversion forms.
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: site.phoneDial,
      email: site.email,
      url: `${site.url}/contact`,
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.state,
      postalCode: site.address.zip,
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: site.geo.lat,
      longitude: site.geo.lng,
    },
    ...(site.openingHours.length
      ? {
          openingHoursSpecification: site.openingHours.map((hours) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: hours.dayOfWeek,
            opens: hours.opens,
            closes: hours.closes,
          })),
        }
      : {}),
    hasMap: site.gbp.url,
    sameAs: [...site.sameAs, ...liveSocialUrls],
    knowsAbout: [
      "Manufactured homes",
      "Modular homes",
      "Land-home packages",
      "Clayton Homes",
      "Cavco Homes",
      "Champion Homes",
      "Land development",
      "HUD-code home installation",
    ],
    areaServed: [
      ...Object.values(allCounties).map((c) => ({
        "@type": "AdministrativeArea",
        name: `${c.name}, ${stateName(c.stateAbbr)}`,
      })),
      ...allLocations.map((l) => ({
        "@type": "City",
        name: `${l.name}, ${allCounties[l.countyKey]?.stateAbbr ?? "SC"}`,
      })),
    ],
    description: site.blurb,
  };
}

const abs = (u: string) => (u.startsWith("http") ? u : `${site.url}${u}`);

// Real, sold Home Placer homes (the /recently-placed showcase + its per-home
// pages). Each card photo is geotagged to its street address — exposing that as
// ImageObject + contentLocation gives Google image-search a strong local signal,
// and mainEntityOfPage links the image to that home's own page.
type PlacedHomeLD = {
  slug: string;
  address: string;
  town: string;
  beds: number;
  baths: number;
  style: string;
  photo: string | null;
  photos?: string[];
  lat?: number | null;
  lon?: number | null;
  lotAcres?: number | null;
  sqftHeated?: number | null;
};

export function placedHomesGalleryLd(homes: PlacedHomeLD[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    "@id": `${site.url}/recently-placed#gallery`,
    url: `${site.url}/recently-placed`,
    name: "Recently Placed Homes by Home Placer",
    description:
      "Real manufactured homes Home Placer has placed and sold on their own land across Horry County and the Grand Strand, SC.",
    isPartOf: { "@id": `${site.url}/#business` },
    numberOfItems: homes.length,
    associatedMedia: homes
      .filter((h) => h.photo)
      .map((h) => ({
        "@type": "ImageObject",
        contentUrl: abs(h.photo as string),
        name: `${h.address}, ${h.town}, SC`,
        caption: `${h.beds}-bed ${h.baths}-bath ${h.style} manufactured home placed on its own land by Home Placer in ${h.town}, SC`,
        ...(h.slug
          ? { mainEntityOfPage: `${site.url}/recently-placed/${h.slug}` }
          : {}),
        ...(typeof h.lat === "number" && typeof h.lon === "number"
          ? {
              contentLocation: {
                "@type": "Place",
                name: `${h.town}, SC`,
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: h.lat,
                  longitude: h.lon,
                },
              },
            }
          : {}),
      })),
  };
}

// One placed home's own page: an ImageGallery of all its real photos, geotagged.
export function placedHomeLd(h: PlacedHomeLD, model?: { name: string }) {
  const lot = h.lotAcres ? `${h.lotAcres} acres` : "its own land";
  const photos =
    h.photos && h.photos.length ? h.photos : h.photo ? [h.photo] : [];
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    "@id": `${site.url}/recently-placed/${h.slug}#gallery`,
    url: `${site.url}/recently-placed/${h.slug}`,
    name: `${h.address}, ${h.town}, SC — placed by Home Placer`,
    description: `A ${h.beds}-bed ${h.baths}-bath ${h.style} manufactured home${model ? ` (the ${model.name})` : ""} placed and sold on ${lot} at ${h.address}, ${h.town}, SC.`,
    isPartOf: { "@id": `${site.url}/#business` },
    ...(typeof h.lat === "number" && typeof h.lon === "number"
      ? {
          contentLocation: {
            "@type": "Place",
            name: `${h.town}, SC`,
            geo: {
              "@type": "GeoCoordinates",
              latitude: h.lat,
              longitude: h.lon,
            },
          },
        }
      : {}),
    numberOfItems: photos.length,
    associatedMedia: photos.map((p) => ({
      "@type": "ImageObject",
      contentUrl: abs(p),
      name: `${h.address}, ${h.town}, SC`,
      caption: `${h.beds}-bed ${h.baths}-bath ${h.style} manufactured home placed by Home Placer in ${h.town}, SC`,
      ...(typeof h.lat === "number" && typeof h.lon === "number"
        ? {
            contentLocation: {
              "@type": "Place",
              name: `${h.town}, SC`,
              geo: {
                "@type": "GeoCoordinates",
                latitude: h.lat,
                longitude: h.lon,
              },
            },
          }
        : {}),
    })),
  };
}

// A specific placed home as a real residence (address + geo + size) — gives the
// per-home page a local entity Google can resolve, beyond the photo gallery.
export function placedHomeResidenceLd(
  h: PlacedHomeLD,
  model?: { name: string; brand?: string; sqft?: number },
) {
  return {
    "@context": "https://schema.org",
    "@type": "SingleFamilyResidence",
    name: `${h.address}, ${h.town}, SC`,
    description: `A ${h.beds}-bed ${h.baths}-bath ${h.style} manufactured home placed and sold by Home Placer${model ? ` — the ${model.name}${model.brand ? ` by ${model.brand}` : ""}` : ""}.`,
    url: `${site.url}/recently-placed/${h.slug}`,
    ...(h.photo ? { image: abs(h.photo) } : {}),
    numberOfBedrooms: h.beds,
    numberOfBathroomsTotal: h.baths,
    ...(h.sqftHeated
      ? {
          floorSize: {
            "@type": "QuantitativeValue",
            value: h.sqftHeated,
            unitCode: "FTK",
          },
        }
      : {}),
    ...(h.lotAcres
      ? {
          lotSize: {
            "@type": "QuantitativeValue",
            value: h.lotAcres,
            unitText: "acres",
          },
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: h.address,
      addressLocality: h.town,
      addressRegion: "SC",
      addressCountry: "US",
    },
    ...(typeof h.lat === "number" && typeof h.lon === "number"
      ? {
          geo: { "@type": "GeoCoordinates", latitude: h.lat, longitude: h.lon },
        }
      : {}),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

// ItemList for the /homes catalog — tells search engines the set of homes shown
// on the page, each linking to its own detail page (where the full Product schema
// lives). Names + URLs only; mirrors the visible list, no invented data.
export function homesItemListLd(
  homes: { slug: string; name: string; brand: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Manufactured & mobile homes available with land — Home Placer",
    numberOfItems: homes.length,
    itemListElement: homes.map((h, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${site.url}/homes/${h.slug}`,
      name: `${h.name} by ${h.brand}`,
    })),
  };
}

// Individual model pages are product-reference pages, not listings for a
// specific on-the-ground home. Keep the schema equally precise: publish the
// verified model, maker, images and dimensions, but never claim a price or
// availability when the page itself says to call for a current quote.
export function homeProductLd(home: Home) {
  const url = `${site.url}/homes/${home.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: home.name,
    description: home.excerpt || home.description,
    url,
    ...(home.imageUrls.length ? { image: home.imageUrls.map(abs) } : {}),
    brand: { "@type": "Brand", name: home.brand },
    ...(home.modelCode ? { model: home.modelCode, sku: home.modelCode } : {}),
    category: "Manufactured home floor plan",
    additionalProperty: [
      { "@type": "PropertyValue", name: "Bedrooms", value: home.beds },
      { "@type": "PropertyValue", name: "Bathrooms", value: home.baths },
      { "@type": "PropertyValue", name: "Square feet", value: home.sqft, unitCode: "FTK" },
      { "@type": "PropertyValue", name: "Width", value: home.widthFt, unitCode: "FOT" },
      { "@type": "PropertyValue", name: "Length", value: home.lengthFt, unitCode: "FOT" },
      { "@type": "PropertyValue", name: "Series", value: home.series },
    ],
    isRelatedTo: { "@id": `${site.url}/#business` },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${site.url}${it.path}`,
    })),
  };
}

export function articleLd(post: {
  title: string;
  description: string;
  slug: string;
  date: string;
}) {
  const url = `${site.url}/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    // Posts have no per-post image; use the site OG card so shares/rich-results
    // always have one. (When posts gain hero images, swap this to the post image.)
    image: `${site.url}/opengraph-image`,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: site.legalName, url: site.url },
    publisher: {
      "@type": "Organization",
      name: site.legalName,
      logo: { "@type": "ImageObject", url: `${site.url}/icon.png` },
    },
    mainEntityOfPage: url,
    url,
  };
}
