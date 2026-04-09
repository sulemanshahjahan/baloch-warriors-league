// BWL Push Notification Service Worker

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: "/logo.png",
      badge: "/logo.png",
      tag: data.tag || "bwl-notification",
      renotify: true,
      data: { url: data.url || "/" },
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(data.title || "BWL", options));
  } catch (e) {
    console.error("Push parse error:", e);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing BWL tab if open
      for (const client of windowClients) {
        if (client.url.includes("bwlleague.com") || client.url.includes("localhost")) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});
