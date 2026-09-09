import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@/components/analytics';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const siteUrl = 'https://tienda-react-demo.richardlagos2.workers.dev';
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={`${geistSans.variable} ${geistMono.variable}`}><Analytics />{children}</body></html>;
}
