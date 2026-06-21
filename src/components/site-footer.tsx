import Link from "next/link";
import { navLinks, resourceLinks, site } from "@/lib/site";
import { HomeMark, PhoneIcon, PinIcon } from "@/components/icons";

export function SiteFooter() {
  const year = 2026;
  return (
    <footer className="border-t border-white/10 bg-brand-950 text-stone-100">
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-white">
              <HomeMark className="size-5" />
            </span>
            <span className="font-display text-xl font-semibold text-white">Home Placer</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-100/70">
            {site.blurb}
          </p>
          <div className="mt-5 flex flex-col gap-2 text-sm">
            <a href={`tel:${site.phoneDial}`} className="inline-flex items-center gap-2 text-white hover:text-accent-300">
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
            <a href={`mailto:${site.email}`} className="text-stone-100/80 hover:text-accent-300">
              {site.email}
            </a>
            <span className="inline-flex items-center gap-2 text-stone-100/70">
              <PinIcon className="size-4" /> {site.address.street}, {site.address.city}, {site.address.state} {site.address.zip}
            </span>
            <a
              href={site.gbp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-stone-100/80 hover:text-accent-300"
            >
              <span className="text-accent-300">★ {site.gbp.rating.toFixed(1)}</span>
              <span>on Google ({site.gbp.reviewCount} reviews)</span>
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-300">
            Explore
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-stone-100/80 hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-300">
            Resources
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {resourceLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-stone-100/80 hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-300">
            Where we build
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {site.locations.map((l) => (
              <li key={l.slug}>
                <Link href={`/locations/${l.slug}`} className="text-stone-100/80 hover:text-white">
                  {l.name}, SC
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-stone-100/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {site.legalName}. Licensed manufactured-home dealer, Horry County, SC.</p>
          <p>Homes shown are representative. Pricing and availability subject to change.</p>
        </div>
      </div>
    </footer>
  );
}
