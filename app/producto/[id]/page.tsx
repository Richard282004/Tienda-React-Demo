'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Mail, Phone, Plus, ShoppingBag, Store, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ProductArtwork } from '@/components/product-artwork';
import { formatPrice as formatCurrency } from '@/lib/currency';
import { defaultProducts, defaultStoreContent, readCachedStoreContent, writeCachedStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { type ProductImage } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import { initFavorites, syncFavoriteToggle, writeLocalFavorites } from '@/lib/favorites';
import '../../carrito/carrito.css';
import './producto.css';

export default function ProductoPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [product, setProduct] = useState<Product | null>(null);
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [content, setContent] = useState<StoreContent>(readCachedStoreContent);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [notice, setNotice] = useState('');
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);

  useEffect(() => {
    try {
      const bag = JSON.parse(localStorage.getItem('lumina-bag') ?? '[]');
      if (Array.isArray(bag)) setCartCount(bag.length);
    } catch { /* sin acceso a localStorage */ }
    initFavorites(supabase).then(setFavorites);
  }, []);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      if (!supabase) {
        const fallback = defaultProducts.find((item) => item.id === id) ?? null;
        setProduct(fallback);
        setImages(fallback ? [fallback.image_url].filter(Boolean) as string[] : []);
        setOtherProducts(defaultProducts.filter((item) => item.id !== id));
        setNotFound(!fallback);
        setLoading(false);
        return;
      }
      const [{ data: productRow }, { data: imageRows }, { data: settings }, { data: otherRows }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).maybeSingle(),
        supabase.from('product_images').select('*').eq('product_id', id).order('sort_order'),
        supabase.from('site_content').select('value').eq('key', 'store').maybeSingle(),
        supabase.from('products').select('*').eq('active', true).neq('id', id).order('sort_order').limit(12),
      ]);
      if (settings?.value) {
        const merged = { ...defaultStoreContent, ...(settings.value as Partial<StoreContent>) };
        setContent(merged);
        writeCachedStoreContent(merged);
      }
      if (!productRow) { setNotFound(true); setLoading(false); return; }
      const typedProduct = productRow as Product;
      setProduct(typedProduct);
      setOtherProducts((otherRows ?? []) as Product[]);
      const gallery = [typedProduct.image_url, ...((imageRows ?? []) as ProductImage[]).map((image) => image.image_url)].filter(Boolean) as string[];
      setImages(gallery);
      setActiveImage(0);
      setLoading(false);
    };
    void load();
  }, [id]);

  const toggleFavorite = () => {
    if (!product) return;
    const liked = !favorites.includes(product.id);
    syncFavoriteToggle(supabase, product.id, liked);
    setFavorites((current) => {
      const next = liked ? [...current, product.id] : current.filter((item) => item !== product.id);
      writeLocalFavorites(next);
      return next;
    });
  };

  const quickAdd = (productId: string, name: string) => {
    try {
      const saved = JSON.parse(localStorage.getItem('lumina-bag') ?? '[]');
      const cart = Array.isArray(saved) ? saved : [];
      const next = [...cart, productId];
      localStorage.setItem('lumina-bag', JSON.stringify(next));
      setCartCount(next.length);
    } catch { /* no crítico */ }
    setNotice(`${name} agregado a tu bolsita`);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const addToCart = () => {
    if (!product) return;
    quickAdd(product.id, product.name);
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
      <header className="site-header producto-header">
        <a href="/" className="brand" aria-label={`${content.brandName}, inicio`}>
          {content.logoUrl ? (
            <img
              className={content.hideBrandText ? 'brand-logo brand-logo-solo' : 'brand-logo'}
              src={content.logoUrl}
              alt={content.brandName}
              style={
                content.hideBrandText
                  ? {
                      height: `${content.logoHeight ?? 64}px`,
                      width: `${content.logoWidth ?? 210}px`,
                      objectFit: 'cover',
                      objectPosition: `${content.logoPositionX ?? 50}% ${content.logoPositionY ?? 50}%`,
                      transformOrigin: `${content.logoPositionX ?? 50}% ${content.logoPositionY ?? 50}%`,
                      transform: `scale(${content.logoZoom ?? 1})`,
                    }
                  : undefined
              }
            />
          ) : (
            <span className="brand-mark">✦</span>
          )}
        </a>
        <a href="/#tienda" className="cart-page-back"><ArrowLeft size={16} /> Volver a la tienda</a>
        <div className="header-actions producto-header-actions">
          <Button aria-label="Mi cuenta" variant="ghost" size="icon" className="icon-button account-icon" onClick={() => { window.location.href = '/?account=1'; }}><UserRound size={19} /></Button>
          <Button aria-label={`Abrir bolsita, ${cartCount} productos`} variant="ghost" size="icon" className="icon-button bag-button" onClick={() => { window.location.href = '/carrito'; }}><ShoppingBag size={19} />{cartCount > 0 && <span key={cartCount} className="bag-badge">{cartCount}</span>}</Button>
        </div>
      </header>
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
              <Heart key={String(isLiked)} className="heart-pop" size={19} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>
      {otherProducts.length > 0 && (
        <section className="page-width producto-more">
          <h2>También te puede gustar</h2>
          <Carousel opts={{ align: 'start' }}>
            <CarouselContent>
              {otherProducts.map((item) => {
                const itemOutOfStock = item.active === false || (item.stock != null && item.stock <= 0);
                return (
                  <CarouselItem key={item.id} className="producto-more-item">
                    <div className="producto-more-card">
                      <a href={`/producto/${item.id}`} className="producto-more-link">
                        <div className="producto-more-visual" style={{ backgroundColor: item.color }}>
                          <ProductArtwork product={item} className="product-photo" />
                        </div>
                        <span className="producto-more-name">{item.name}</span>
                      </a>
                      <div className="producto-more-footer">
                        <strong>{formatPrice(item.price)}</strong>
                        <button
                          type="button"
                          className="producto-more-add"
                          disabled={itemOutOfStock}
                          aria-label={`Agregar ${item.name} a la bolsita`}
                          onClick={() => quickAdd(item.id, item.name)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </section>
      )}
      <footer className="site-footer page-width">
        <div className="footer-brand">{content.logoUrl ? (
          <img
            className={content.hideBrandText ? 'brand-logo brand-logo-solo' : 'brand-logo'}
            src={content.logoUrl}
            alt={content.hideBrandText ? content.brandName : ''}
            style={
              content.hideBrandText
                ? {
                    height: `${content.logoHeight ?? 64}px`,
                    width: `${content.logoWidth ?? 210}px`,
                    objectFit: 'cover',
                    objectPosition: `${content.logoPositionX ?? 50}% ${content.logoPositionY ?? 50}%`,
                    transformOrigin: `${content.logoPositionX ?? 50}% ${content.logoPositionY ?? 50}%`,
                    transform: `scale(${content.logoZoom ?? 1})`,
                  }
                : undefined
            }
          />
        ) : <span className="brand-mark">✦</span>}{!(content.logoUrl && content.hideBrandText) && <span><b className="brand-name">{content.brandName}</b><small>{content.brandTagline}</small></span>}</div>
        <div className="footer-contact">
          <p>{content.footerCta}</p>
          <a href={`tel:${content.phone.replace(/\s/g, '')}`}><Phone size={14} /> {content.phone}</a>
          <a href={`mailto:${content.email}`}><Mail size={14} /> {content.email}</a>
        </div>
        <div className="footer-links">
          <a href="/">Inicio</a>
          <a href="/#tienda">Tienda</a>
          <a href="/#nosotros">Sobre nosotros</a>
          <a href="/terminos">Términos y condiciones</a>
          <a href="/privacidad">Privacidad</a>
        </div>
      </footer>
      {notice && <div className="notice" role="status">{notice}</div>}
      <nav className="producto-mobile-nav" aria-label="Navegación rápida">
        <a href="/"><Store size={20} /><span>Tienda</span></a>
        <a href="/favoritos"><Heart key={`fav-heart-${favorites.length}`} className="heart-pop" size={20} fill={favorites.length ? 'currentColor' : 'none'} />{favorites.length > 0 && <span key={`fav-badge-${favorites.length}`} className="producto-mobile-nav-badge">{favorites.length}</span>}<span>Favoritos</span></a>
        <a href="/carrito"><ShoppingBag size={20} />{cartCount > 0 && <span key={cartCount} className="producto-mobile-nav-badge">{cartCount}</span>}<span>Carrito</span></a>
        <button type="button" onClick={() => { window.location.href = '/?account=1'; }}><UserRound size={20} /><span>Mi cuenta</span></button>
      </nav>
    </main>
  );
}
