import { defaultStoreContent } from '@/lib/store-data';

export type SiteMeta = {
  brandName: string;
  brandTagline: string;
  description: string;
  faviconUrl: string | null;
  themeColor: string;
};

// Metadata usada en <head>, manifest.ts y JSON-LD, editable desde Admin →
// Textos y contacto. Se lee directo por REST (sin el cliente de Supabase)
// porque layout.tsx y manifest.ts corren antes de que la app monte.
export async function fetchSiteMeta(): Promise<SiteMeta> {
  const fallback: SiteMeta = {
    brandName: defaultStoreContent.brandName,
    brandTagline: defaultStoreContent.brandTagline,
    description: defaultStoreContent.heroDescription,
    faviconUrl: null,
    themeColor: '#5c2640',
  };
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !key) return fallback;
  try {
    const res = await fetch(`${base}/rest/v1/site_content?select=value&key=eq.store&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return fallback;
    const rows = (await res.json()) as { value?: Partial<SiteMeta & { heroDescription: string }> }[];
    const value = rows[0]?.value;
    if (!value) return fallback;
    return {
      brandName: value.brandName || fallback.brandName,
      brandTagline: value.brandTagline || fallback.brandTagline,
      description: value.heroDescription || fallback.description,
      faviconUrl: value.faviconUrl || null,
      themeColor: fallback.themeColor,
    };
  } catch {
    return fallback;
  }
}
