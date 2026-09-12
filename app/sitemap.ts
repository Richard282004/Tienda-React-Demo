import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

export const revalidate = 3600;

async function activeProducts(): Promise<{ id: string; updated_at?: string }[]> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !key) return [];
  try {
    const res = await fetch(`${base}/rest/v1/products?select=id,updated_at&active=eq.true`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/terminos`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const products = await activeProducts();
  return [
    ...staticRoutes,
    ...products.map((product) => ({
      url: `${SITE_URL}/producto/${product.id}`,
      lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
