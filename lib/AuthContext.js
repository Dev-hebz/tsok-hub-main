'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set online/offline status
  const setOnlineStatus = async (uid, isOnline) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isOnline,
        lastSeen: serverTimestamp(),
      });
    } catch (err) {
      console.error('Online status error:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (profileDoc.exists()) {
            setUserProfile({ id: profileDoc.id, ...profileDoc.data() });
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
        }
        // Mark online
        setOnlineStatus(firebaseUser.uid, true);
        // Register FCM push token (async, non-blocking)
        if (typeof window !== 'undefined') {
          import('../lib/fcm').then(({ registerFCMToken }) => {
            registerFCMToken(firebaseUser.uid).catch(() => {});
            // Send firebase config to service worker
            navigator.serviceWorker?.ready.then(reg => {
              reg.active?.postMessage({
                type: 'FIREBASE_CONFIG',
                config: {
                  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
                },
              });
            });
          }).catch(() => {});
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle tab/window visibility & close
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      setOnlineStatus(user.uid, document.visibilityState === 'visible');
    };

    const handleBeforeUnload = () => {
      setOnlineStatus(user.uid, false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  const refreshProfile = async () => {
    if (user) {
      try {
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        if (profileDoc.exists()) {
          setUserProfile({ id: profileDoc.id, ...profileDoc.data() });
        }
      } catch (err) {
        console.error('Error refreshing profile:', err);
      }
    }
  };

  const logout = async () => {
    if (user) await setOnlineStatus(user.uid, false);
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
