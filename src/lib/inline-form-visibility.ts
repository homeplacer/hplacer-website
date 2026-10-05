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
  const intersection = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!observed.has(entry.target)) continue;
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    onVisibility(visible.size > 0);
  }, { threshold: 0.2 });

  const reconcile = () => {
    const current = new Set([...root.querySelectorAll("[data-form-region], form")].filter((element) =>
      !element.closest("dialog") &&
      !(element.tagName === "FORM" && element.closest("[data-form-region]")),
    ));
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
  const mutation = new MutationObserver(reconcile);
  mutation.observe(root, { childList: true, subtree: true });
  return () => {
    mutation.disconnect();
    intersection.disconnect();
    observed.clear();
    visible.clear();
  };
}
