/** Form context belongs in a fragment, not a separately crawlable contact URL. */
export function contactContextHref(homeName: string): string {
  return homeName.trim()
    ? `/contact#home=${encodeURIComponent(homeName)}`
    : "/contact";
}

function homeParameter(parameters: string): string | undefined {
  // Decode the selected field explicitly so malformed percent escapes do not
  // turn into broken prefilled model names. Other URL fields are left alone.
  for (const parameter of parameters.split("&")) {
    const separator = parameter.indexOf("=");
    const key = separator < 0 ? parameter : parameter.slice(0, separator);
    try {
      if (decodeURIComponent(key.replaceAll("+", " ")) !== "home") continue;
      if (separator < 0) return undefined;
      const home = decodeURIComponent(
        parameter.slice(separator + 1).replaceAll("+", " "),
      );
      return home.trim() ? home : undefined;
    } catch {
      // A malformed or unrelated field must never stop the contact form.
      if (key === "home") return undefined;
    }
  }
  return undefined;
}

/** Keep shared/bookmarked legacy ?home= links working during the transition. */
export function contactHomeFromLocation(location: {
  hash: string;
  search: string;
}): string | undefined {
  return (
    homeParameter(location.hash.replace(/^#/, "")) ??
    homeParameter(location.search.replace(/^\?/, ""))
  );
}
