import { NextResponse } from 'next/server';
import { fetchSiteMeta } from '@/lib/site-meta';

// El navegador pide /favicon.ico directo, sin pasar por el <link rel="icon">
// que arma generateMetadata en layout.tsx. Si ese archivo existiera estático
// en /public, ganaba siempre y el ícono subido en Admin nunca se veía (o se
// veía y al recargar volvía al de antes). Esta ruta hace lo mismo que
// generateMetadata pero respondiendo justo a esa petición implícita.
export async function GET(request: Request) {
  const meta = await fetchSiteMeta();
  const response = NextResponse.redirect(new URL(meta.faviconUrl || '/favicon.svg', request.url), 302);
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
}
