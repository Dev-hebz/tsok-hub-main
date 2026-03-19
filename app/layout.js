import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../lib/AuthContext';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300','400','500','600','700'], variable: '--font-dm-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700','900'], variable: '--font-playfair' });

export const metadata = {
  title: 'TSOK Portal - Teachers-Specialists Organization Kuwait',
  description: 'Central portal for all TSOK websites and applications',
  manifest: '/manifest.json',
  themeColor: '#1e3a8a',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TSOK Portal'
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e3a8a'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${dmSans.variable} ${playfair.variable} ${dmSans.className}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
