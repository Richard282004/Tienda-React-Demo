export type Product = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
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
  categories: string[];
  currency: string;
  locale: string;
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
  gaId?: string;
  metaPixelId?: string;
  legalName?: string;
  legalRetention?: string;
  termsContent?: string;
  privacyContent?: string;
  orderNotifyEmail?: string;
  lowStockThreshold?: number;
  logoUrl?: string;
  faviconUrl?: string;
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
  brandName: 'MILUÉ LOOP',
  brandTagline: 'hecho a mano',
  categories: ['Llaveros', 'Peluches'],
  currency: 'CLP',
  locale: 'es-CL',
  heroEyebrow: 'Pequeñas cosas, grandes sonrisas',
  heroTitle: 'Un poquito de',
  heroHighlight: 'ternura para llevar.',
  heroDescription: 'Llaveros y peluches tejidos a mano, puntada por puntada, para acompañarte todos los días.',
  heroCtaPrimary: 'Ver la colección',
  heroCtaSecondary: 'Conoce MILUÉ LOOP',
  heroNote1: 'Hecho a mano',
  heroNote2: 'Materiales suaves',
  categoryText1: 'Regalos con cariño',
  categoryText2: 'Diseños únicos',
  categoryText3: 'Hecho en Chile',
  phone: '+569 56720490',
  email: 'richardlagos2@gmail.com',
  whatsapp: '+56 9 5672 0490',
  shippingMessage: 'Envío gratis sobre $25.000 · cada pieza es artesanal, se hace a mano',
  aboutTitle: 'Hecho lento,',
  aboutHighlight: 'hecho bonito.',
  aboutText: 'Cada pieza nace desde la naturaleza del amor, todos nuestros productos los realizamos de manera artesanal, con la mejor calidad en nuestras lanas, nuestra empresa nace desde el amor y creatividad.!!!',
  storyQuote: 'Lo imperfecto es parte de lo encantador.',
  storyQuoteAuthor: '— filosofía MILUÉ LOOP',
  footerCta: '¿Tienes una idea especial?',
  legalName: '',
  legalRetention: 'Mientras mantengas tu cuenta activa. Si la cierras, conservamos los datos de tus pedidos hasta por 6 años desde la compra por obligaciones tributarias y contables, y luego los eliminamos.',
  termsContent: `## 1. Quiénes somos
{{legalName}} es quien opera {{brandName}}, una tienda de llaveros y peluches de crochet hechos a mano. Al comprar en este sitio aceptas estas condiciones.

## 2. Productos y precios
Cada producto se muestra con nombre, descripción, fotografía referencial, precio en pesos chilenos (CLP) y disponibilidad. Al ser piezas artesanales hechas a mano, pueden existir pequeñas variaciones de color o forma respecto a la fotografía. Los precios incluyen IVA cuando corresponda.

## 3. Proceso de compra y pago
El pago se procesa a través de Mercado Pago. El pedido queda confirmado solo cuando el pago es aprobado. Si el pago es rechazado o queda pendiente, el pedido no se despacha hasta confirmar el pago.

## 4. Envíos
Despachamos a todo Chile. El costo de envío se calcula según la región indicada al pagar y se muestra antes de confirmar la compra. Los plazos de entrega son estimados y pueden variar según la empresa de transporte y la comuna de destino.

## 5. Derecho a retracto
De acuerdo con la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores, tienes derecho a retractarte de tu compra dentro de 10 días corridos desde que recibes el producto, siempre que este se encuentre en las mismas condiciones en que fue entregado, sin uso y con su embalaje original. Para ejercer este derecho, contáctanos por los medios indicados abajo.

Los costos de despacho de la devolución corren por cuenta del cliente, salvo que el producto presente una falla o error atribuible a la tienda.

## 6. Cambios y devoluciones por fallas
Si tu producto llega con una falla de fabricación o distinto a lo comprado, contáctanos dentro de 7 días de recibido con fotos del producto. Evaluamos cada caso para reposición, cambio o devolución del dinero, conforme a la Ley del Consumidor.

## 7. Cuentas de usuario
Puedes comprar creando una cuenta con correo y contraseña, o mediante tu cuenta de Google. Eres responsable de mantener la confidencialidad de tu contraseña.

## 8. Contacto
Ante dudas, reclamos o para ejercer tus derechos como consumidor, escríbenos a {{email}} o al {{phone}}.`,
  privacyContent: `## 1. Quiénes tratan tus datos
{{legalName}} opera {{brandName}}. Puedes contactarnos en {{email}} o al {{phone}} para cualquier consulta sobre esta política.

## 2. Qué datos recopilamos
Cuando creas una cuenta, compras o inicias sesión con Google, recopilamos: nombre, correo electrónico, teléfono, dirección de despacho (región, comuna, dirección) y el historial de tus pedidos. Si inicias sesión con Google, recibimos tu nombre y correo asociados a esa cuenta.

## 3. Para qué usamos tus datos
- Procesar y despachar tus pedidos.
- Enviarte correos sobre el estado de tu compra (confirmación, envío, entrega).
- Darte acceso a tu cuenta y tu historial de pedidos.
- Responder tus consultas de contacto.

No vendemos tus datos personales a terceros.

## 4. Con quién compartimos datos
Para operar la tienda usamos proveedores de servicios que procesan datos en nuestro nombre:
- Supabase: almacenamiento de tu cuenta, pedidos y fotografías de productos.
- Mercado Pago: procesamiento del pago (nunca vemos ni almacenamos los datos de tu tarjeta).
- Google: si eliges iniciar sesión con tu cuenta de Google.
- Resend: envío de los correos transaccionales de tu pedido.
- Cloudflare: alojamiento del sitio web.

Si activamos herramientas de análisis o publicidad (Google Analytics y/o Meta Pixel), te lo pedimos primero mediante el aviso de cookies del sitio; solo se activan si aceptas, y puedes cambiar tu decisión cuando quieras.

## 5. Cuánto tiempo conservamos tus datos
{{retention}}

## 6. Tus derechos
Puedes solicitar acceder, corregir o eliminar tus datos personales, o el cierre de tu cuenta, escribiéndonos a {{email}}. Responderemos dentro de un plazo razonable.

## 7. Cookies y almacenamiento local
Usamos almacenamiento local del navegador para recordar tu carrito de compras y favoritos mientras navegas; esto no requiere tu consentimiento porque no se usa para rastrearte ni con fines publicitarios. Si en algún momento activamos Google Analytics o Meta Pixel, te lo pediremos antes mediante un aviso de cookies, y esas herramientas sí usan cookies o identificadores para medir visitas o mostrar publicidad.

## 8. Seguridad
Tu contraseña se guarda cifrada por Supabase; nunca tenemos acceso a ella en texto plano. Las conexiones al sitio y a los servicios de pago usan cifrado HTTPS.`,
};
