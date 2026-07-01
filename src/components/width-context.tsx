"use client";

import { createContext, useContext, useMemo, useState } from "react";

type WidthCtx = {
  width: number;
  setWidth: (w: number) => void;
  widths: number[];
  lengthFt: number;
};

const Ctx = createContext<WidthCtx | null>(null);

// Holds the selected section width for a model-detail page so the summary
// width toggle and the floor-plan section stay in sync. Wraps server-rendered
// children; client consumers (WidthSelector, FloorPlanSection) read it.
export function WidthProvider({
  widths,
  lengthFt,
  children,
}: {
  widths: number[];
  lengthFt: number;
  children: React.ReactNode;
}) {
  const sorted = useMemo(() => [...new Set(widths)].sort((a, b) => a - b), [widths]);
  const [width, setWidth] = useState(sorted[0]);
  const value = useMemo(
    () => ({ width, setWidth, widths: sorted, lengthFt }),
    [width, sorted, lengthFt],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWidth(): WidthCtx | null {
  return useContext(Ctx);
}
