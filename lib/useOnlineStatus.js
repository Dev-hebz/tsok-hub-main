'use client';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Listen to online status of multiple UIDs
export function useOnlineStatuses(uids = []) {
  const [statuses, setStatuses] = useState({});

  useEffect(() => {
    if (!uids.length) return;
    const unsubs = uids.map(uid => {
      return onSnapshot(doc(db, 'users', uid), snap => {
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
    return () => unsubs.forEach(u => u());
  }, [uids.join(',')]);

  return statuses;
}

// Format lastSeen time
export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'a while ago';
  const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
