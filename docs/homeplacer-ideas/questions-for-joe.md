# Questions for Joe

*Decisions and access blockers that gate the work. Grouped: business decisions (NEEDS JOE),
access blockers (NEEDS ACCESS), and external human reviewers (legal/lender/broker).*

## NEEDS JOE — business decisions

| # | Question | Why it matters / what it unblocks |
|---|---|---|
| J1 | **Send pricing numbers** (setup-price + optional home-only price per model). | Every home shows "Call for pricing"; the price sort/filter is built and dormant. **Biggest single conversion unlock.** Loader is hardened — drop numbers into `data/setup-pricing.json`. |
| J2 | **Landowner/seller offer — what is it?** Buy land outright? JV/develop? List it via Forturro? | Determines whether/how to build the `/sell-your-land` page, its form, and FUB routing. The lead type you say you want has **zero** path today. |
| J3 | **Are you licensed in NC (Brunswick/Columbus)?** | Homepage claims "Licensed in SC & NC" but the source of truth says SC only. If not licensed in NC → downgrade the copy (compliance C-5). If yes → provide the number. |
| J4 | **SC (and NC) dealer license number(s) to display.** | "Licensed" with no number is a weaker trust signal and may be required by dealer-advertising rules. |
| J5 | **Warranty reality: 1-year, or the "2-10 Home Buyers Warranty" (2yr systems / 10yr structure)?** | `/warranty` claims 2-10; every other page says 1-year. Contradiction + substantiation risk (C-4). Need the accurate scope + who backs each layer. |
| J6 | **Provide the remaining real Google reviews** (site shows 3 of 7) + confirm live GBP rating/count. OK to drop the Realtor-sounding testimonial? | UI + schema advertise "7 reviews / 5.0★" with only 3 shown (C-7). Keep claims synced to live GBP; lead with product-relevant reviews. |
| J7 | **Is the sales line (843) 849-HOME SMS-capable?** | If yes, add real click-to-text (0 `sms:` links today; CTAs say "call or text" but all dial). Manufactured-home buyers skew text-first. |
| J8 | **Confirm every "Recently Placed" home is an actual HP transaction**, and that republishing MLS closed addresses/prices/photos is permitted. | Data comes from Coastal Carolinas MLS/Paragon; "placed and sold by Home Placer" is a firm claim + an MLS data-use question (C-6). |
| J9 | **Forturro "Browse all listings" — does that search show rentals?** Should it be for-sale-only? | The unfiltered cross-over link could expose HP visitors to rentals (off-message; possible bad-lead on the Forturro side). The land-only deep link is safe. |
| J10 | **Approve building the privacy/consent layer** (privacy policy + terms + standardized form consent, drafted with legal). | Legal exposure (C-1/C-2) **and** it's a hard requirement for Google Ads — paid traffic is locked until this exists. |
| J11 | **Later: approve customer-facing SMS/email autoresponder + review-request workflow?** | Parked pending explicit approval (your standing rule) + consent framework. |
| J12 | **Confirm the trigger to start Phase 1 backend = real traffic/conversion data** (not a date). | Matches D-HP-002. Guards against building the platform before validating conversion. |

## NEEDS ACCESS — blocked by missing credentials/admin

| # | Access | Needed for |
|---|---|---|
| A1 | **Cloudflare account** (Home Placer) | Wire missed-lead alerting (Logpush/Tail or a Queue outbox); set/verify Worker secrets (`FUB_API_KEY` etc.); promote CSP; HSTS. **The alerting is the top ops item.** |
| A2 | **Follow Up Boss** | Verify Lead Flow automations exist for every source/tag (`hplacer.com`, `Home Placer Warranty`, `subscribe`) so no lead lands silently on a timeline. |
| A3 | **Google Search Console + GA4** (carolina@hplacer.com) | Validate which town/blog pages actually rank; find query gaps; confirm the NC-"SC" pages aren't already suppressed. |
| A4 | **Google Business Profile** | Confirm categories ("Manufactured home dealer") + NC service-area; grow the review count (the real local-pack lever). |
| A5 | **MLS / IDX (CCAR RESO) feed** | Build a real "available now" inventory page — the current `mlsCollabUrl` is a static collab share, not a feed. |
| A6 | **Bing Places PIN / Apple Business Connect** | Finish the local listings (per HANDOFF — your items). |
| A7 | **Domain registrar** (Priced Right Domains) | Finish hplacer.com → Cloudflare Registrar transfer, then enable HSTS preload. |

## External reviewers (route the compliance flags)

Not access — human dependencies. See `compliance-review-flags.md` for the full list.

- **Legal (privacy/TCPA/Fair Housing):** privacy policy + terms, standardized consent (C-1, C-2, C-11, C-12).
- **Lender / mortgage-compliance:** financing-ad language, "$0 down" chips, "apply", payment estimates (C-3, C-8, C-9, C-10).
- **Dealer-licensing (SC + NC):** license claims + numbers (C-5), warranty substantiation (C-4).
- **Broker / MLS + RESPA:** "placed & sold" accuracy + MLS data use (C-6); Forturro affiliated-business referral (C-13).
