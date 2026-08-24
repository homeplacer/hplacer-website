import type { Metadata } from "next";
import { WarrantyRequestForm } from "@/components/warranty-request-form";
import { site } from "@/lib/site";
import { PhoneIcon, CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Submit a Warranty Request",
  description:
    "Home Placer homeowners: submit a warranty request with photos. Tell us your serial number or your address and our service team will follow up.",
  alternates: { canonical: "/warranty-request" },
};

export default function WarrantyRequestPage() {
  return (
    <section className="container-x grid gap-12 py-16 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Homeowner warranty</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink sm:text-5xl">
          Submit a warranty request
        </h1>
        <p className="mt-4 max-w-md text-stone-muted">
          Tell us what&apos;s wrong and send a photo or two. If you have your serial number, we&apos;ll pull up
          your home right away — if not, your address is enough and we&apos;ll match it on our end.
        </p>

        <a
          href={`tel:${site.warrantyPhoneDial}`}
          className="mt-8 flex items-center gap-4 rounded-card border border-stone-line bg-stone-surface p-5 transition hover:border-brand-300"
        >
          <span className="grid size-11 place-items-center rounded-lg bg-brand-700 text-white">
            <PhoneIcon className="size-5" />
          </span>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-stone-muted">
              Urgent? Call the service line
            </span>
            <span className="block font-display text-lg font-semibold text-stone-ink">{site.warrantyPhoneDisplay}</span>
          </span>
        </a>

        <ul className="mt-8 space-y-2 text-sm text-stone-ink/80">
          {[
            "Goes straight to our service team",
            "Photos help us bring the right parts",
            "You'll get a reference number to quote",
          ].map((item) => (
            <li key={item} className="inline-flex items-center gap-2">
              <CheckIcon className="size-4 text-brand-600" /> {item}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-stone-muted">
          Not a warranty issue? Use the{" "}
          <a href="/service-request" className="font-semibold underline">general service request</a> form instead.
        </p>
      </div>

      <div className="rounded-card border border-stone-line bg-stone-bg p-6 shadow-sm sm:p-8">
        <WarrantyRequestForm />
      </div>
    </section>
  );
}
