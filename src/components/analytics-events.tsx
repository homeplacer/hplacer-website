"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track, modelSlugFromPath } from "@/lib/analytics";
function linkPlacement(link: Element) {
  if (link.closest("[data-contact-bar]")) return "contact_bar";
  if (link.closest("header")) return "header";
  if (link.closest("footer")) return "footer";
  return "main_content";
}
export function AnalyticsEvents() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    track("page_view");
    const model = modelSlugFromPath(pathname);
    if (model) track("view_model", { model_context: model });
    if (pathname.startsWith("/packages/")) track("view_package");
    if (pathname.startsWith("/guides/")) track("guide_view");
    if (pathname === "/financing") track("view_financing");
  }, [pathname]);
  useEffect(() => {
    const started = new WeakSet<HTMLFormElement>();
    const onFocus = (event: FocusEvent) => {
      const target = event.target as Element | null;
      const form = target?.closest?.("form");
      if (!form || started.has(form)) return;
      started.add(form);
      const formType = form.dataset.formType || "inquiry";
      track("form_start", { form_type: formType });
      if (form.querySelector('input[name="packageId"]'))
        track("package_inquiry", { form_type: formType });
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      const placement = linkPlacement(link);
      if (href.startsWith("tel:")) {
        track("phone_call", { placement });
        return;
      }
      if (href.startsWith("sms:")) {
        track("text_message", { placement });
        return;
      }
      if (href.startsWith("mailto:")) {
        track("email_click", { placement });
        return;
      }
      try {
        const destination = new URL(href, window.location.origin);
        if (destination.origin === window.location.origin) {
          const model = modelSlugFromPath(destination.pathname);
          if (model) track("select_model", { model_context: model, placement });
          if (destination.hash === "#get-price")
            track("pricing_inquiry", {
              placement,
              model_context: modelSlugFromPath(window.location.pathname) || "",
            });
          if (destination.pathname === "/financing")
            track("financing_click", { placement });
          if (destination.pathname === "/find-land")
            track("land_search_click", { placement });
        }
        if (link.hasAttribute("data-land-handoff"))
          track("land_handoff", { placement, destination: "forturro.com" });
        // Existing-inventory resale handoff (PR120's three Forturro links). The
        // frontend marks each link with data-existing-inventory="all|owned_land|
        // leased_land"; we emit ONLY that enum + placement — never the href, query,
        // or referrer. track() drops any value outside the inventory_type allowlist.
        const inventoryType = link.getAttribute("data-existing-inventory");
        if (inventoryType)
          track("existing_inventory_handoff", { inventory_type: inventoryType, placement });
      } catch {
        /* Invalid links must not interrupt navigation. */
      }
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
