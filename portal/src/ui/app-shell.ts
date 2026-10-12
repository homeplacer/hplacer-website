/**
 * Static files for the installed (Home Screen) portal app: the web app
 * manifest, the service worker, and the phone-alert opt-in script.
 *
 * They are served by the Worker behind Cloudflare Access like every other
 * route. The service worker has no `fetch` handler: it never caches employee
 * pages and never stands between a navigation and Access sign-in.
 */

export const WEB_APP_MANIFEST = JSON.stringify({
  id: "/",
  name: "Home Placer Portal",
  short_name: "HP Portal",
  description: "Home Placer employee operations portal",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#f4f5f7",
  theme_color: "#16457a",
  icons: [
    { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  ],
});

/**
 * Service worker. Every push shows a notification immediately from the
 * encrypted payload alone — WebKit revokes push permission from apps that
 * receive pushes without showing one, and the payload must work while the
 * Access session is expired, so nothing here fetches from the portal.
 */
export const SERVICE_WORKER_JS = `"use strict";
const FALLBACK_PATH = "/notifications";

function safePath(value) {
  if (typeof value !== "string" || value.length > 512 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\\\")) {
    return FALLBACK_PATH;
  }
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return FALLBACK_PATH;
    return url.pathname + url.search;
  } catch (error) {
    return FALLBACK_PATH;
  }
}

function text(value, fallback, max) {
  return typeof value === "string" && value.trim() ? value.slice(0, max) : fallback;
}

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }
  if (!data || typeof data !== "object") data = {};
  const tag = typeof data.tag === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(data.tag) ? data.tag : "home-placer";
  event.waitUntil(self.registration.showNotification(text(data.title, "Home Placer", 80), {
    body: text(data.body, "You have a new portal notification.", 200),
    tag,
    icon: "/app-icon-192.png",
    data: { url: safePath(data.url) },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  // A plain same-origin navigation: if the Access session has expired, the
  // normal sign-in runs and returns to this address.
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url === target && "focus" in client) return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});
`;

/**
 * Opt-in script for the notifications page. Subscribing happens directly in
 * the tap handler: Safari only shows the permission prompt from a user gesture.
 */
export const PUSH_CLIENT_JS = `"use strict";
(() => {
  const root = document.getElementById("push-panel");
  if (!root) return;
  const status = root.querySelector("[data-push-status]");
  const buttons = {
    on: root.querySelector("[data-push-on]"),
    claim: root.querySelector("[data-push-claim]"),
    test: root.querySelector("[data-push-test]"),
    off: root.querySelector("[data-push-off]"),
  };
  const publicKey = root.getAttribute("data-public-key") || "";
  let registration = null;

  function say(message) { if (status) status.textContent = message; }
  function only(...visible) {
    for (const [name, button] of Object.entries(buttons)) if (button) button.hidden = !visible.includes(name);
  }
  function keyBytes(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }
  function subscriptionBody(subscription) {
    const json = subscription.toJSON();
    return { endpoint: json.endpoint, p256dh: json.keys && json.keys.p256dh, auth: json.keys && json.keys.auth };
  }
  async function api(path, body) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (response.type === "opaqueredirect") throw new Error("Your sign-in has expired. Reload this page and try again.");
    let data = null;
    try { data = await response.json(); } catch (error) { data = null; }
    if (!response.ok) throw new Error((data && data.message) || "The portal could not save that. Try again.");
    return data;
  }
  function failed(error) {
    say(error && error.message ? error.message : "Something went wrong. Try again.");
  }

  function setOn(message) { only("test", "off"); say(message || "Phone alerts are on for this device."); }
  function setOff(message) { only("on"); say(message || "Phone alerts are off for this device."); }

  async function start() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      only();
      say(appleMobile && !standalone
        ? "On iPhone, add the portal to your Home Screen first (Share, then Add to Home Screen), then open it from the Home Screen icon and come back here."
        : "This browser cannot receive portal alerts.");
      return;
    }
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    registration = await navigator.serviceWorker.ready;
    if (Notification.permission === "denied") {
      only();
      say("Notifications are blocked for the portal. Allow them in Settings, then reload this page.");
      return;
    }
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return setOff();
    const check = await api("/api/push/subscriptions/check", { endpoint: subscription.endpoint });
    if (check && check.registered) return setOn();
    only("claim");
    say("This device is not sending alerts to your account. Someone else may have used it. Tap below to get your alerts here.");
  }

  if (buttons.on) buttons.on.addEventListener("click", () => {
    if (!registration) return;
    buttons.on.disabled = true;
    // Called directly in the tap so Safari can show its permission prompt.
    registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
      .then((subscription) => api("/api/push/subscriptions", subscriptionBody(subscription)))
      .then(() => setOn("Phone alerts are on. Send a test alert to check."))
      .catch((error) => {
        if (window.Notification && Notification.permission === "denied") {
          only();
          say("Notifications are blocked for the portal. Allow them in Settings, then reload this page.");
        } else failed(error);
      })
      .finally(() => { buttons.on.disabled = false; });
  });

  if (buttons.claim) buttons.claim.addEventListener("click", () => {
    if (!registration) return;
    buttons.claim.disabled = true;
    registration.pushManager.getSubscription()
      .then((subscription) => {
        if (!subscription) return setOff();
        return api("/api/push/subscriptions", subscriptionBody(subscription)).then(() => setOn("This device now sends alerts to your account only."));
      })
      .catch(failed)
      .finally(() => { buttons.claim.disabled = false; });
  });

  if (buttons.test) buttons.test.addEventListener("click", () => {
    buttons.test.disabled = true;
    say("Sending a test alert…");
    api("/api/push/test", {})
      .then((result) => say(result && result.sent > 0
        ? "Test alert sent to " + result.sent + " device" + (result.sent === 1 ? "" : "s") + ". It should appear in a few seconds."
        : "The test alert could not be delivered. Turn alerts off and on again on this device."))
      .catch(failed)
      .finally(() => { buttons.test.disabled = false; });
  });

  if (buttons.off) buttons.off.addEventListener("click", () => {
    if (!registration) return;
    buttons.off.disabled = true;
    registration.pushManager.getSubscription()
      .then(async (subscription) => {
        if (!subscription) return;
        try { await api("/api/push/subscriptions/remove", { endpoint: subscription.endpoint }); }
        finally { await subscription.unsubscribe(); }
      })
      .then(() => setOff())
      .catch(failed)
      .finally(() => { buttons.off.disabled = false; });
  });

  start().catch(failed);
})();
`;
