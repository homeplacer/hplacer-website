import { site } from "@/lib/site";
import { reviews } from "@/lib/reviews";
import { ArrowIcon } from "@/components/icons";

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5 text-amber-500" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden className="text-lg leading-none">
          {i < n ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

// Social proof from the real Google Business Profile (5.0★). Verbatim reviews
// live in lib/reviews.ts and also feed the LocalBusiness JSON-LD.
export function Testimonials() {
  return (
    <section className="bg-stone-surface py-20">
      <div className="container-x">
        <div className="flex flex-col items-center text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Reviews</p>
          <h2 className="mt-1 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
            What our buyers say
          </h2>
          <div className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-stone-line bg-stone-bg px-4 py-2">
            <Stars n={5} />
            <span className="text-sm font-semibold text-stone-ink">
              {site.gbp.rating.toFixed(1)} · {site.gbp.reviewCount} Google reviews
            </span>
          </div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <figure
              key={r.author}
              className="flex flex-col rounded-card border border-stone-line bg-stone-bg p-6 shadow-sm"
            >
              <Stars n={r.rating} />
              <blockquote className="mt-4 flex-1 leading-relaxed text-stone-ink/85">
                &ldquo;{r.text}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-stone-line pt-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                  {r.author.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-stone-ink">{r.author}</span>
                  <span className="block text-xs text-stone-muted">Verified Google review</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a
            href={site.gbp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            Read all {site.gbp.reviewCount} reviews on Google <ArrowIcon className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
