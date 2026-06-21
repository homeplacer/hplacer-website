import { site } from "@/lib/site";
import type { Home } from "@/lib/home-types";
import { displayPrice } from "@/lib/home-types";

// Renders a JSON-LD <script>. Data comes only from our own content, so it's
// safe to inject as a stringified object.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
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
    logo: `${site.url}/icon`,
    url: site.url,
    telephone: site.phoneDial,
    email: site.email,
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
    hasMap: site.gbp.url,
    sameAs: site.sameAs,
    areaServed: site.locations.map((l) => ({
      "@type": "City",
      name: `${l.name}, SC`,
    })),
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:00",
      closes: "18:00",
    },
    priceRange: "$$ — homes from the low $200s",
    description: site.blurb,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: site.gbp.rating,
      reviewCount: site.gbp.reviewCount,
      bestRating: 5,
    },
    makesOffer: {
      "@type": "Offer",
      itemOffered: {
        "@type": "Product",
        name: "Manufactured home + land package",
      },
      priceCurrency: "USD",
    },
  };
}

export function homeProductLd(home: Home) {
  const price = displayPrice(home);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${home.name} by ${home.brand}`,
    brand: { "@type": "Brand", name: home.brand },
    category: "Manufactured Home",
    description: home.excerpt || `${home.beds}-bed ${home.baths}-bath ${home.brand} manufactured home.`,
    image: home.imageUrls.slice(0, 5),
    url: `${site.url}/homes/${home.slug}`,
    ...(price != null
      ? {
          offers: {
            "@type": "Offer",
            price,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            seller: { "@type": "Organization", name: site.legalName },
          },
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

export function articleLd(post: { title: string; description: string; slug: string; date: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: site.legalName },
    publisher: { "@type": "Organization", name: site.legalName },
    url: `${site.url}/blog/${post.slug}`,
  };
}
