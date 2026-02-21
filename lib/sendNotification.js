'use client';

// Send push notification via Vercel API
export async function sendNotification({ recipientUid, type, senderName, message, callId, groupName }) {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientUid, type, senderName, message, callId, groupName }),
    });
  } catch (err) {
    console.error('Send notification error:', err);
  }
}
