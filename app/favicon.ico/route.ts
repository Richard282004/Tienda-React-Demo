import { NextResponse } from 'next/server';

// El navegador pide /favicon.ico directo, sin pasar por el <link rel="icon">
// que arma generateMetadata en layout.tsx. Si ese archivo existiera estático
// en /public, ganaba siempre y el ícono subido en Admin nunca se veía (o se
// veía y al recargar volvía al de antes). Esta ruta hace lo mismo que
// generateMetadata pero respondiendo justo a esa petición implícita.
async function customFaviconUrl(): Promise<string | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !key) return null;
  try {
    const res = await fetch(`${base}/rest/v1/site_content?select=value&key=eq.store&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { value?: { faviconUrl?: string } }[];
    return rows[0]?.value?.faviconUrl || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const favicon = await customFaviconUrl();
  const response = NextResponse.redirect(new URL(favicon || '/favicon.svg', request.url), 302);
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
}
