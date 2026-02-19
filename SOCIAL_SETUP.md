# 🎉 TSOK Community Social Feed - Setup Guide

Developed by **Godmisoft** | © 2026 TSOK

---

## ✅ New Features Added

| Feature | Status |
|---------|--------|
| 🔐 Member Registration / Login | ✅ Ready |
| 📝 Facebook-style News Feed | ✅ Ready |
| 📷 Post with Images (Cloudinary) | ✅ Ready |
| 👍 Real-time Likes | ✅ Ready |
| 💬 Real-time Comments | ✅ Ready |
| 👫 Add Friends / Friend Requests | ✅ Ready |
| 👤 Member Profiles + Profile Picture | ✅ Ready |
| 🖼️ Cover Photo Upload | ✅ Ready |
| ⚙️ Admin Member Management | ✅ Ready |
| 🚫 Post Permission Control (per member) | ✅ Ready |

---

## 🔧 Step 1 — Firebase Setup

### Enable Email/Password Authentication
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Authentication → Sign-in method**
4. Enable **Email/Password**

### Update Firestore Rules
1. Go to **Firestore Database → Rules**
2. Copy the contents of `firestore.rules` and paste it there
3. Click **Publish**

---

## ☁️ Step 2 — Cloudinary Setup

Already configured with:
- **Cloud Name:** `dpcv25eeh`
- **Upload Preset:** `Tsok-Facebook`

### ⚠️ IMPORTANT - Make Upload Preset Unsigned:
1. Go to [Cloudinary Console](https://console.cloudinary.com)
2. Go to **Settings → Upload → Upload Presets**
3. Find `Tsok-Facebook` preset
4. Change **Signing Mode** to **Unsigned**
5. Save changes

---

## 🌐 Step 3 — New Pages / Routes

| Route | Page |
|-------|------|
| `/` | TSOK Portal (with Login/Join buttons) |
| `/login` | Member Login |
| `/register` | New Member Registration |
| `/feed` | Facebook-style Social Feed |
| `/profile/[uid]` | Member Profile Page |
| `/admin` | Admin Panel (Websites + Members) |

---

## 👑 Step 4 — Make Yourself Admin

After registering your account:
1. Go to **Firebase Console → Firestore Database**
2. Open the `users` collection
3. Find your user document
4. Set `isAdmin: true`

After that, you can make other admins from the Admin Panel directly.

---

## 🛡️ Admin Controls Available

From `/admin` → **Members tab**:
- ✅ **Can Post / Blocked** — Toggle posting permission per member
- ★ **Make Admin** — Promote a member to admin
- 🗑️ **Delete** — Remove member account
- 👁️ **View Profile** — See their profile

---

## 📁 New Files Created

```
app/
  login/page.js          ← Login page
  register/page.js       ← Registration page
  feed/page.js           ← Social Feed (main community)
  profile/[uid]/page.js  ← Member profile
  layout.js              ← Updated (AuthProvider added)
  page.js                ← Updated (Community button added)
  admin/page.js          ← Updated (Members management tab)

lib/
  firebase.js            ← Updated (Auth added)
  cloudinary.js          ← NEW (Cloudinary upload helper)
  AuthContext.js         ← NEW (Global auth state)

firestore.rules          ← Updated security rules
```

---

## 🎯 How It Works

### Posting
- Members can post text + optional image
- Images upload to Cloudinary → URL saved in Firestore
- Feed updates in **real-time** (Firestore onSnapshot)

### Comments
- Click "Comment" on any post
- Comments appear in real-time as members type

### Friends
- Click **+ Add** to send friend request
- Notified via 🔔 badge on Requests tab
- Accept/decline friend requests
- Mutual friendship shown on profiles

### Profile
- Click any name/avatar to see their profile
- Upload profile picture + cover photo
- Edit bio, position, school

---

## ⚡ Quick Deploy

```bash
npm install
npm run dev
```

Then: `http://localhost:3000`

---

*Built with ❤️ by Godmisoft for TSOK*
