import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { JsonLd, faqLd, breadcrumbLd } from "@/lib/jsonld";
import { ArrowIcon, PhoneIcon } from "@/components/icons";

// SEO/geo per the standing rule — built from a Gemini "top Google engineer"
// consult (2026-06-29).
export const metadata: Metadata = {
  title: "Drywall vs. Wall Strips in Manufactured Homes",
  description:
    "Confused by wall strips vs. real drywall in manufactured homes? The difference in look, quality, and value — and why we highlight our full-drywall homes.",
  alternates: { canonical: "/manufactured-home-drywall-vs-wall-strips" },
};

const rows = [
  { label: "What it is", strips: "Pre-finished gypsum panels (a wallpaper-like coating) with batten strips over the seams", dry: "Standard drywall, taped, mudded, sanded & textured" },
  { label: "The look", strips: "Visible seam strips — the classic “mobile home” look", dry: "Seamless walls, identical to a site-built house" },
  { label: "Finish quality", strips: "Budget, factory-fast", dry: "Premium, site-built standard" },
  { label: "Resale & appraisal", strips: "Carries the old stigma", dry: "Shows + appraises like a regular home" },
  { label: "Paint & repair", strips: "Panels; harder to patch cleanly", dry: "Patch, paint & decorate like any house" },
  { label: "Cost", strips: "Lower", dry: "A premium upgrade — and worth it on land" },
];

const faqs = [
  {
    q: "Why do some manufactured homes use wall strips instead of drywall?",
    a: "Budget factory builders use gypsum panels that arrive pre-finished with a printed, wallpaper-like surface, then hide the seams with thin batten 'strips.' It's fast and cheap, and the pre-finished panels ride down the highway without the seams cracking. It's also where the dated 'mobile home' interior look comes from.",
  },
  {
    q: "Can you just tape and mud over wall strips later?",
    a: "It's strongly discouraged. Those panels have a slick, pre-finished surface that regular joint compound won't bond to, and they're thinner than residential drywall — so a DIY tape-and-mud job usually cracks along the seams within months. The right move is to buy a home built with full drywall from the factory.",
  },
  {
    q: "Does full drywall actually add value to a manufactured home?",
    a: "Yes. A home with full, taped-and-textured drywall looks identical to a site-built house inside. That premium finish raises buyer demand, helps the home appraise higher, and erases the 'mobile home' stigma — especially when it's bundled with land you own.",
  },
  {
    q: "Does Home Placer offer full-drywall homes?",
    a: "Yes — many of our models, including our Rockwell-built homes, come with true, site-built-quality full drywall. If a real-house interior matters to you, just tell us and we'll point you straight to the homes that have it.",
  },
];

export default function DrywallVsWallStripsPage() {
  return (
    <>
      <JsonLd data={faqLd(faqs)} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Drywall vs. Wall Strips", path: "/manufactured-home-drywall-vs-wall-strips" },
        ])}
      />

      <PageHero eyebrow="Interior quality guide" title="Full drywall vs. wall strips">
        Walk into two manufactured homes and one can feel like a builder house while the other feels
        like a &ldquo;mobile home&rdquo; — and a lot of that comes down to the walls. Here&apos;s the
        difference between <strong className="font-semibold text-stone-ink">wall strips</strong> and{" "}
        <strong className="font-semibold text-stone-ink">full drywall</strong>, and why we point you to
        the full-drywall homes.
      </PageHero>

      {/* What are wall strips */}
      <section className="container-x py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            What are &ldquo;wall strips&rdquo;?
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-stone-ink/85">
            <p>
              Budget-built manufactured homes use{" "}
              <strong className="font-semibold text-stone-ink">pre-finished gypsum panels</strong> —
              drywall that comes from the factory already covered in a printed, wallpaper-like finish
              instead of being painted. Where two panels meet, the seam is hidden with a thin{" "}
              <strong className="font-semibold text-stone-ink">batten strip</strong> (often a slightly
              different color). Those strips are the tell-tale &ldquo;mobile home&rdquo; look.
            </p>
            <p>
              Why builders use them: they&apos;re fast and cheap, and the flexible panels survive the
              trip down the highway without cracking at the joints. The trade-off is the look and feel —
              and the resale perception.
            </p>
            <h2 className="pt-4 font-display text-2xl font-semibold text-stone-ink">
              What is full drywall?
            </h2>
            <p>
              Full drywall is the <strong className="font-semibold text-stone-ink">site-built
              standard</strong>: real drywall, taped, mudded, sanded, textured, and painted — no strips,
              no visible seams. Done right at the factory, you genuinely can&apos;t tell it from a
              stick-built home&apos;s interior. It&apos;s a premium finish, and it&apos;s exactly what
              makes a manufactured home feel like a <em>real house</em>.
            </p>
          </div>
        </div>
      </section>

      {/* comparison */}
      <section className="container-x py-4">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-card border border-stone-line">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-brand-900 text-white">
              <tr>
                <th className="p-4 font-semibold"></th>
                <th className="p-4 font-display text-base font-semibold text-stone-100/85">Wall strips</th>
                <th className="p-4 font-display text-base font-semibold">Full drywall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-line">
              {rows.map((r, i) => (
                <tr key={r.label} className={i % 2 ? "bg-stone-surface" : "bg-stone-bg"}>
                  <td className="p-4 font-semibold text-stone-ink">{r.label}</td>
                  <td className="p-4 text-stone-muted">{r.strips}</td>
                  <td className="p-4 text-stone-ink">{r.dry}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* Home Placer + full drywall */}
      <section className="container-x py-12">
        <div className="mx-auto max-w-4xl rounded-card border border-brand-200 bg-brand-50/60 p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">What we recommend</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
            We&apos;ll point you to the full-drywall homes
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-ink/85">
            If you want that real-house interior, you don&apos;t have to guess. Many of our models —
            including our <strong className="font-semibold text-stone-ink">Rockwell-built homes</strong> —
            come with true full drywall. Tell us it matters to you and we&apos;ll line up the homes that
            have it, on land, in your area.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/homes?wall=drywall" className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800">
              Browse full-drywall homes <ArrowIcon className="size-4" />
            </Link>
            <Link href="/recently-placed" className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300">
              See homes we&apos;ve placed
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-x py-4">
        <h2 className="text-center font-display text-2xl font-semibold text-stone-ink">Common questions</h2>
        <div className="mx-auto mt-8 max-w-3xl divide-y divide-stone-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-stone-ink">
                {f.q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-stone-line text-brand-700 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-stone-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-x py-12">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 rounded-card border border-stone-line bg-stone-surface p-7 text-center sm:p-10">
          <h2 className="font-display text-2xl font-semibold text-stone-ink sm:text-3xl">
            Want a home that feels site-built inside?
          </h2>
          <p className="mx-auto max-w-xl text-stone-muted">
            Tell us full drywall matters to you and we&apos;ll show you exactly which homes have it — no
            guessing, no pressure.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800">
              Ask us <ArrowIcon className="size-4" />
            </Link>
            <a href={`tel:${site.phoneDial}`} className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300">
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
