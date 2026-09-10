import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@/components/analytics';
import { SITE_URL } from '@/lib/site-url';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const siteUrl = SITE_URL;
export const metadata: Metadata = {
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
    images: [{ url: '/lumina-hero.jpg', width: 1200, height: 630, alt: 'Llaveros y peluches MILUÉ LOOP' }],
  },
  twitter: { card: 'summary_large_image', title: 'MILUÉ LOOP — Amiguitos tejidos a mano', description: 'Llaveros y peluches de crochet hechos a mano.', images: ['/lumina-hero.jpg'] },
  icons: { icon: '/favicon.svg' },
};
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
