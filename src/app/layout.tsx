import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EmailCapture } from "@/components/email-capture";
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
  openGraph: {
    title: `${site.name} — New Homes on Land`,
    description: site.blurb,
    url: site.url,
    siteName: site.name,
    type: "website",
  },
  alternates: { canonical: "/" },
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
        <JsonLd data={localBusinessLd()} />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <EmailCapture />
        <SiteFooter />
      </body>
    </html>
  );
}
