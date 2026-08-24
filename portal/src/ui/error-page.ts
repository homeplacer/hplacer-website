/** Standalone error page — usable before an actor has been resolved. */
import { html, raw, toString } from "./html.ts";
import { securityHeaders } from "./layout.ts";
import { STYLESHEET } from "./styles.ts";

export function errorPage(status: number, title: string, message: string, detail?: string | null): Response {
  const document = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${title} · Home Placer portal</title>
<style>${raw(STYLESHEET)}</style>
</head>
<body>
<header class="top"><a href="/">HP</a><span class="title">${title}</span></header>
<main>
  <div class="notice bad" role="alert">
    <p><strong>${message}</strong></p>
    ${detail ? html`<p class="meta">${detail}</p>` : ""}
  </div>
  <p><a class="btn secondary" href="/">Back to Today</a></p>
  <footer class="foot">Home Placer employee portal · internal use only</footer>
</main>
</body>
</html>`;

  return new Response(toString(document), {
    status,
    headers: securityHeaders({ "Content-Type": "text/html; charset=utf-8" }),
  });
}
