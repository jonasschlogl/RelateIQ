// RelateIQ service worker — exists solely to receive Web Push events and
// show a notification for them. Deliberately does NOT do any asset caching
// or offline-first behavior: express.static already serves everything with
// Cache-Control: no-store (see server.js), and adding a cache layer here
// would fight that and risk showing stale pages. If offline support is
// ever wanted, that's a separate, deliberate addition — not a side effect
// of adding push.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "RelateIQ", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "RelateIQ";
  const options = {
    body: data.body || "",
    icon: "/favicon-32.png",
    badge: "/favicon-32.png",
    data: { url: data.url || "/dashboard.html" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Focus an already-open RelateIQ tab rather than piling up new ones.
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
