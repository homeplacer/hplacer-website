import { ImageResponse } from "next/og";
import { site } from "@/lib/site";
import { OG_HERO } from "./og-hero";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Home Placer — New Homes on Land in Horry County, SC";

// The link-preview card: a real, finished home (the #1 best-seller) full-bleed,
// with a dark gradient scrim and the brand lockup — photos out-perform text
// cards for link CTR. The photo is inlined as a base64 data URI (see og-hero.ts)
// so next/og can render it in the Cloudflare Workers runtime — no filesystem,
// no network fetch.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", fontFamily: "sans-serif" }}>
        {/* Home photo, full-bleed */}
        <img
          src={OG_HERO}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
        />
        {/* Dark scrim so the text is always legible */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(15,23,40,0.55) 0%, rgba(15,23,40,0.12) 34%, rgba(15,23,40,0.30) 60%, rgba(15,23,40,0.92) 100%)",
          }}
        />
        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 1200,
            height: 630,
            padding: 64,
            color: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 14,
                background: "rgba(255,255,255,0.16)",
                border: "2px solid rgba(255,255,255,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              HP
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>
              Home Placer
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                fontSize: 62,
                fontWeight: 800,
                lineHeight: 1.04,
                maxWidth: 1010,
                textShadow: "0 3px 20px rgba(0,0,0,0.7)",
              }}
            >
              {site.tagline}
            </div>
            <div style={{ fontSize: 29, color: "rgba(255,255,255,0.92)", textShadow: "0 1px 10px rgba(0,0,0,0.6)" }}>
              Clayton · Cavco · Champion · Horry County, SC · No HOA
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 10,
                fontSize: 27,
                fontWeight: 700,
                textShadow: "0 1px 10px rgba(0,0,0,0.6)",
              }}
            >
              <span style={{ color: "#f9a8d4" }}>{site.domain}</span>
              <span style={{ color: "rgba(255,255,255,0.88)" }}>{site.phoneDisplay}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
