import type { MetadataRoute } from 'next';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const pwaLogoUrl = 'https://i.ibb.co/JWfQGf4d/logo-coperacion-cmf.jpg';

  return {
    name: 'Cooperación CMF',
    short_name: 'Cooperación CMF',
    description: 'Gestiona las contribuciones y finanzas de la comunidad.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff',
    theme_color: '#6d28d9', // primary color
    icons: [
      {
        src: pwaLogoUrl,
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'any maskable',
      },
      {
        src: pwaLogoUrl,
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any maskable',
      },
    ],
  };
}
