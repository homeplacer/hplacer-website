/** Observe stable inline form regions, including forms mounted after hydration.
 * Native dialogs handle their own top-layer containment and are not page forms.
 * This is customer-facing visibility only; it does not collect or track data.
 */
export function observeInlineFormVisibility(
  root: HTMLElement,
  onVisibility: (visible: boolean) => void,
): () => void {
  if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined")
    return () => {};
  const observed = new Set<Element>();
  const visible = new Set<Element>();
  const selector = "[data-form-region], form";
  const isInlineRegion = (element: Element) => !element.closest("dialog") &&
    !(element.tagName === "FORM" && element.closest("[data-form-region]"));
  const intersection = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!observed.has(entry.target)) continue;
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    onVisibility(visible.size > 0);
  }, { threshold: 0.2 });

  const reconcile = () => {
    const current = new Set([...root.querySelectorAll(selector)].filter(isInlineRegion));
    let removed = false;
    for (const element of observed) {
      if (current.has(element)) continue;
      intersection.unobserve(element);
      observed.delete(element);
      visible.delete(element);
      removed = true;
    }
    for (const element of current) {
      if (observed.has(element)) continue;
      observed.add(element);
      intersection.observe(element);
    }
    // A client-side route change can remove the only visible form.
    if (removed) onVisibility(visible.size > 0);
  };
  reconcile();
  const mutation = new MutationObserver((records) => {
    // Hydration, status messages, images, and dialogs mutate the document too.
    // Only rescan the page when an actual inline region appears or disappears.
    const addedInlineRegion = records.some((record) => [...record.addedNodes].some((node) => {
      if (node.nodeType !== 1) return false;
      const element = node as Element;
      if (element.closest("dialog")) return false;
      return (element.matches(selector) && isInlineRegion(element)) ||
        [...element.querySelectorAll(selector)].some(isInlineRegion);
    }));
    if (addedInlineRegion || [...observed].some((element) => !root.contains(element) || !isInlineRegion(element))) reconcile();
  });
  mutation.observe(root, { childList: true, subtree: true });
  return () => {
    mutation.disconnect();
    intersection.disconnect();
    observed.clear();
    visible.clear();
  };
}
