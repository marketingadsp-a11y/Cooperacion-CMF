import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import './globals.css';
import { getFirebaseAdmin } from '@/firebase/admin';
import { getDoc, doc } from 'firebase/firestore';
import type { AppSettings } from '@/lib/types';


export async function generateMetadata(): Promise<Metadata> {
  // Use a static default logo to prevent server-side fetch errors during metadata generation.
  // The PWA manifest will still attempt to fetch the dynamic logo.
  const pwaLogoUrl = 'https://i.ibb.co/JWfQGf4d/logo-coperacion-cmf.jpg';

  return {
    title: 'Cooperación CMF',
    description: 'Gestiona las contribuciones y finanzas de la comunidad.',
    manifest: '/manifest.webmanifest',
    icons: {
      icon: pwaLogoUrl,
      apple: pwaLogoUrl,
    },
  };
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Exo+2:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className={cn('font-body antialiased')}>
        <FirebaseClientProvider>
          <AppLayout>{children}</AppLayout>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
