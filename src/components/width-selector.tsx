"use client";

import { useWidth } from "./width-context";

// Interactive 28'/32' width switcher for the model-detail page. Reads the shared
// WidthProvider so toggling here also switches the floor-plan section. Square
// footage updates live; the 32' option is framed as the "bigger rooms" upsell.
export function WidthSelector() {
  const ctx = useWidth();
  if (!ctx || ctx.widths.length < 2) return null;
  const { width: active, setWidth: setActive, widths: sorted, lengthFt } = ctx;
  const has32 = sorted.includes(32);
  const is32 = active === 32;
  const sqft = active * lengthFt;

  return (
    <div className="mt-6 rounded-2xl border border-stone-line bg-stone-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-stone-ink">Choose your section width</span>
        {is32 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            ✦ Extra-large bedrooms
          </span>
        )}
      </div>

      {/* Segmented toggle */}
      <div
        role="group"
        aria-label="Section width"
        className="mt-3 flex gap-1.5 rounded-full bg-stone-sunken p-1"
      >
        {sorted.map((w) => {
          const on = w === active;
          const xl = w === 32;
          return (
            <button
              key={w}
              type="button"
              onClick={() => setActive(w)}
              aria-pressed={on}
              className={
                "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition " +
                (on
                  ? xl
                    ? "bg-amber-500 text-amber-950 shadow-sm"
                    : "bg-brand-700 text-white shadow-sm"
                  : "text-stone-muted hover:text-stone-ink")
              }
            >
              {w}′ wide{xl ? " · XL" : ""}
            </button>
          );
        })}
      </div>

      {/* Live size readout */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold text-brand-700 tabular-nums">
          {sqft.toLocaleString()}
        </span>
        <span className="text-sm text-stone-muted">
          sq ft · {active}′ × {lengthFt}′
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-muted">
        {is32
          ? "The widest layout — every bedroom is noticeably larger than the 28′."
          : "Standard double-wide width."}
      </p>

      {/* "bigger rooms" upsell — only while on the smaller width */}
      {!is32 && has32 && (
        <button
          type="button"
          onClick={() => setActive(32)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-amber-950 transition hover:bg-amber-400"
        >
          ✦ Click here for bigger rooms — see it 32′ wide
          <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}
