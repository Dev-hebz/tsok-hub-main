// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

let messagingReady = false;

function initMessaging(config) {
  if (messagingReady) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(config);
    const messaging = firebase.messaging();
    messagingReady = true;

    messaging.onBackgroundMessage((payload) => {
      // FCM sends notification in payload.notification OR payload.data
      const n = payload.notification || {};
      const d = payload.data || {};
      const isCall = d.type === 'call';

      const title = n.title || d.title || 'TSOK Hub';
      const body  = n.body  || d.body  || 'New notification';

      self.registration.showNotification(title, {
        body,
        icon: '/tsok-logo.png',
        badge: '/tsok-logo.png',
        data: d,
        vibrate: isCall ? [500, 200, 500, 200, 500] : [200, 100, 200],
        tag: isCall ? 'incoming-call' : 'new-message',
        renotify: true,
        requireInteraction: isCall,
        silent: false,
        actions: isCall
          ? [{ action: 'accept', title: '✅ Answer' }, { action: 'decline', title: '❌ Decline' }]
          : [{ action: 'open', title: '💬 Open Chat' }],
      });
    });
  } catch (e) {
    console.error('[SW] Init error:', e);
  }
}

// Receive Firebase config from app after registration
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    initMessaging(event.data.config);
  }
});

// Handle notification action clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const isCall = d.type === 'call';

  if (event.action === 'decline') {
    // Tell open clients to decline call
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(c => c.postMessage({ type: 'SW_DECLINE_CALL', callId: d.callId }));
      })
    );
    return;
  }

  const url = '/chat';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: d });
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});
