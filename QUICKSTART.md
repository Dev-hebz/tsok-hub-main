# TSOK HUB - Quick Start Guide

## 🚀 Get Started in 5 Minutes!

### Step 1: Install Dependencies (1 min)
```bash
npm install
```

### Step 2: Setup Firebase (2 min)

1. Go to https://console.firebase.google.com/
2. Create a new project (or select existing)
3. Click "Add app" → Web (</>) icon
4. Register your app with a nickname
5. Copy the Firebase configuration

### Step 3: Configure Environment (1 min)

Create `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123
```

### Step 4: Enable Firestore (30 sec)

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Start in test mode (we'll secure it later)
4. Choose your location
5. Click "Enable"

### Step 5: Run the App! (30 sec)

```bash
npm run dev
```

Open http://localhost:3000 🎉

## 🎯 Next Steps

### Add Your First Website

1. Go to http://localhost:3000/admin
2. Login with password: `tsok2024`
3. Click "Add New Website"
4. Fill in the details:
   - **Title:** Your website name
   - **URL:** https://your-website.com
   - **Description:** Brief description
   - **Category:** education, business, tools, etc.
   - **Card Style:** Choose a gradient
5. Click "Add Website"

### Add Icons (Optional but Recommended)

Create these files in `/public`:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)
- `favicon.ico`
- `apple-icon.png`

Use this tool: https://www.pwabuilder.com/imageGenerator

## 📱 Install as PWA

### On Phone:
1. Open the website
2. Tap browser menu (⋮)
3. Select "Add to Home Screen"

### On Desktop:
1. Open in Chrome/Edge
2. Click install icon in address bar
3. Click "Install"

## 🚀 Deploy to Vercel

### Method 1: GitHub + Vercel (Recommended)

```bash
# Initialize Git
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/yourusername/tsok-hub.git
git push -u origin main
```

Then:
1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repo
4. Add environment variables (same as .env.local)
5. Deploy!

### Method 2: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

## 🔒 Security (Important!)

### Change Admin Password

Edit `/app/admin/page.js`:

```javascript
const ADMIN_PASSWORD = 'your-super-secure-password';
```

### Update Firestore Rules

In Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /websites/{document} {
      allow read: if true;
      allow write: if request.auth != null; // Require auth
    }
  }
}
```

## 💡 Pro Tips

### Custom Styles

You can add custom gradient styles in the admin panel. Use Tailwind CSS classes:

```
bg-gradient-to-br from-purple-500/20 to-pink-500/20
```

### Categories

Create categories based on your needs:
- education
- business
- tools
- entertainment
- resources
- etc.

### Order

Use the `order` field to control the display order:
- 0, 1, 2, 3... (lower numbers appear first)

### Mark as NEW

Toggle the "Mark as NEW" checkbox to show a red "NEW" badge on website cards.

## 🎨 Customization Ideas

1. **Change Logo:** Replace `/public/tsok-logo.png`
2. **Change Colors:** Edit `/app/globals.css` and Tailwind classes
3. **Add More Animations:** Use Framer Motion in components
4. **Custom Categories:** Add filtering logic in `/app/page.js`

## 📞 Need Help?

Check the full README.md for detailed documentation!

---

**Built with ❤️ by Godmisoft**
