'use client';

// Register FCM token for this device and save to Firestore
export async function registerFCMToken(userId) {
  if (typeof window === 'undefined') return null;
  
  try {
    // Check browser support
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('Push notifications not supported');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    // Dynamically import FCM
    const { getMessaging, getToken } = await import('firebase/messaging');
    const { app } = await import('./firebase');

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      // Save token to Firestore
      const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      await updateDoc(doc(db, 'users', userId), {
        fcmTokens: arrayUnion(token),
      });
      console.log('FCM token registered');
      return token;
    }
  } catch (err) {
    console.error('FCM registration error:', err);
  }
  return null;
}

// Remove FCM token on logout
export async function removeFCMToken(userId) {
  if (typeof window === 'undefined') return;
  try {
    const { getMessaging, getToken, deleteToken } = await import('firebase/messaging');
    const { app } = await import('./firebase');
    const messaging = getMessaging(app);
    await deleteToken(messaging);

    // Token cleanup handled by backend (we don't need exact token here)
  } catch (err) {
    console.error('FCM remove token error:', err);
  }
}
