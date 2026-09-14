import { PhoneIcon } from "@/components/icons";
import { site } from "@/lib/site";

/**
 * Persistent, low-friction contact controls. This is intentionally present on
 * every route: a buyer can call or text from an inventory page without hunting
 * for a form or returning to the homepage.
 */
export function ContactBar() {
  return (
    <aside
      data-contact-bar
      aria-label="Contact Home Placer"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-brand-900/15 bg-white/95 px-3 py-2 shadow-[0_-8px_30px_rgba(15,23,40,0.14)] backdrop-blur-lg"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <a
          href={`tel:${site.phoneDial}`}
          aria-label={`Call Home Placer at ${site.phoneDisplay}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <PhoneIcon className="size-4" /> Call us
        </a>
        <a
          href={`sms:${site.phoneDial}`}
          aria-label={`Text Home Placer at ${site.phoneDisplay}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-800 transition hover:border-brand-300 hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          Text us
        </a>
      </div>
    </aside>
  );
}
