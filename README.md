# Home Placer — hplacer.com

The website for **Home Placer LLC**, a licensed manufactured-home dealer in
Horry County, SC. We pair brand-new Clayton, Cavco, and Champion homes with land
across the Grand Strand — one package, one price, no HOA.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 · `marked` for blog
markdown · deploy target Vercel.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (prerenders ~125 pages)
```

## Where things live

```
src/
  app/
    page.tsx                  homepage
    homes/                    inventory grid + filters + [slug] detail
    brands/  land-packages/   marketing pages
    financing/  process/      financing capture + buyer timeline
    locations/[slug]/         per-city local-SEO pages
    faq/ glossary/            content pages (with schema)
    manufactured-vs-site-built/
    blog/ + blog/[slug]/      blog index + posts
    api/lead/                 unified lead intake (FUB + Resend, env-gated)
    sitemap.ts robots.ts      SEO
    llms.txt/route.ts         AI-crawler manifest
    opengraph-image.tsx icon.tsx
  components/                 UI (cards, header, footer, forms, browser)
  lib/                        site config, data loaders, jsonld, types
data/
  models.json                <- THE inventory (94 models), built by scripts
  blog-posts.json            blog content
  setup-pricing.json         full-setup prices (slug -> number) — fill at go-live
  home-pricing.json          home-only prices (slug -> number) — optional
scripts/
  build-models.mjs           merges extraction sources -> data/models.json
  build-cavco.mjs            the 4 browser-captured Cavco models
  build-blog.mjs             workflow output -> data/blog-posts.json
```

## Inventory

`data/models.json` holds 94 real manufacturer models (Clayton 44, Cavco 6,
Champion 44) scraped from the builders' sites — with photos, decor options, and
**square footage computed as width x length** (the MLS convention; the sites'
stated sqft is ignored). To rebuild after a new extraction:

```bash
node scripts/build-cavco.mjs && node scripts/build-models.mjs
```

## Pricing

Every home shows **"Call for pricing"** until prices are set. The model supports
two numbers per home:

- `data/home-pricing.json` — home-only price, keyed by model slug
- `data/setup-pricing.json` — full-setup price (home + 1/4-acre lot + setup +
  utilities), keyed by model slug

Drop in `{ "<slug>": 264900, ... }` and the site flips from "Call for pricing"
to real figures automatically (full-setup leads, home-only shown beside it).

**Ready-to-fill templates** — `data/setup-pricing.example.json` and
`data/home-pricing.example.json` list every model slug set to `0` (a "not priced
yet" placeholder). Copy one over the real file and replace the zeros:

```bash
cp data/setup-pricing.example.json data/setup-pricing.json   # then edit the numbers
```

The loader is forgiving about how you enter a value — all of these work and
resolve to the same price, so a formatting slip degrades to "Call for pricing"
instead of breaking the page:

- `"<slug>": 264900` — a plain number (canonical)
- `"<slug>": "$264,900"` — a formatted string (e.g. pasted from a quote)
- `"<slug>": { "setupPrice": 275000, "price": 245000 }` — an object

Anything non-numeric, `0`, or negative is ignored (shown as "Call for pricing");
a suspiciously low value logs a build warning in case a `000` was dropped.

## Leads

All forms post to `/api/lead`. Delivery is **env-gated** — it logs by default and
"self-arms" when keys are present:

| Env var | Effect |
|---|---|
| `FUB_API_KEY` | Creates a person/event in Follow Up Boss (source `hplacer.com`) |
| `RESEND_API_KEY` | Emails the team (`LEADS_TO`, default `leads@hplacer.com`) |

## Go-live checklist

- [ ] Add pricing files (above)
- [ ] Set `FUB_API_KEY` and/or `RESEND_API_KEY` (+ verify the hplacer.com domain in Resend)
- [ ] Replace hotlinked manufacturer photos with owned images
- [ ] Connect the GitHub repo + Vercel project, point the `hplacer.com` domain
- [ ] Submit `https://hplacer.com/sitemap.xml` to Google + Bing
