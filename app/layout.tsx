import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@/components/analytics';
import { SITE_URL } from '@/lib/site-url';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const siteUrl = SITE_URL;

// Adelanta el handshake TLS con Supabase (datos de la tienda, productos, auth)
// para que la primera consulta arranque antes.
let supabaseOrigin: string | null = null;
try {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (raw) supabaseOrigin = new URL(raw).origin;
} catch {
  supabaseOrigin = null;
}
// Ícono de la pestaña configurable desde Admin → Textos y contacto → Logo e
// ícono. Si no hay uno subido, se usa el diseño por defecto.
async function customFavicon(): Promise<string | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !key) return null;
  try {
    const res = await fetch(`${base}/rest/v1/site_content?select=value&key=eq.store&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      // El logo cambia rara vez; evita pegarle a Supabase en cada visita.
      cache: 'force-cache',
      next: { revalidate: 300 },
    } as RequestInit);
    if (!res.ok) return null;
    const rows = (await res.json()) as { value?: { faviconUrl?: string } }[];
    return rows[0]?.value?.faviconUrl || null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const favicon = await customFavicon();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: 'MILUÉ LOOP — Amiguitos tejidos a mano', template: '%s · MILUÉ LOOP' },
    description: 'Llaveros y peluches de crochet hechos a mano, puntada por puntada. Envíos a todo Chile.',
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'es_CL',
      siteName: 'MILUÉ LOOP',
      title: 'MILUÉ LOOP — Amiguitos tejidos a mano',
      description: 'Llaveros y peluches de crochet hechos a mano, puntada por puntada. Envíos a todo Chile.',
      images: [{ url: '/og-image.jpg', width: 1122, height: 589, alt: 'Llaveros y peluches MILUÉ LOOP' }],
    },
    twitter: { card: 'summary_large_image', title: 'MILUÉ LOOP — Amiguitos tejidos a mano', description: 'Llaveros y peluches de crochet hechos a mano.', images: ['/og-image.jpg'] },
    icons: { icon: favicon || '/favicon.svg' },
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MILUÉ LOOP',
  url: siteUrl,
  logo: `${siteUrl}/favicon.svg`,
  description: 'Llaveros y peluches de crochet hechos a mano, puntada por puntada. Envíos a todo Chile.',
  areaServed: 'CL',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MILUÉ LOOP',
  url: siteUrl,
  inLanguage: 'es-CL',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
