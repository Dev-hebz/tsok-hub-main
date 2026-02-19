# TSOK HUB - Dynamic Website Hub

A modern, animated Progressive Web App (PWA) that serves as a central hub for all TSOK websites and applications.

## 🌟 Features

- ✨ **Fully Animated UI** - Smooth transitions and eye-catching animations using Framer Motion
- 📱 **PWA Ready** - Installable on mobile and desktop with offline support
- 🔥 **Firebase Backend** - Dynamic content management with Firestore
- 🎨 **Customizable Styles** - Each website card can have unique gradient styles
- 🔍 **Search & Filter** - Easy navigation through categories and search
- 👨‍💼 **Admin Panel** - Add, edit, and delete websites dynamically
- 🎯 **Responsive Design** - Works perfectly on all devices
- 🚀 **Fast & Optimized** - Built with Next.js 14 for maximum performance

## 📋 Prerequisites

- Node.js 18+ installed
- Firebase account
- Git and GitHub account
- Vercel account (for deployment)

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd tsok-hub
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable Firestore Database
4. Go to Project Settings → General → Your apps
5. Create a Web App and copy the configuration

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 5. Setup Firestore Database

In Firebase Console:
1. Go to Firestore Database
2. Create a collection named `websites`
3. Set security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /websites/{document} {
      allow read: if true;
      allow write: if true; // Change this for production
    }
  }
}
```

### 6. Add Logo and Icons

1. Copy your TSOK logo to `/public/tsok-logo.png`
2. Create PWA icons:
   - `/public/icon-192.png` (192x192)
   - `/public/icon-512.png` (512x512)
   - `/public/favicon.ico`
   - `/public/apple-icon.png`

You can use online tools like [PWA Asset Generator](https://www.pwabuilder.com/) to create these.

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🚀 Deployment to Vercel

### Via GitHub

1. Push your code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

2. Go to [Vercel Dashboard](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Add environment variables in Vercel:
   - Go to Settings → Environment Variables
   - Add all your `NEXT_PUBLIC_FIREBASE_*` variables

6. Deploy!

### Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
```

## 📱 Admin Panel

Access the admin panel at `/admin`

**Default Password:** `tsok2024`

⚠️ **Important:** Change the password in `/app/admin/page.js`:

```javascript
const ADMIN_PASSWORD = 'your-secure-password';
```

### Admin Features

- Add new websites
- Edit existing websites
- Delete websites
- Customize card styles
- Mark websites as "NEW"
- Reorder websites
- Set categories

## 🎨 Customization

### Card Style Options

- Default (Blue)
- Purple Pink
- Green
- Orange Red
- Yellow
- Cyan Blue
- Rose Pink
- Indigo Purple

### Adding Custom Styles

Edit the `styleOptions` array in `/app/admin/page.js`:

```javascript
{
  value: 'bg-gradient-to-br from-color1 to-color2',
  label: 'Your Style Name'
}
```

## 📊 Database Structure

Each website document in Firestore:

```javascript
{
  title: "Website Name",
  description: "Website description",
  url: "https://example.com",
  icon: "https://example.com/icon.png", // Optional
  category: "education",
  order: 0,
  isNew: false,
  style: "bg-gradient-to-br from-white/10 to-white/5"
}
```

## 🔒 Security Recommendations for Production

1. **Change Admin Password**
   - Use a strong, unique password
   - Consider implementing Firebase Authentication

2. **Update Firestore Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /websites/{document} {
         allow read: if true;
         allow write: if request.auth != null; // Require authentication
       }
     }
   }
   ```

3. **Environment Variables**
   - Never commit `.env.local` to Git
   - Use Vercel's environment variables

## 📱 Installing as PWA

### On Mobile (Android/iOS)

1. Visit the website
2. Tap the share button
3. Select "Add to Home Screen"

### On Desktop (Chrome/Edge)

1. Visit the website
2. Click the install icon in the address bar
3. Click "Install"

## 🛠️ Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 📦 Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Database:** Firebase Firestore
- **Deployment:** Vercel
- **PWA:** Next.js PWA capabilities

## 🐛 Troubleshooting

### Icons not showing
- Make sure icons are in the `/public` folder
- Check the manifest.json file
- Clear browser cache

### Firebase connection issues
- Verify environment variables
- Check Firebase project settings
- Ensure Firestore is enabled

### PWA not installing
- Must be served over HTTPS (Vercel provides this)
- Check manifest.json is accessible
- Verify service worker registration

## 📞 Support

For issues or questions:
- Email: godmisoft@gmail.com
- Created by: **Godmisoft**

## 📄 License

© 2024 TSOK - Teachers Specialists Organization Kuwait. All rights reserved.

---

**Developed by Godmisoft** 🚀
