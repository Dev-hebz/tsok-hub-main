'use client';
import { useState, useEffect, useMemo } from 'react';

export function useOnlineStatuses(uids = []) {
  const [statuses, setStatuses] = useState({});
  const uidKey = useMemo(() => uids.join(','), [uids.join(',')]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!uids.length) return;

    let cancelled = false;

    // Dynamically import firebase to avoid SSR issues
    const setup = async () => {
      try {
        const { doc, onSnapshot } = await import('firebase/firestore');
        const { db } = await import('./firebase');

        const unsubs = uids.map(uid => {
          return onSnapshot(doc(db, 'users', uid), snap => {
            if (cancelled) return;
            if (snap.exists()) {
              const data = snap.data();
              setStatuses(prev => ({
                ...prev,
                [uid]: {
                  isOnline: data.isOnline || false,
                  lastSeen: data.lastSeen,
                }
              }));
            }
          });
        });

        return () => {
          cancelled = true;
          unsubs.forEach(u => u());
        };
      } catch (err) {
        console.error('useOnlineStatuses error:', err);
      }
    };

    let cleanup;
    setup().then(fn => { cleanup = fn; });
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [uidKey]);

  return statuses;
}

export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'a while ago';
  try {
    const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return 'a while ago';
  }
}
