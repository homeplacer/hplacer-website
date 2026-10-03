import Link from "next/link";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
import { getPackages } from "@/lib/packages";
import { modelPackageHref } from "@/lib/model-package-links";

export function ModelPackageJourney({ homeName, modelSlug }: { homeName: string; modelSlug: string }) {
  const archiveHref = modelPackageHref(modelSlug, getPackages());

  return (
    <section className="container-x py-10">
      <h2 className="font-display text-2xl font-semibold">
        {archiveHref ? "Home design and recorded projects" : `Plan a ${homeName} land-home package`}
      </h2>
      <p className="mt-3 max-w-3xl text-stone-muted">
        {archiveHref
          ? "This page describes a model. Package records identify a specific home-and-land project and its status; a sold example is not a current offer."
          : `This page describes the ${homeName} floor plan, not a particular available property. Ask Home Placer about a home-and-land project with this model, or about placing it on your own land. We will confirm the lot, scope, price, and current options with you.`}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {archiveHref ? (
          <Link href={archiveHref} className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline">
            See recorded {homeName} projects
          </Link>
        ) : (
          <HomeInquiryDialog homeName={homeName} label="Ask about a package" showArrow={false} className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800" />
        )}
        <Link href="/land-packages" className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline">
          Browse current land-home packages
        </Link>
      </div>
    </section>
  );
}
