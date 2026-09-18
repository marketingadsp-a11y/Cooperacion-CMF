import type { MetadataRoute } from 'next';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Cooperación';
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'CMF';
  const fullTitle = `${appName} ${companyName}`.trim();
  const pwaLogoUrl = process.env.NEXT_PUBLIC_PWA_LOGO_URL || 'https://i.ibb.co/JWfQGf4d/logo-coperacion-cmf.jpg';

  return {
    name: fullTitle,
    short_name: fullTitle,
    description: `Gestiona las contribuciones y finanzas de ${fullTitle}.`,
    start_url: '/',
    display: 'standalone',
    background_color: '#fff',
    theme_color: '#6d28d9', // primary color
    icons: [
      {
        src: pwaLogoUrl,
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
      {
        src: pwaLogoUrl,
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
  };
}
