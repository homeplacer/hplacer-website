import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Notice",
  description: "How Home Placer uses information you provide through hplacer.com.",
  alternates: { canonical: "/privacy" },
});

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Home Placer" title="Privacy notice">
        A straightforward explanation of what information this site collects and how Home Placer
        uses it to respond to your inquiry.
      </PageHero>

      <article className="container-x max-w-3xl space-y-10 py-14 text-stone-muted">
        <p className="text-sm">Last updated: September 14, 2026</p>

        <section>
          <h2 className="font-display text-2xl font-semibold text-stone-ink">Information you provide</h2>
          <p className="mt-3 leading-relaxed">
            When you submit an inquiry, we collect the details you choose to provide, such as your
            name, phone number, email address, the home you are interested in, and your message.
            We use those details to answer your question, discuss a home or land package, and
            provide the follow-up you request.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-stone-ink">Website activity</h2>
          <p className="mt-3 leading-relaxed">
            The site uses essential technical logs and privacy-conscious analytics to understand
            how visitors find and use the site. This helps us maintain the website and measure
            whether helpful actions, such as calls, texts, emails, and inquiries, are working.
            We do not place names, phone numbers, email addresses, or message contents in our
            analytics events.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-stone-ink">How inquiries are handled</h2>
          <p className="mt-3 leading-relaxed">
            Home Placer uses service providers to operate this website and deliver inquiries to
            our team. We may also disclose information when necessary to protect the site, comply
            with law, or respond to a valid legal request. Submitting this website inquiry does
            not itself subscribe you to a recurring text-message program.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-stone-ink">Calls, texts, and outside sites</h2>
          <p className="mt-3 leading-relaxed">
            The Call and Text actions open your device&apos;s phone or messaging application. Standard
            carrier charges may apply. Some links lead to other websites, including our real-estate
            partner for land search; those sites have their own privacy practices.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-stone-ink">Your choices and questions</h2>
          <p className="mt-3 leading-relaxed">
            To ask about information connected with an inquiry or to request that we stop using
            your contact details for follow-up, email{" "}
            <a className="font-semibold text-brand-700 underline hover:text-brand-900" href={`mailto:${site.email}`}>
              {site.email}
            </a>{" "}
            or call{" "}
            <a className="font-semibold text-brand-700 underline hover:text-brand-900" href={`tel:${site.phoneDial}`}>
              {site.phoneDisplay}
            </a>.
          </p>
        </section>

        <p className="border-t border-stone-line pt-8 text-sm">
          Looking for a home or land package? <Link className="font-semibold text-brand-700 underline hover:text-brand-900" href="/contact">Contact Home Placer</Link>.
        </p>
      </article>
    </>
  );
}
