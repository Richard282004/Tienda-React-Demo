import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@/components/analytics';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { WhatsappGlobal } from '@/components/whatsapp-global';
import { fetchSiteMeta } from '@/lib/site-meta';
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
// Título, descripción, ícono y datos estructurados configurables desde
// Admin → Textos y contacto. Si no hay contenido guardado, usa los valores
// por defecto de lib/store-data.ts.
export async function generateMetadata(): Promise<Metadata> {
  const meta = await fetchSiteMeta();
  const title = `${meta.brandName} — Amiguitos tejidos a mano`;
  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s · ${meta.brandName}` },
    description: meta.description,
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'es_CL',
      siteName: meta.brandName,
      title,
      description: meta.description,
      images: [{ url: '/og-image.jpg', width: 1122, height: 589, alt: `Llaveros y peluches ${meta.brandName}` }],
    },
    twitter: { card: 'summary_large_image', title, description: meta.description, images: ['/og-image.jpg'] },
    icons: { icon: meta.faviconUrl || '/favicon.svg', apple: meta.faviconUrl || '/favicon.svg' },
    // Hace que Safari en iOS abra la PWA instalada sin la barra de
    // direcciones (display: standalone) y le ponga un nombre corto al ícono.
    appleWebApp: { capable: true, statusBarStyle: 'default', title: meta.brandName },
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const meta = await fetchSiteMeta();
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: meta.brandName,
    url: siteUrl,
    logo: `${siteUrl}/favicon.svg`,
    description: meta.description,
    areaServed: 'CL',
  };
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: meta.brandName,
    url: siteUrl,
    inLanguage: 'es-CL',
  };
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <Analytics />
        <ServiceWorkerRegister />
        <WhatsappGlobal />
        {children}
      </body>
    </html>
  );
}
