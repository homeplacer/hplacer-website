// IndexNow — instantly notify Bing, Yandex, DuckDuckGo, Seznam (and the shared
// IndexNow network) of our live URLs so new/changed pages get crawled in hours,
// not weeks. hplacer.com is a Cloudflare zone we control, so we host an ownership
// key file at /<KEY>.txt and POST the URL list to the IndexNow API.
//
// Usage:
//   node scripts/indexnow.mjs            # submit every live URL from the sitemap
//   node scripts/indexnow.mjs <url>...   # submit only the given URLs
//
// Run after a deploy (the blog auto-publish task calls this so each newly-
// published post pings IndexNow the morning it goes live).

const HOST = "hplacer.com";
const KEY = "e0e445eaf75d61f3faee17b699eca3b9";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

async function sitemapUrls() {
  const res = await fetch(`https://${HOST}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap fetch ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function submit(urlList) {
  // IndexNow caps a single submission at 10,000 URLs — we're far under.
  const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  // 200/202 = accepted; 422 = a URL didn't match host; 403 = key not found yet.
  return { status: res.status, text: await res.text().catch(() => "") };
}

const args = process.argv.slice(2);
const urls = args.length ? args : await sitemapUrls();
if (!urls.length) {
  console.error("IndexNow: no URLs to submit");
  process.exit(1);
}
const { status, text } = await submit(urls);
console.log(`IndexNow: submitted ${urls.length} URLs → HTTP ${status}${text ? " " + text : ""}`);
if (status >= 400) process.exit(1);
