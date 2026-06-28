"use client";

import { useEffect } from "react";
import { captureFirstTouch } from "@/lib/attribution";

// Invisible: records first-touch attribution once on the initial page load.
// Mounted site-wide via the footer (which is in the root layout) so capture runs
// on whatever page the visitor first lands on — before they ever reach a form.
// Renders nothing.
export function AttributionTracker() {
  useEffect(() => {
    captureFirstTouch();
  }, []);
  return null;
}
