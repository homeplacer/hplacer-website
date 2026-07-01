import Script from "next/script";
import { site } from "@/lib/site";

// Google Analytics 4 (gtag). Renders nothing until site.gaId is set to a real
// Measurement ID (G-XXXXXXXXXX), so the site stays clean until the GA4 property
// exists. Loaded afterInteractive so it never blocks first paint.
export function GoogleAnalytics() {
  const id = site.gaId;
  if (!id) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}
