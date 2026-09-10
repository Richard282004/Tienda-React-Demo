import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site-url';
import { defaultProducts } from '@/lib/store-data';

type Params = { id: string };

type ProductSeo = {
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number | null;
};

async function fetchProduct(id: string): Promise<ProductSeo | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (base && key) {
    try {
      const res = await fetch(
        `${base}/rest/v1/products?select=name,description,price,image_url,stock&id=eq.${encodeURIComponent(id)}&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (res.ok) {
        const rows = (await res.json()) as ProductSeo[];
        if (rows[0]) return rows[0];
      }
    } catch {
      /* cae al catálogo por defecto */
    }
  }
  const fallback = defaultProducts.find((item) => item.id === id);
  return fallback
    ? { name: fallback.name, description: fallback.description ?? null, price: fallback.price, image_url: fallback.image_url ?? null, stock: fallback.stock ?? null }
    : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) return { title: 'Producto no encontrado' };
  const description = product.description?.trim() || `${product.name} — tejido a mano en crochet. Envíos a todo Chile.`;
  const image = product.image_url || `${SITE_URL}/og-image.jpg`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `${SITE_URL}/producto/${id}` },
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url: `${SITE_URL}/producto/${id}`,
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title: product.name, description, images: [image] },
  };
}

export default async function ProductoLayout({ children, params }: { children: React.ReactNode; params: Promise<Params> }) {
  const { id } = await params;
  const product = await fetchProduct(id);
  const jsonLd = product && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description?.trim() || `${product.name} tejido a mano en crochet.`,
    ...(product.image_url ? { image: product.image_url } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CLP',
      price: product.price,
      availability:
        product.stock === null || product.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/producto/${id}`,
    },
  };
  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      {children}
    </>
  );
}
