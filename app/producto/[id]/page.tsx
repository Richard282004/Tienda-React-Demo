'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductArtwork } from '@/components/product-artwork';
import { formatPrice as formatCurrency } from '@/lib/currency';
import { defaultProducts, defaultStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { type ProductImage } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import '../../carrito/carrito.css';
import './producto.css';

export default function ProductoPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);

  useEffect(() => {
    try {
      const liked = JSON.parse(localStorage.getItem('lumina-favorites') ?? '[]');
      if (Array.isArray(liked)) setFavorites(liked.filter((item): item is string => typeof item === 'string'));
    } catch { /* sin acceso a localStorage */ }
  }, []);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      if (!supabase) {
        const fallback = defaultProducts.find((item) => item.id === id) ?? null;
        setProduct(fallback);
        setImages(fallback ? [fallback.image_url].filter(Boolean) as string[] : []);
        setNotFound(!fallback);
        setLoading(false);
        return;
      }
      const [{ data: productRow }, { data: imageRows }, { data: settings }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).maybeSingle(),
        supabase.from('product_images').select('*').eq('product_id', id).order('sort_order'),
        supabase.from('site_content').select('value').eq('key', 'store').maybeSingle(),
      ]);
      if (settings?.value) setContent({ ...defaultStoreContent, ...(settings.value as Partial<StoreContent>) });
      if (!productRow) { setNotFound(true); setLoading(false); return; }
      const typedProduct = productRow as Product;
      setProduct(typedProduct);
      const gallery = [typedProduct.image_url, ...((imageRows ?? []) as ProductImage[]).map((image) => image.image_url)].filter(Boolean) as string[];
      setImages(gallery);
      setActiveImage(0);
      setLoading(false);
    };
    void load();
  }, [id]);

  const toggleFavorite = () => {
    if (!product) return;
    setFavorites((current) => {
      const next = current.includes(product.id) ? current.filter((item) => item !== product.id) : [...current, product.id];
      try { localStorage.setItem('lumina-favorites', JSON.stringify(next)); } catch { /* no crítico */ }
      return next;
    });
  };

  const addToCart = () => {
    if (!product) return;
    try {
      const saved = JSON.parse(localStorage.getItem('lumina-bag') ?? '[]');
      const cart = Array.isArray(saved) ? saved : [];
      localStorage.setItem('lumina-bag', JSON.stringify([...cart, product.id]));
    } catch { /* no crítico */ }
    setNotice('Agregado a tu bolsita');
    window.setTimeout(() => setNotice(''), 2200);
  };

  if (loading) {
    return <main className="cart-page-shell"><p className="cart-page-loading">Cargando…</p></main>;
  }

  if (notFound || !product) {
    return (
      <main className="cart-page-shell">
        <header className="cart-page-header"><a href="/#tienda" className="cart-page-back"><ArrowLeft size={16} /> Volver a la tienda</a></header>
        <div className="page-width cart-page-empty">
          <p>No encontramos este producto. Puede que ya no esté disponible.</p>
          <Button className="primary-button" onClick={() => { window.location.href = '/#tienda'; }}>Explorar tienda</Button>
        </div>
      </main>
    );
  }

  const outOfStock = product.active === false || (product.stock != null && product.stock <= 0);
  const lowStock = !outOfStock && product.stock != null && product.stock <= 3;
  const isLiked = favorites.includes(product.id);

  return (
    <main className="cart-page-shell producto-page">
      <header className="cart-page-header"><a href="/#tienda" className="cart-page-back"><ArrowLeft size={16} /> Volver a la tienda</a></header>
      <div className="page-width producto-layout">
        <div className="producto-gallery">
          <div className="producto-gallery-main" style={{ backgroundColor: product.color }}>
            {images.length > 0 ? (
              <img src={images[activeImage]} alt={product.name} />
            ) : (
              <ProductArtwork product={product} />
            )}
            {images.length > 1 && (
              <>
                <button className="producto-gallery-nav prev" aria-label="Imagen anterior" onClick={() => setActiveImage((current) => (current - 1 + images.length) % images.length)}><ChevronLeft size={20} /></button>
                <button className="producto-gallery-nav next" aria-label="Imagen siguiente" onClick={() => setActiveImage((current) => (current + 1) % images.length)}><ChevronRight size={20} /></button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="producto-thumbs" role="tablist" aria-label="Imágenes del producto">
              {images.map((image, index) => (
                <button key={image + index} className={index === activeImage ? 'active' : ''} role="tab" aria-selected={index === activeImage} aria-label={`Ver imagen ${index + 1}`} onClick={() => setActiveImage(index)}>
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="producto-info">
          {product.tag && <span className="product-tag producto-tag">{product.tag}</span>}
          <p className="section-kicker">{product.type} · tejido a mano</p>
          <h1>{product.name}</h1>
          <strong className="producto-price">{formatPrice(product.price)}</strong>
          <span className={`availability-badge ${outOfStock ? 'unavailable' : 'available'}`}>{outOfStock ? 'Agotado' : lowStock ? `¡Últimas ${product.stock}!` : 'Disponible'}</span>
          {product.description && <p className="producto-description">{product.description}</p>}
          <div className="producto-actions">
            <Button className="primary-button" disabled={outOfStock} onClick={addToCart}>Agregar a la bolsita <Plus size={16} /></Button>
            <button className={`heart-icon producto-heart ${isLiked ? 'liked' : ''}`} onClick={toggleFavorite} aria-pressed={isLiked} aria-label={isLiked ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}>
              <Heart size={19} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
    </main>
  );
}
