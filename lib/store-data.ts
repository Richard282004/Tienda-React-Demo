export type Product = {
  id: string;
  name: string;
  description?: string | null;
  type: 'Llaveros' | 'Peluches';
  price: number;
  color: string;
  art: string;
  image_url?: string | null;
  image_position_x?: number;
  image_position_y?: number;
  image_zoom?: number;
  tag?: string | null;
  active?: boolean;
  sort_order?: number;
  stock?: number | null;
};

export type StoreContent = {
  brandName: string;
  brandTagline: string;
  heroEyebrow: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroCtaPrimary: string;
  heroCtaSecondary: string;
  heroNote1: string;
  heroNote2: string;
  categoryText1: string;
  categoryText2: string;
  categoryText3: string;
  phone: string;
  email: string;
  whatsapp?: string;
  shippingMessage: string;
  aboutTitle: string;
  aboutHighlight: string;
  aboutText: string;
  storyQuote: string;
  storyQuoteAuthor: string;
  footerCta: string;
};

export const defaultProducts: Product[] = [
  { id: 'bunny-lila', name: 'Bunny Lila', description: 'Llavero de conejito tejido a mano en algodón suave, orejitas bordadas a mano.', type: 'Llaveros', price: 12990, color: '#d8c1ec', art: '🐰', tag: 'Más vendido', active: true, sort_order: 1 },
  { id: 'osito-miel', name: 'Osito Miel', description: 'Peluche de osito color miel, relleno hipoalergénico, ideal para abrazar.', type: 'Peluches', price: 18990, color: '#f2d17c', art: '🐻', active: true, sort_order: 2 },
  { id: 'honguito-rosa', name: 'Honguito Rosa', description: 'Llavero de honguito rosado, tejido puntada por puntada con hilo de algodón.', type: 'Llaveros', price: 10990, color: '#f1a2a7', art: '🍄', tag: 'Nuevo', active: true, sort_order: 3 },
  { id: 'gatita-vainilla', name: 'Gatita Vainilla', description: 'Peluche de gatita tono vainilla, con bigotes bordados y lazo removible.', type: 'Peluches', price: 19990, color: '#f6e4c8', art: '🐱', active: true, sort_order: 4 },
  { id: 'fresa-dulce', name: 'Fresa Dulce', description: 'Llavero de fresita dulce, perfecto para mochilas y regalos pequeños.', type: 'Llaveros', price: 9990, color: '#ee9a9c', art: '🍓', active: true, sort_order: 5 },
  { id: 'nube-sueno', name: 'Nube Sueño', description: 'Peluche de nubecita suave, textura esponjosa y colores pastel.', type: 'Peluches', price: 17990, color: '#c6d8e8', art: '☁️', active: true, sort_order: 6 },
];

export const defaultStoreContent: StoreContent = {
  brandName: 'LÚMINA',
  brandTagline: 'hecho a mano',
  heroEyebrow: 'Pequeñas cosas, grandes sonrisas',
  heroTitle: 'Un poquito de',
  heroHighlight: 'ternura para llevar.',
  heroDescription: 'Llaveros y peluches tejidos a mano, puntada por puntada, para acompañarte todos los días.',
  heroCtaPrimary: 'Ver la colección',
  heroCtaSecondary: 'Conoce Lúmina',
  heroNote1: 'Hecho a mano',
  heroNote2: 'Materiales suaves',
  categoryText1: 'Regalos con cariño',
  categoryText2: 'Diseños únicos',
  categoryText3: 'Hecho en Chile',
  phone: '+56 9 1234 5678',
  email: 'hola@lumina.cl',
  whatsapp: '+56912345678',
  shippingMessage: 'Envío gratis sobre $45.000 · cada pieza se hace a mano',
  aboutTitle: 'Hecho lento,',
  aboutHighlight: 'hecho bonito.',
  aboutText: 'Cada pieza nace en un pequeño taller, entre ovillos de colores, café calentito y muchas ganas de crear algo especial.',
  storyQuote: 'Lo imperfecto es parte de lo encantador.',
  storyQuoteAuthor: '— filosofía Lúmina',
  footerCta: '¿Tienes una idea especial?',
};
