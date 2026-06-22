import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Home Placer — New Homes on Land in Horry County, SC";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a1f1a",
          backgroundImage:
            "radial-gradient(circle at 18% 28%, rgba(84,154,131,0.35) 0, transparent 45%), radial-gradient(circle at 88% 12%, rgba(239,165,32,0.25) 0, transparent 45%)",
          padding: 72,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#1f5143",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            HP
          </div>
          <div style={{ fontSize: 38, fontWeight: 700 }}>Home Placer</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}>
            A new home — and the land it sits on — from the low $200s.
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.78)" }}>
            Clayton · Cavco · Champion · Horry County, SC · No HOA
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
          <span style={{ color: "#f0bd5c", fontWeight: 700 }}>hplacer.com</span>
          <span style={{ color: "rgba(255,255,255,0.7)" }}>(843) 849-HOME</span>
        </div>
      </div>
    ),
    size,
  );
}
