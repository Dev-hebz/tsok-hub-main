'use client';

export async function registerFCMToken(userId) {
  if (typeof window === 'undefined') return null;
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // Register SW
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    // Send Firebase config to SW so it can init firebase messaging for background notifications
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const sw = registration.active || registration.waiting || registration.installing;
    if (sw) {
      sw.postMessage({ type: 'FIREBASE_CONFIG', config });
    }
    // Also send when SW becomes active
    registration.addEventListener('updatefound', () => {
      const newSW = registration.installing;
      newSW?.addEventListener('statechange', () => {
        if (newSW.state === 'activated') {
          newSW.postMessage({ type: 'FIREBASE_CONFIG', config });
        }
      });
    });

    // Get FCM token
    const { getMessaging, getToken } = await import('firebase/messaging');
    const { app } = await import('./firebase');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      await updateDoc(doc(db, 'users', userId), { fcmTokens: arrayUnion(token) });
      console.log('[FCM] Token registered');
      return token;
    }
  } catch (err) {
    console.error('[FCM] Registration error:', err);
  }
  return null;
}

export async function removeFCMToken(userId) {
  if (typeof window === 'undefined') return;
  try {
    const { getMessaging, deleteToken } = await import('firebase/messaging');
    const { app } = await import('./firebase');
    const messaging = getMessaging(app);
    await deleteToken(messaging);
  } catch (err) {
    console.error('[FCM] Remove token error:', err);
  }
}
