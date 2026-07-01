import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EmailCapture } from "@/components/email-capture";
import { GoogleAnalytics } from "@/components/analytics";
import { AnalyticsEvents } from "@/components/analytics-events";
import { JsonLd, localBusinessLd } from "@/lib/jsonld";
import { site } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — New Homes on Land in Horry County, SC`,
    template: `%s · ${site.name}`,
  },
  description: site.blurb,
  keywords: [
    "manufactured homes Myrtle Beach",
    "mobile homes Horry County SC",
    "land home packages South Carolina",
    "Clayton homes Conway SC",
    "new manufactured home on land",
    "modular homes Grand Strand",
  ],
  openGraph: {
    title: `${site.name} — New Homes on Land`,
    description: site.blurb,
    url: site.url,
    siteName: site.name,
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  // Geo-targeting meta tags for local search.
  other: {
    "geo.region": "US-SC",
    "geo.placename": "Myrtle Beach, South Carolina",
    "geo.position": `${site.geo.lat};${site.geo.lng}`,
    ICBM: `${site.geo.lat}, ${site.geo.lng}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-bg text-stone-ink">
        <GoogleAnalytics />
        <AnalyticsEvents />
        <JsonLd data={localBusinessLd()} />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <EmailCapture />
        <SiteFooter />
      </body>
    </html>
  );
}
