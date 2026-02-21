// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Config will be injected by the app, but we need it here too
// These are public keys, safe to include in SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const config = event.data.config;
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      const { title, body, icon, data } = payload.notification || payload.data || {};
      
      const notifTitle = title || 'TSOK Hub';
      const notifOptions = {
        body: body || 'You have a new notification',
        icon: icon || '/tsok-logo.png',
        badge: '/tsok-logo.png',
        data: data || {},
        vibrate: data?.type === 'call' ? [300, 100, 300, 100, 300] : [200],
        tag: data?.type === 'call' ? 'incoming-call' : 'new-message',
        renotify: true,
        requireInteraction: data?.type === 'call', // Call notif stays until dismissed
        actions: data?.type === 'call'
          ? [
              { action: 'accept', title: '✅ Accept' },
              { action: 'decline', title: '❌ Decline' },
            ]
          : [{ action: 'open', title: '💬 Open' }],
      };

      self.registration.showNotification(notifTitle, notifOptions);
    });
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  
  let url = '/feed';
  if (data.type === 'message') url = '/chat';
  if (data.type === 'call') url = '/chat';

  if (event.action === 'decline') return; // Just close

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});
