'use client';

import { DeveloperCredit } from '@/components/developer-credit';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Droplets, Heart, Info, Layers, Mail, Phone, Plus, Ruler, ShoppingBag, Sparkles, Store, UserRound, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ProductArtwork } from '@/components/product-artwork';
import { catalogPrice, type CatalogVariant, variantForColor } from '@/lib/product-variants';
import { encodeCartEntry } from '@/lib/cart';
import { formatPrice as formatCurrency } from '@/lib/currency';
import { defaultProducts, defaultStoreContent, fetchStoreContent, readCachedStoreContent, writeCachedStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { type ProductImage, type ProductVariant } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import { initFavorites, syncFavoriteToggle, writeLocalFavorites } from '@/lib/favorites';
import './producto.css';

export default function ProductoPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [product, setProduct] = useState<Product | null>(null);
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [catalogVariants, setCatalogVariants] = useState<CatalogVariant[]>([]);
  const [otherVariantProductIds, setOtherVariantProductIds] = useState<Set<string>>(new Set());
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  // Arranca en el default (igual en servidor y cliente, sin desajuste de
  // hidratación) y aplica la caché justo antes de pintar, así no se ve el
  // parpadeo del logo por defecto.
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  useLayoutEffect(() => {
    const cached = readCachedStoreContent();
    if (cached !== defaultStoreContent) setContent(cached);
  }, []);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [notice, setNotice] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertStatus, setAlertStatus] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [specsOpen, setSpecsOpen] = useState(true);
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
      const [{ data: productRow }, { data: imageRows }, settings, { data: otherRows }, { data: variantRows }, { data: otherVariantRows }] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).maybeSingle(),
        supabase.from('product_images').select('*').eq('product_id', id).order('sort_order'),
        fetchStoreContent(supabase),
        supabase.from('products').select('*').eq('active', true).neq('id', id).order('sort_order').limit(12),
        supabase.from('product_variants').select('*').eq('product_id', id).eq('active', true).order('sort_order'),
        supabase.from('product_variants').select('product_id, price, stock').eq('active', true),
      ]);
      if (settings) {
        setContent(settings);
        writeCachedStoreContent(settings);
      }
      if (!productRow) { setNotFound(true); setLoading(false); return; }
      const typedProduct = productRow as Product;
      setProduct(typedProduct);
      setOtherProducts((otherRows ?? []) as Product[]);
      setCatalogVariants((otherVariantRows ?? []) as CatalogVariant[]);
      setOtherVariantProductIds(new Set(((otherVariantRows ?? []) as { product_id: string }[]).map((row) => row.product_id)));
      const typedVariants = ((variantRows ?? []) as ProductVariant[]).map((variant) => ({ ...variant, color: variant.color?.trim() || null, size: variant.size?.trim() || null }));
      setVariants(typedVariants);
      // Preselecciona la primera variante con stock (o la primera de todas si
      // ninguna tiene) para que el precio/foto mostrados de entrada ya sean
      // los de una combinación válida.
      const pricedVariants = [...typedVariants].sort((a, b) => a.price - b.price);
      const requestedVariant = new URLSearchParams(window.location.search).get('variante');
      const firstAvailable = typedVariants.find((variant) => variant.id === requestedVariant) ?? pricedVariants.find((variant) => variant.stock === null || variant.stock > 0) ?? pricedVariants[0];
      setSelectedColor(firstAvailable?.color ?? null);
      setSelectedSize(firstAvailable?.size ?? null);
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

  const quickAdd = (productId: string, name: string, variantId?: string) => {
    try {
      const saved = JSON.parse(localStorage.getItem('lumina-bag') ?? '[]');
      const cart = Array.isArray(saved) ? saved : [];
      const next = [...cart, encodeCartEntry(productId, variantId)];
      localStorage.setItem('lumina-bag', JSON.stringify(next));
      setCartCount(next.length);
    } catch { /* no crítico */ }
    setNotice(`${name} agregado a tu bolsita`);
    window.setTimeout(() => setNotice(''), 2200);
  };

  // Colores/tallas disponibles y la variante que resulta de combinarlos.
  // Un producto puede tener solo color, solo talla, ambos, o ninguno (sin
  // variantes: se comporta exactamente como antes).
  const allColors = [...new Set(variants.map((variant) => variant.color))];
  const colors = allColors.some(Boolean) ? allColors : [];
  const matchingSizes = [...new Set(variants.filter((variant) => variant.color === selectedColor).map((variant) => variant.size))];
  const sizes = matchingSizes.some(Boolean) ? matchingSizes : [];
  const selectedVariant = variants.length
    ? variants.find((variant) => (variant.color ?? null) === selectedColor && (variant.size ?? null) === selectedSize)
    : undefined;
  const hasVariants = variants.length > 0;

  const addToCart = () => {
    if (!product) return;
    if (hasVariants && !selectedVariant) return;
    quickAdd(product.id, product.name, selectedVariant?.id);
  };

  const requestStockAlert = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !product || !alertEmail.trim()) return;
    setAlertStatus('busy');
    const { error } = await supabase.from('stock_alerts').insert({ product_id: product.id, variant_id: selectedVariant?.id ?? null, email: alertEmail.trim() });
    // Código 23505 = ya había dejado su correo para este producto (o
    // variante); lo tratamos igual como éxito, no como error.
    if (error && error.code !== '23505') { setAlertStatus('error'); return; }
    setAlertStatus('done');
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

  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveStock = hasVariants ? (selectedVariant?.stock ?? null) : product.stock;
  const outOfStock = product.active === false || (hasVariants && !selectedVariant) || (effectiveStock != null && effectiveStock <= 0);
  const lowStock = !outOfStock && effectiveStock != null && effectiveStock <= 3;
  const isLiked = favorites.includes(product.id);
  // La foto de la variante elegida va primero; el resto de la galería del
  // producto sigue disponible detrás.
  const displayImages = selectedVariant?.image_url ? [selectedVariant.image_url, ...images.filter((image) => image !== selectedVariant.image_url)] : images;
  const specRows = [
    { key: 'weight', icon: Weight, label: 'Peso', value: product.weight },
    { key: 'dimensions', icon: Ruler, label: 'Dimensiones', value: product.dimensions },
    { key: 'material', icon: Layers, label: 'Material', value: product.material },
    { key: 'technique', icon: Sparkles, label: 'Técnica', value: product.technique },
    { key: 'care', icon: Droplets, label: 'Cuidados', value: product.care },
    { key: 'additional', icon: Info, label: 'Detalles adicionales', value: product.additional_details },
  ].filter((row) => row.value && row.value.trim());

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
                      width: `${content.logoWidth ?? 210}px`,
                      aspectRatio: `${content.logoWidth ?? 210} / ${content.logoHeight ?? 64}`,
                      objectFit: 'contain',
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
            {displayImages.length > 0 ? (
              <img src={displayImages[Math.min(activeImage, displayImages.length - 1)]} alt={product.name} fetchPriority="high" decoding="async" />
            ) : (
              <ProductArtwork product={product} />
            )}
            {displayImages.length > 1 && (
              <>
                <button className="producto-gallery-nav prev" aria-label="Imagen anterior" onClick={() => setActiveImage((current) => (current - 1 + displayImages.length) % displayImages.length)}><ChevronLeft size={20} /></button>
                <button className="producto-gallery-nav next" aria-label="Imagen siguiente" onClick={() => setActiveImage((current) => (current + 1) % displayImages.length)}><ChevronRight size={20} /></button>
              </>
            )}
          </div>
          {displayImages.length > 1 && (
            <div className="producto-thumbs" role="tablist" aria-label="Imágenes del producto">
              {displayImages.map((image, index) => (
                <button key={image + index} className={index === activeImage ? 'active' : ''} role="tab" aria-selected={index === activeImage} aria-label={`Ver imagen ${index + 1}`} onClick={() => setActiveImage(index)}>
                  <img src={image} alt="" loading="lazy" decoding="async" width={64} height={64} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="producto-info">
          {product.tag && <span className="product-tag producto-tag">{product.tag}</span>}
          <p className="section-kicker">{product.type} · tejido a mano</p>
          <h1>{product.name}</h1>
          <strong className="producto-price">{formatPrice(effectivePrice)}</strong>
          <span className={`availability-badge ${outOfStock ? 'unavailable' : 'available'}`}>{outOfStock ? 'Agotado' : lowStock ? `¡Últimas ${effectiveStock}!` : 'Disponible'}</span>
          {hasVariants && (
            <div className="producto-variants">
              {colors.length > 0 && (
                <div className="producto-variant-group">
                  <span className="producto-variant-label">Color</span>
                  <div className="producto-variant-options">
                    {colors.map((color) => (
                      <button
                        key={color ?? 'default'}
                        type="button"
                        className={`producto-variant-swatch ${selectedColor === color ? 'active' : ''}`}
                        aria-pressed={selectedColor === color}
                        onClick={() => {
                          const next = variantForColor(variants, color, selectedSize);
                          setSelectedColor(color);
                          setSelectedSize(next?.size ?? null);
                        }}
                      >
                        {color ?? 'Original'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sizes.length > 0 && (
                <div className="producto-variant-group">
                  <span className="producto-variant-label">Tamaño</span>
                  <div className="producto-variant-options">
                    {sizes.map((size) => (
                      <button
                        key={size ?? 'default'}
                        type="button"
                        className={`producto-variant-chip ${selectedSize === size ? 'active' : ''}`}
                        aria-pressed={selectedSize === size}
                        onClick={() => setSelectedSize(size)}
                      >
                        {size ?? 'Estándar'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedVariant && <p className="producto-selection-summary" role="status">Tu elección: {[selectedVariant.color, selectedVariant.size].filter(Boolean).join(' · ') || 'Opción estándar'} · {formatPrice(selectedVariant.price)}</p>}
              {!selectedVariant && <p className="producto-variant-missing">Esa combinación no existe. Elige otra.</p>}
            </div>
          )}
          {product.description && <p className="producto-description">{product.description}</p>}
          {specRows.length > 0 && (
            <div className={`producto-specs ${specsOpen ? 'open' : ''}`}>
              <button type="button" className="producto-specs-toggle" onClick={() => setSpecsOpen((current) => !current)} aria-expanded={specsOpen} aria-controls="producto-specs-panel">
                <span>Características</span>
                <ChevronDown size={17} className="producto-specs-chevron" />
              </button>
              <div className="producto-specs-panel" id="producto-specs-panel">
                <div className="producto-specs-panel-inner">
                  <div className="producto-specs-grid">
                    {specRows.map(({ key, icon: Icon, label, value }) => (
                      <div className="producto-spec-row" key={key}>
                        <span className="producto-spec-icon"><Icon size={16} /></span>
                        <span className="producto-spec-label">{label}</span>
                        <span className="producto-spec-value">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="producto-actions">
            <Button className="primary-button" disabled={outOfStock} onClick={addToCart}>Agregar a la bolsita <Plus size={16} /></Button>
            <button className={`heart-icon producto-heart ${isLiked ? 'liked' : ''}`} onClick={toggleFavorite} aria-pressed={isLiked} aria-label={isLiked ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}>
              <Heart key={String(isLiked)} className="heart-pop" size={19} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          </div>
          {outOfStock && (
            <div className="stock-alert-box">
              {alertStatus === 'done' ? (
                <p>Listo, te avisamos por correo apenas vuelva.</p>
              ) : (
                <form onSubmit={requestStockAlert}>
                  <label htmlFor="stock-alert-email">Avísame cuando vuelva el stock</label>
                  <div className="stock-alert-row">
                    <input id="stock-alert-email" type="email" required placeholder="tu@correo.com" value={alertEmail} onChange={(event) => setAlertEmail(event.target.value)} />
                    <Button type="submit" className="primary-button" disabled={alertStatus === 'busy'}>Avísame</Button>
                  </div>
                  {alertStatus === 'error' && <p className="stock-alert-error">No pudimos guardarlo, inténtalo de nuevo.</p>}
                </form>
              )}
            </div>
          )}
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
                        <strong>{catalogPrice(item, catalogVariants, formatPrice)}</strong>
                        <button
                          type="button"
                          className="producto-more-add"
                          disabled={itemOutOfStock}
                          aria-label={`Agregar ${item.name} a la bolsita`}
                          onClick={() => (otherVariantProductIds.has(item.id) ? (window.location.href = `/producto/${item.id}`) : quickAdd(item.id, item.name))}
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
            loading="lazy"
            decoding="async"
            style={
              content.hideBrandText
                ? {
                    width: `${content.logoWidth ?? 210}px`,
                    aspectRatio: `${content.logoWidth ?? 210} / ${content.logoHeight ?? 64}`,
                    objectFit: 'contain',
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
          <span className="payment-badges-label">Pagos seguros con</span>
          <div className="payment-badges" aria-label="Medios de pago aceptados"><span className="payment-badge visa">VISA</span><span className="payment-badge mastercard"><i /><i /></span><span className="payment-badge amex">AMEX</span><span className="payment-badge mp">Mercado Pago</span></div>
        </div>
        <div className="footer-links">
          <a href="/">Inicio</a>
          <a href="/#tienda">Tienda</a>
          <a href="/#nosotros">Sobre nosotros</a>
          <a href="/rastrear">Rastrear pedido</a>
          <a href="/terminos">Términos y condiciones</a>
          <a href="/privacidad">Privacidad</a>
        </div>
      </footer>
      <DeveloperCredit content={content} />
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
