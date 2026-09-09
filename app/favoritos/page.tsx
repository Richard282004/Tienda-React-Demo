'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Heart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductArtwork } from '@/components/product-artwork';
import { formatPrice as formatCurrency } from '@/lib/currency';
import { defaultStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { supabase } from '@/lib/supabase';
import '../carrito/carrito.css';

export default function FavoritosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  const [loading, setLoading] = useState(true);
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);

  useEffect(() => {
    try {
      const liked = JSON.parse(localStorage.getItem('lumina-favorites') ?? '[]');
      if (Array.isArray(liked)) setFavorites(liked.filter((id): id is string => typeof id === 'string'));
    } catch { /* sin acceso a localStorage */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem('lumina-favorites', JSON.stringify(favorites)); } catch { /* no crítico */ }
  }, [favorites]);

  useEffect(() => {
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      const [{ data: productRows }, { data: settings }] = await Promise.all([
        supabase.from('products').select('*').eq('active', true).order('sort_order'),
        supabase.from('site_content').select('value').eq('key', 'store').maybeSingle(),
      ]);
      setProducts((productRows ?? []) as Product[]);
      if (settings?.value) setContent({ ...defaultStoreContent, ...(settings.value as Partial<StoreContent>) });
      setLoading(false);
    };
    void load();
  }, []);

  const addToCart = (id: string) => {
    try {
      const saved = JSON.parse(localStorage.getItem('lumina-bag') ?? '[]');
      const cart = Array.isArray(saved) ? saved : [];
      localStorage.setItem('lumina-bag', JSON.stringify([...cart, id]));
    } catch { /* no crítico */ }
  };

  const removeFavorite = (id: string) => setFavorites((current) => current.filter((item) => item !== id));

  const favoriteProducts = products.filter((product) => favorites.includes(product.id));

  return (
    <main className="cart-page-shell">
      <header className="cart-page-header">
        <a href="/" className="cart-page-back"><ArrowLeft size={16} /> Volver a la tienda</a>
      </header>
      <div className="page-width">
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, margin: '0 0 6px' }}>Tus favoritos</h1>
        <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 14 }}>Los productos que te gustaron, guardados en este navegador.</p>
        {loading ? (
          <p className="cart-page-loading">Cargando…</p>
        ) : favoriteProducts.length === 0 ? (
          <div className="cart-page-empty">
            <span aria-hidden="true"><Heart size={44} /></span>
            <p>Todavía no has marcado ningún favorito. Toca el corazón de un producto para guardarlo aquí.</p>
            <Button className="primary-button" onClick={() => { window.location.href = '/#tienda'; }}>Explorar tienda</Button>
          </div>
        ) : (
          <div className="product-grid">
            {favoriteProducts.map((product) => {
              const outOfStock = product.active === false || (product.stock != null && product.stock <= 0);
              return (
                <article className="product-card" key={product.id}>
                  <div className="product-visual" style={{ backgroundColor: product.color }} onClick={() => { window.location.href = `/producto/${product.id}`; }} role="link" tabIndex={0} aria-label={`Ver ${product.name}`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.location.href = `/producto/${product.id}`; } }}>
                    {product.tag && <span className="product-tag">{product.tag}</span>}
                    <button className="heart-icon liked" onClick={(event) => { event.stopPropagation(); removeFavorite(product.id); }} aria-label={`Quitar ${product.name} de favoritos`}><Heart size={18} fill="currentColor" /></button>
                    <ProductArtwork product={product} className="product-photo" />
                    <span className="yarn-shadow" />
                  </div>
                  <div className="product-info">
                    <div>
                      <h3 className="product-name-link" onClick={() => { window.location.href = `/producto/${product.id}`; }}>{product.name}</h3>
                      <p>{product.type} · tejido a mano</p>
                      <span className={`availability-badge ${outOfStock ? 'unavailable' : 'available'}`}>{outOfStock ? 'Agotado' : 'Disponible'}</span>
                    </div>
                    <strong>{formatPrice(product.price)}</strong>
                  </div>
                  <Button className="add-button" variant="outline" disabled={outOfStock} onClick={() => addToCart(product.id)}>Agregar <Plus size={16} /></Button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
