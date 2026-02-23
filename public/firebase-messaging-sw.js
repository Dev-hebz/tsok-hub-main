// Firebase Cloud Messaging Service Worker
// ⚠️ IMPORTANT: Replace the config values below with your actual Firebase config
// Copy from: Firebase Console → Project Settings → Your apps → Web app config
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ── Hardcode Firebase config here (env vars not available in SW) ──
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCIjCTG5s68AO6sjfU-jddot4kl6fesORA",
  authDomain: "tsok-learning-platform.firebaseapp.com",
  projectId: "tsok-learning-platform",
  storageBucket: "tsok-learning-platform.firebasestorage.app",
  messagingSenderId: "422646066024",
  appId: "1:422646066024:web:1cccfc8828fa2c32e1c4dd",
};

// Initialize Firebase immediately (not waiting for message from page)
try {
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
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
  console.error('[SW] Firebase init error:', e);
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};

  if (event.action === 'decline') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(c => c.postMessage({ type: 'SW_DECLINE_CALL', callId: d.callId }));
      })
    );
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: d });
          return;
        }
      }
      clients.openWindow('/chat');
    })
  );
});
