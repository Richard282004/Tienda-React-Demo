import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MILUÉ LOOP',
    short_name: 'MILUÉ LOOP',
    description: 'Llaveros y peluches de crochet hechos a mano. Envíos a todo Chile.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffcf8',
    theme_color: '#5c2640',
    lang: 'es-CL',
    icons: [
      { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'maskable' },
    ],
  };
}
