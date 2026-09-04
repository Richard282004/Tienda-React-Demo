export type Product = {
  id: string;
  name: string;
  type: 'Llaveros' | 'Peluches';
  price: number;
  color: string;
  art: string;
  image_url?: string | null;
  tag?: string | null;
  active?: boolean;
  sort_order?: number;
};

export type StoreContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  phone: string;
  email: string;
  shippingMessage: string;
  aboutTitle: string;
  aboutHighlight: string;
  aboutText: string;
};

export const defaultProducts: Product[] = [
  { id: 'bunny-lila', name: 'Bunny Lila', type: 'Llaveros', price: 12990, color: '#d8c1ec', art: '🐰', tag: 'Más vendido', active: true, sort_order: 1 },
  { id: 'osito-miel', name: 'Osito Miel', type: 'Peluches', price: 18990, color: '#f2d17c', art: '🐻', active: true, sort_order: 2 },
  { id: 'honguito-rosa', name: 'Honguito Rosa', type: 'Llaveros', price: 10990, color: '#f1a2a7', art: '🍄', tag: 'Nuevo', active: true, sort_order: 3 },
  { id: 'gatita-vainilla', name: 'Gatita Vainilla', type: 'Peluches', price: 19990, color: '#f6e4c8', art: '🐱', active: true, sort_order: 4 },
  { id: 'fresa-dulce', name: 'Fresa Dulce', type: 'Llaveros', price: 9990, color: '#ee9a9c', art: '🍓', active: true, sort_order: 5 },
  { id: 'nube-sueno', name: 'Nube Sueño', type: 'Peluches', price: 17990, color: '#c6d8e8', art: '☁️', active: true, sort_order: 6 },
];

export const defaultStoreContent: StoreContent = {
  heroEyebrow: 'Pequeñas cosas, grandes sonrisas',
  heroTitle: 'Un poquito de',
  heroHighlight: 'ternura para llevar.',
  heroDescription: 'Llaveros y peluches tejidos a mano, puntada por puntada, para acompañarte todos los días.',
  phone: '+56 9 1234 5678',
  email: 'hola@lumina.cl',
  shippingMessage: 'Envío gratis sobre $45.000 · cada pieza se hace a mano',
  aboutTitle: 'Hecho lento,',
  aboutHighlight: 'hecho bonito.',
  aboutText: 'Cada pieza nace en un pequeño taller, entre ovillos de colores, café calentito y muchas ganas de crear algo especial.',
};
