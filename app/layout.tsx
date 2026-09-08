import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const siteUrl = 'https://tienda-react-demo.richardlagos2.workers.dev';
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Lúmina — Amiguitos tejidos a mano', template: '%s · Lúmina' },
  description: 'Llaveros y peluches de crochet hechos a mano, puntada por puntada. Envíos a todo Chile.',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    siteName: 'Lúmina',
    title: 'Lúmina — Amiguitos tejidos a mano',
    description: 'Llaveros y peluches de crochet hechos a mano, puntada por puntada. Envíos a todo Chile.',
    images: [{ url: '/lumina-hero.png', width: 1200, height: 630, alt: 'Llaveros y peluches Lúmina' }],
  },
  twitter: { card: 'summary_large_image', title: 'Lúmina — Amiguitos tejidos a mano', description: 'Llaveros y peluches de crochet hechos a mano.', images: ['/lumina-hero.png'] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
