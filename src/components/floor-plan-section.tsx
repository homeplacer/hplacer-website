"use client";

import { useWidth } from "./width-context";
import { ZoomableFloorPlan } from "./zoom-image-modal";
import type { FloorPlan } from "@/lib/home-types";

// Dedicated "Floor plan" section, kept OUT of the photo gallery. For multi-width
// plans it shows the plan for the selected width (synced with the summary toggle
// via WidthProvider) and offers its own 28'/32' toggle.
export function FloorPlanSection({
  floorPlans,
  name,
}: {
  floorPlans: FloorPlan[];
  name: string;
}) {
  const ctx = useWidth();
  const hasWidths = floorPlans.some((f) => f.widthFt != null);
  const multi = !!ctx && ctx.widths.length > 1 && hasWidths;

  let shown = floorPlans;
  if (multi && ctx) {
    const match = floorPlans.filter((f) => f.widthFt === ctx.width);
    // Fallback (e.g. a width with no published plan): show the labeled plan we do have.
    shown = match.length ? match : floorPlans.filter((f) => f.widthFt != null).slice(0, 1);
  }
  const fallbackWidth = multi && ctx && !floorPlans.some((f) => f.widthFt === ctx.width);
  // The width the displayed plan actually represents — falls back to the plan we
  // have when the selected width has no published drawing (e.g. Augusta's 28').
  const shownWidth = ctx ? (fallbackWidth ? shown[0]?.widthFt ?? ctx.width : ctx.width) : 0;

  return (
    <section className="container-x py-10" id="floor-plan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-stone-ink">Floor plan</h2>
        {multi && ctx && (
          <div
            role="group"
            aria-label="Floor plan width"
            className="flex gap-1.5 rounded-full bg-stone-sunken p-1"
          >
            {ctx.widths.map((w) => {
              const on = w === ctx.width;
              const xl = w === 32;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => ctx.setWidth(w)}
                  aria-pressed={on}
                  className={
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition " +
                    (on
                      ? xl
                        ? "bg-amber-500 text-amber-950 shadow-sm"
                        : "bg-brand-700 text-white shadow-sm"
                      : "text-stone-muted hover:text-stone-ink")
                  }
                >
                  {w}′{xl ? " · XL" : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {multi && ctx && (
        <p className="mt-1 text-sm">
          <span className="text-stone-muted">
            {shownWidth}′ wide · {(shownWidth * ctx.lengthFt).toLocaleString()} sq ft
          </span>
          {fallbackWidth && (
            <span className="ml-1 font-medium text-amber-700">
              — the {ctx.width}′ floor plan isn&apos;t published yet; showing the {shownWidth}′ layout
            </span>
          )}
        </p>
      )}

      <div className={shown.length === 1 ? "mt-5 max-w-3xl" : "mt-5 grid gap-5 sm:grid-cols-2"}>
        {shown.map((f, i) => (
          <ZoomableFloorPlan
            key={f.url + i}
            src={f.url}
            alt={`${name} floor plan${f.widthFt ? ` — ${f.widthFt}′ wide` : ""}`}
          />
        ))}
      </div>
    </section>
  );
}
