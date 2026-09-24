// Página principal editable (Admin → Página principal). Todo lo comercial de
// la portada vive en site_content ('store') junto al resto de los textos: los
// bloques "Dos caminos", las categorías visibles, los productos destacados y
// el crédito del pie. Precios, fotos de producto y stock NO se copian aquí:
// se leen siempre del catálogo real y este módulo solo guarda referencias
// (nombre de categoría o id de producto).
import type { Product } from './store-data';

export type HomeTargetKind = 'category' | 'product' | 'page';
export type HomeTarget = { kind: HomeTargetKind; value: string };

export type HomeBlock = {
  id: string;
  enabled: boolean;
  title: string;
  description: string;
  ctaLabel: string;
  imageUrl: string;
  imageAlt: string;
  imageX: number;
  imageY: number;
  imageZoom: number;
  // Foto opcional solo para celular (vacío = usa la misma, con su propio encuadre).
  mobileImageUrl: string;
  mobileImageX: number;
  mobileImageY: number;
  mobileImageZoom: number;
  target: HomeTarget;
};

// Páginas o secciones existentes a las que puede apuntar un bloque.
export const HOME_PAGES: { value: string; label: string }[] = [
  { value: '#tienda', label: 'Todo el catálogo' },
  { value: '#nosotros', label: 'Sobre nosotros' },
  { value: '#contacto', label: 'Contacto' },
  { value: '/favoritos', label: 'Favoritos' },
  { value: '/rastrear', label: 'Rastrear pedido' },
  { value: '/mi-cuenta', label: 'Mi cuenta' },
  { value: '/terminos', label: 'Términos y condiciones' },
  { value: '/privacidad', label: 'Privacidad' },
];

export const HOME_BLOCK_LIMIT = 2;

export function makeHomeBlock(category: string | undefined, index: number): HomeBlock {
  const name = category?.trim() ?? '';
  return {
    id: `bloque-${index + 1}`,
    enabled: true,
    title: name || 'Nuestra colección',
    description: 'Tejidos a mano, puntada por puntada.',
    ctaLabel: name ? `Ver ${name.toLocaleLowerCase('es')}` : 'Ver la colección',
    imageUrl: '',
    imageAlt: '',
    imageX: 50,
    imageY: 50,
    imageZoom: 1,
    mobileImageUrl: '',
    mobileImageX: 50,
    mobileImageY: 50,
    mobileImageZoom: 1,
    target: name ? { kind: 'category', value: name } : { kind: 'page', value: '#tienda' },
  };
}

// Sin configuración guardada, la portada arranca con las dos primeras
// categorías reales de la tienda (así no aparece una categoría inventada).
export function getHomeBlocks(saved: HomeBlock[] | undefined, categories: string[]): HomeBlock[] {
  if (Array.isArray(saved) && saved.length) {
    return saved.slice(0, HOME_BLOCK_LIMIT).map((block, index) => ({ ...makeHomeBlock(undefined, index), ...block }));
  }
  return Array.from({ length: HOME_BLOCK_LIMIT }, (_, index) => makeHomeBlock(categories[index], index));
}

export type ResolvedHomeBlock = HomeBlock & {
  href: string;
  // Categoría a filtrar en la portada al tocar el bloque (null si va a otra página).
  category: string | null;
  // El destino elegido ya no existe; el bloque lleva al catálogo completo.
  targetMissing: boolean;
  image: string;
  mobileImage: string;
  framing: { x: number; y: number; zoom: number };
  mobileFraming: { x: number; y: number; zoom: number };
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
};

export function isSafeImageUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url, 'https://tienda.local');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function describeTarget(target: HomeTarget, categories: string[], products: Pick<Product, 'id' | 'name' | 'active'>[]): { label: string; missing: boolean } {
  if (target.kind === 'category') {
    return { label: `Categoría: ${target.value}`, missing: !categories.includes(target.value) };
  }
  if (target.kind === 'product') {
    const product = products.find((item) => item.id === target.value);
    return { label: `Producto: ${product?.name ?? 'no encontrado'}`, missing: !product || product.active === false };
  }
  const page = HOME_PAGES.find((item) => item.value === target.value);
  return { label: `Página: ${page?.label ?? target.value}`, missing: !page };
}

export function resolveHomeBlocks(
  blocks: HomeBlock[],
  categories: string[],
  products: Pick<Product, 'id' | 'name' | 'type' | 'active' | 'image_url' | 'image_position_x' | 'image_position_y' | 'image_zoom'>[],
): ResolvedHomeBlock[] {
  const available = products.filter((product) => product.active !== false);
  return blocks.filter((block) => block.enabled).map((block) => {
    let href = '/#tienda';
    let category: string | null = 'Todo';
    let targetMissing = false;
    let fallback: (typeof available)[number] | undefined;
    const { kind, value } = block.target ?? { kind: 'page', value: '#tienda' };
    if (kind === 'category' && categories.includes(value)) {
      href = `/?categoria=${encodeURIComponent(value)}#tienda`;
      category = value;
      fallback = available.find((product) => product.type === value && isSafeImageUrl(product.image_url));
    } else if (kind === 'product' && available.some((product) => product.id === value)) {
      href = `/producto/${encodeURIComponent(value)}`;
      category = null;
      fallback = available.find((product) => product.id === value && isSafeImageUrl(product.image_url));
    } else if (kind === 'page' && HOME_PAGES.some((page) => page.value === value)) {
      href = value.startsWith('#') ? `/${value}` : value;
      category = value === '#tienda' ? 'Todo' : null;
    } else {
      targetMissing = true;
    }
    // Sin foto propia, se usa la foto real de un producto del destino (con su
    // propio encuadre). Si tampoco hay, el bloque se muestra sin foto.
    const ownImage = isSafeImageUrl(block.imageUrl) ? block.imageUrl : '';
    const fallbackImage = fallback?.image_url && isSafeImageUrl(fallback.image_url) ? fallback.image_url : '';
    const image = ownImage || fallbackImage;
    const framing = ownImage
      ? { x: clampNumber(block.imageX, 0, 100, 50), y: clampNumber(block.imageY, 0, 100, 50), zoom: clampNumber(block.imageZoom, 1, 3, 1) }
      : { x: clampNumber(fallback?.image_position_x, 0, 100, 50), y: clampNumber(fallback?.image_position_y, 0, 100, 50), zoom: clampNumber(fallback?.image_zoom, 1, 3, 1) };
    const ownMobile = isSafeImageUrl(block.mobileImageUrl) ? block.mobileImageUrl : '';
    const mobileFraming = ownMobile
      ? { x: clampNumber(block.mobileImageX, 0, 100, 50), y: clampNumber(block.mobileImageY, 0, 100, 50), zoom: clampNumber(block.mobileImageZoom, 1, 3, 1) }
      : ownImage
        ? { x: clampNumber(block.mobileImageX, 0, 100, framing.x), y: clampNumber(block.mobileImageY, 0, 100, framing.y), zoom: clampNumber(block.mobileImageZoom, 1, 3, framing.zoom) }
        : framing;
    return { ...block, href, category, targetMissing, image, mobileImage: ownMobile || image, framing, mobileFraming };
  });
}

// Categorías visibles en la portada, en el orden elegido. Sin selección
// guardada se muestran todas; las que ya no existen se descartan.
export function resolveHomeCategories(selected: string[] | undefined, categories: string[]): string[] {
  if (!Array.isArray(selected)) return categories;
  return selected.filter((name, index) => categories.includes(name) && selected.indexOf(name) === index);
}

// Destacados primero (en el orden elegido) y el resto después, sin alterar
// el orden relativo que ya traía la lista (ej. disponibles antes que agotados).
export function orderFeaturedFirst<T extends { id: string }>(list: T[], featuredIds: string[] | undefined): T[] {
  if (!featuredIds?.length) return list;
  const rank = new Map(featuredIds.map((id, index) => [id, index]));
  return list
    .map((item, index) => ({ item, index, rank: rank.get(item.id) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}

// Solo enlaces http(s) completos: evita javascript:, data: u otros esquemas
// si alguien pega algo raro en el administrador.
export function safeExternalUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}
