"use client";

// Last-resort boundary for errors thrown in the root layout itself. It replaces
// the whole document, so it renders its own <html>/<body> and uses inline styles
// (the app CSS may not be available in a catastrophic failure). Ordinary page
// errors are caught closer to the tree; this is the final safety net.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#faf9f7",
          color: "#2b2724",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 480 }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.5, color: "#6f6a62" }}>
            An unexpected error occurred on our end. Please try again — or call us at
            {" "}
            <a href="tel:+18438494663" style={{ color: "#3f4756", fontWeight: 600 }}>
              (843) 849-HOME
            </a>
            .
          </p>
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{ background: "#3f4756", color: "#fff", border: 0, borderRadius: 999, padding: "0.7rem 1.4rem", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            {/* Intentional hard navigation — in a root-layout failure the Next
                client router may be dead, so a plain <a> full-page load is the
                robust choice here (not <Link>). */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ border: "1px solid #ddd", borderRadius: 999, padding: "0.7rem 1.4rem", fontWeight: 600, textDecoration: "none", color: "#2b2724" }}
            >
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
