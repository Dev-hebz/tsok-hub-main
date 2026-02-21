# Push Notifications Setup Guide

## Step 1: Get VAPID Key (FCM Web Push)
1. Go to Firebase Console → Your Project
2. Project Settings (⚙️) → Cloud Messaging tab
3. Scroll to "Web configuration" section
4. Click "Generate key pair" under Web Push certificates
5. Copy the Key pair value
6. Add to Vercel env vars: `NEXT_PUBLIC_FIREBASE_VAPID_KEY=<your key>`

## Step 2: Get Firebase Admin Service Account
1. Firebase Console → Project Settings → Service accounts tab
2. Click "Generate new private key" → Download JSON file
3. Open the JSON file, copy ALL contents
4. Minify it (one line) — use https://jsonformatter.org/json-minify
5. Add to Vercel env vars: `FIREBASE_SERVICE_ACCOUNT_JSON=<minified json>`

## Step 3: Add Vercel Environment Variables
In Vercel Dashboard → Your Project → Settings → Environment Variables, add:
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` 
- `FIREBASE_SERVICE_ACCOUNT_JSON`

## Step 4: Enable Cloud Messaging API
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Select your Firebase project
3. APIs & Services → Enable APIs
4. Search "Firebase Cloud Messaging API" → Enable it

## How it works
- When user logs in → browser asks permission for notifications
- FCM token saved to user's Firestore document (fcmTokens array)
- When someone sends a message → /api/notify called → FCM sends push
- When someone calls → push notification with "Accept / Decline" buttons
- Service Worker handles background notifications

## Platform notes
- ✅ Android Chrome: Full support (notifications + call ring)  
- ✅ Desktop Chrome/Edge: Full support
- ⚠️ iOS Safari 16.4+: Must be added to home screen first
- ❌ iOS Safari < 16.4: Not supported
