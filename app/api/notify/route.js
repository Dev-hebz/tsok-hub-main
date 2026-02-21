// Vercel API Route — sends FCM push notification
// Called by client when a message or call is sent

export async function POST(request) {
  try {
    const body = await request.json();
    const { recipientUid, type, senderName, message, callId, groupName } = body;

    if (!recipientUid || !type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get Firebase Admin (server-side)
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    // Get recipient's FCM tokens
    const userDoc = await db.collection('users').doc(recipientUid).get();
    if (!userDoc.exists) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const fcmTokens = userDoc.data().fcmTokens || [];
    if (!fcmTokens.length) {
      return Response.json({ message: 'No FCM tokens for user' }, { status: 200 });
    }

    // Build notification payload
    let notification, data;
    if (type === 'message') {
      notification = {
        title: senderName || 'New Message',
        body: message || 'You have a new message',
      };
      data = { type: 'message', senderName: senderName || '' };
    } else if (type === 'call') {
      notification = {
        title: `📹 ${senderName} is calling`,
        body: 'Incoming video call — tap to answer',
      };
      data = { type: 'call', callId: callId || '', senderName: senderName || '' };
    } else if (type === 'group_message') {
      notification = {
        title: groupName || 'Group Message',
        body: `${senderName}: ${message || 'New message'}`,
      };
      data = { type: 'message', groupName: groupName || '', senderName: senderName || '' };
    }

    // Send to all tokens, remove invalid ones
    const messaging = admin.messaging();
    const results = await Promise.allSettled(
      fcmTokens.map(token =>
        messaging.send({
          token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data,
          webpush: {
            notification: {
              icon: '/tsok-logo.png',
              badge: '/tsok-logo.png',
              vibrate: type === 'call' ? [300, 100, 300, 100, 300] : [200],
              requireInteraction: type === 'call',
              actions: type === 'call'
                ? [
                    { action: 'accept', title: '✅ Accept' },
                    { action: 'decline', title: '❌ Decline' },
                  ]
                : [],
            },
            fcmOptions: { link: type === 'call' ? '/chat' : '/chat' },
          },
          android: {
            priority: 'high',
            notification: {
              sound: type === 'call' ? 'ringtone' : 'default',
              channelId: type === 'call' ? 'calls' : 'messages',
            },
          },
        })
      )
    );

    // Clean up invalid tokens
    const invalidTokens = [];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const err = result.reason;
        if (
          err?.code === 'messaging/registration-token-not-registered' ||
          err?.code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(fcmTokens[idx]);
        }
      }
    });

    if (invalidTokens.length) {
      await db.collection('users').doc(recipientUid).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
    }

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return Response.json({ success: true, sent, total: fcmTokens.length });

  } catch (err) {
    console.error('Notify API error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Initialize Firebase Admin lazily
let adminApp = null;
async function getFirebaseAdmin() {
  if (adminApp) return adminApp;

  const admin = await import('firebase-admin');
  
  if (!admin.default.apps.length) {
    // Parse service account from env var
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'
    );

    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
    });
  }

  adminApp = admin.default;
  return adminApp;
}
