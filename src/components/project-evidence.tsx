import Link from "next/link";
import type { PlacedHome } from "@/lib/placed-homes";
export function ProjectEvidence({ home }: { home: PlacedHome }) {
  return (
    <section className="container-x py-12">
      <div className="rounded-card border border-stone-line bg-stone-surface p-7">
        <p className="text-sm uppercase text-brand-700">Project record</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          What this completed home can tell you
        </h2>
        <p className="mt-4 text-stone-muted">
          This {home.town} record documents a sold {home.beds}-bedroom,{" "}
          {home.baths}-bathroom {home.style.toLowerCase()} home
          {home.withLand ? " with land" : ""}
          {home.modelName ? ` using the ${home.modelName} model` : ""}.{" "}
          {home.lotAcres
            ? `The archive records a ${home.lotAcres}-acre lot.`
            : ""}
        </p>
        <p className="mt-4 text-stone-muted">
          Use the recorded home and lot to frame a conversation about your own
          project. The archive does not establish the original site constraints,
          itemized installation scope, project duration, or current cost to
          repeat the work.
        </p>
        <h3 className="mt-6 font-semibold">
          Bring these questions to your project review
        </h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>How does the proposed home fit the usable area of my lot?</li>
          <li>Which access and utility questions are still unresolved?</li>
          <li>What work and allowances will the written scope include?</li>
        </ul>
        <p className="mt-6">
          <Link href="/guides/land-readiness-checklist" className="underline">
            Use the land-readiness checklist
          </Link>{" "}
          ·{" "}
          <Link href="/packages" className="underline">
            Compare package records
          </Link>
        </p>
      </div>
    </section>
  );
}
