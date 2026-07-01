import Link from "next/link";
import { navLinks, resourceLinks, site, socialLinks } from "@/lib/site";
import { asset } from "@/lib/asset";
import {
  PhoneIcon,
  PinIcon,
  InstagramIcon,
  TiktokIcon,
  FacebookIcon,
} from "@/components/icons";

const SOCIAL_ICONS = {
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  facebook: FacebookIcon,
} as const;

export function SiteFooter() {
  const year = 2026;
  return (
    <footer className="border-t border-white/10 bg-brand-950 text-stone-100">
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/logo.png")} alt="Home Placer LLC" className="h-14 w-auto brightness-0 invert" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-100/70">
            {site.blurb}
          </p>
          <div className="mt-5 flex flex-col gap-2 text-sm">
            <a href={`tel:${site.phoneDial}`} className="inline-flex items-center gap-2 text-white hover:text-accent-300">
              <PhoneIcon className="size-4" /> {site.phoneDisplay} <span className="text-stone-100/50">· Sales</span>
            </a>
            <a href={`tel:${site.warrantyPhoneDial}`} className="inline-flex items-center gap-2 text-stone-100/80 hover:text-accent-300">
              <PhoneIcon className="size-4" /> {site.warrantyPhoneDisplay} <span className="text-stone-100/50">· Service</span>
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

          <div className="mt-6">
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-accent-300">
              Follow Home Placer
            </h4>
            <div className="mt-3 flex items-center gap-3">
              {socialLinks
                .filter((s) => s.live)
                .map((s) => {
                  const Icon = SOCIAL_ICONS[s.key];
                  return (
                    <a
                      key={s.key}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Home Placer on ${s.label}`}
                      title={`${s.label} · ${s.handle}`}
                      className="flex size-9 items-center justify-center rounded-full border border-white/15 text-stone-100/80 transition hover:border-accent-300 hover:text-accent-300"
                    >
                      <Icon className="size-[18px]" />
                    </a>
                  );
                })}
            </div>
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
            <li>
              <a
                href={site.forturro.landSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-100/80 hover:text-white"
              >
                Search Land for Sale ↗
              </a>
            </li>
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
