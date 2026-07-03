import Link from "next/link";
import { site } from "@/lib/site";
import { ArrowIcon, PhoneIcon } from "@/components/icons";

export const metadata = {
  title: "Page not found",
  robots: { index: false },
};

// Styled 404 — rendered inside the root layout, so the header/footer are present.
// Dynamic routes (homes/[slug], blog/[slug], etc.) call notFound() and land here.
export default function NotFound() {
  return (
    <section className="container-x flex flex-col items-center py-24 text-center sm:py-32">
      <p className="font-display text-6xl font-semibold text-brand-700">404</p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
        We can&apos;t find that page
      </h1>
      <p className="mt-3 max-w-md text-stone-muted">
        The page may have moved or never existed. Let&apos;s get you back to finding your
        home on land across the Grand Strand.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
        >
          Back home <ArrowIcon className="size-4" />
        </Link>
        <Link
          href="/homes"
          className="inline-flex items-center gap-2 rounded-full border border-stone-line px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
        >
          Browse homes
        </Link>
        <a
          href={`tel:${site.phoneDial}`}
          className="inline-flex items-center gap-2 rounded-full border border-stone-line px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
        >
          <PhoneIcon className="size-4" /> {site.phoneDisplay}
        </a>
      </div>
    </section>
  );
}
