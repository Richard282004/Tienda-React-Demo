import type { MetadataRoute } from 'next';
import { fetchSiteMeta } from '@/lib/site-meta';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const meta = await fetchSiteMeta();
  return {
    name: meta.brandName,
    short_name: meta.brandName,
    description: meta.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#fffcf8',
    theme_color: meta.themeColor,
    lang: 'es-CL',
    icons: [
      { src: meta.faviconUrl || '/favicon.svg', type: meta.faviconUrl ? undefined : 'image/svg+xml', sizes: 'any', purpose: 'any' },
      { src: meta.faviconUrl || '/favicon.svg', type: meta.faviconUrl ? undefined : 'image/svg+xml', sizes: 'any', purpose: 'maskable' },
    ],
  };
}
