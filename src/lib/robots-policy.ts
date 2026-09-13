export const privatePaths = [
  "/api/",
  "/portal",
  "/employee",
  "/admin",
  "/uploads/",
  "/private/",
];
export const retrievalBots = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];
export const trainingBots = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
];
export function robotsText() {
  return (
    "# Public search and assistant retrieval allowed; model training disallowed.\nUser-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=no\nAllow: /\n" +
    privatePaths.map((p) => `Disallow: ${p}\n`).join("") +
    "\n" +
    retrievalBots
      .map(
        (bot) =>
          `User-agent: ${bot}\nAllow: /\n${privatePaths.map((p) => `Disallow: ${p}\n`).join("")}\n`,
      )
      .join("") +
    trainingBots.map((bot) => `User-agent: ${bot}\nDisallow: /\n\n`).join("") +
    "Sitemap: https://hplacer.com/sitemap.xml\n"
  );
}
