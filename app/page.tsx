'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Heart,
  LockKeyhole,
  Mail,
  Menu,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
  UserRound,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Product = {
  id: number;
  name: string;
  type: string;
  price: number;
  color: string;
  art: string;
  tag?: string;
};

const products: Product[] = [
  { id: 1, name: 'Bunny Lila', type: 'Llaveros', price: 12990, color: '#d8c1ec', art: '🐰', tag: 'Más vendido' },
  { id: 2, name: 'Osito Miel', type: 'Peluches', price: 18990, color: '#f2d17c', art: '🐻' },
  { id: 3, name: 'Honguito Rosa', type: 'Llaveros', price: 10990, color: '#f1a2a7', art: '🍄', tag: 'Nuevo' },
  { id: 4, name: 'Gatita Vainilla', type: 'Peluches', price: 19990, color: '#f6e4c8', art: '🐱' },
  { id: 5, name: 'Fresa Dulce', type: 'Llaveros', price: 9990, color: '#ee9a9c', art: '🍓' },
  { id: 6, name: 'Nube Sueño', type: 'Peluches', price: 17990, color: '#c6d8e8', art: '☁️' },
];

const categories = ['Todo', 'Llaveros', 'Peluches'];
const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

export default function Home() {
  const [category, setCategory] = useState('Todo');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [cart, setCart] = useState<number[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login');
  const [notice, setNotice] = useState('');
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [carouselPaused, setCarouselPaused] = useState(false);

  const visibleProducts = useMemo(
    () => (category === 'Todo' ? products : products.filter((product) => product.type === category)),
    [category],
  );
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? products.filter((product) => `${product.name} ${product.type}`.toLowerCase().includes(term)) : products.slice(0, 4);
  }, [search]);
  const cartProducts = cart.map((id) => products.find((product) => product.id === id)).filter(Boolean) as Product[];
  const total = cartProducts.reduce((sum, product) => sum + product.price, 0);

  const addToCart = (id: number) => {
    setCart((current) => [...current, id]);
    setNotice('Agregado a tu bolsita');
    window.setTimeout(() => setNotice(''), 2200);
  };

  useEffect(() => {
    if (!carouselApi || carouselPaused) return;
    const interval = window.setInterval(() => carouselApi.scrollNext(), 2800);
    return () => window.clearInterval(interval);
  }, [carouselApi, carouselPaused]);

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: {
        registerTool?: (
          tool: { name: string; title: string; description: string; inputSchema: object; annotations?: object; execute: (input: unknown) => unknown },
          options?: { signal?: AbortSignal },
        ) => void;
      };
    }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool({
        name: 'filter_collection',
        title: 'Filtrar la colección',
        description: 'Muestra los productos de la categoría elegida: Todo, Llaveros o Peluches.',
        inputSchema: { type: 'object', properties: { category: { type: 'string', enum: categories } }, required: ['category'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const value = (input as { category?: string })?.category;
          if (!value || !categories.includes(value)) throw new Error('Categoría no válida');
          setCategory(value);
          return { category: value, productsShown: value === 'Todo' ? products.length : products.filter((product) => product.type === value).length };
        },
      }, { signal: lifecycle.signal });
      context.registerTool({
        name: 'add_product_to_cart',
        title: 'Agregar producto a la bolsita',
        description: 'Agrega un producto de la colección a la bolsita de compra.',
        inputSchema: { type: 'object', properties: { productId: { type: 'number' } }, required: ['productId'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const id = (input as { productId?: number })?.productId;
          const product = products.find((item) => item.id === id);
          if (!product) throw new Error('Producto no encontrado');
          setCart((current) => [...current, product.id]);
          return { productId: product.id, name: product.name, cartCount: cart.length + 1 };
        },
      }, { signal: lifecycle.signal });
    } catch { /* WebMCP es opcional según el navegador. */ }
    return () => lifecycle.abort();
  }, [cart.length]);

  const openAccount = (mode: 'login' | 'register') => {
    setAccountMode(mode);
    setAccountOpen(true);
  };

  return (
    <main className="site-shell">
      <div className="utility-bar">
        <span><Truck size={15} /> Envíos a todo Chile</span>
        <span className="utility-message">Envío gratis sobre $45.000 · cada pieza se hace a mano</span>
        <div className="utility-actions">
          <a href="tel:+56912345678"><Phone size={14} /> +56 9 1234 5678</a>
          <button onClick={() => openAccount('login')}><UserRound size={14} /> Iniciar sesión</button>
          <button className="register-link" onClick={() => openAccount('register')}>Crear cuenta</button>
        </div>
      </div>

      <header className="site-header">
        <a href="#inicio" className="brand" aria-label="Lúmina, inicio">
          <span className="brand-mark">✦</span>
          <span>LÚMINA<small>hecho a mano</small></span>
        </a>
        <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Navegación principal">
          <a href="#inicio" onClick={() => setMenuOpen(false)}>Inicio</a>
          <a href="#tienda" onClick={() => setMenuOpen(false)}>Tienda</a>
          <a href="#nosotros" onClick={() => setMenuOpen(false)}>Sobre nosotros</a>
          <a href="#contacto" onClick={() => setMenuOpen(false)}>Contáctanos</a>
        </nav>
        <div className="header-actions">
          <Button aria-label="Buscar productos" variant="ghost" size="icon" className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={() => setSearchOpen((open) => !open)}><Search size={19} /></Button>
          <Button aria-label="Mi cuenta" variant="ghost" size="icon" className="icon-button account-icon" onClick={() => openAccount('login')}><UserRound size={19} /></Button>
          <Button aria-label={`Abrir bolsita, ${cart.length} productos`} variant="ghost" size="icon" className="bag-button" onClick={() => setCartOpen(true)}><ShoppingBag size={19} /><span>{cart.length}</span></Button>
          <Button aria-label="Abrir menú" variant="ghost" size="icon" className="menu-button" onClick={() => setMenuOpen((open) => !open)}><Menu size={21} /></Button>
        </div>
      </header>

      {searchOpen && (
        <section className="search-panel" aria-label="Buscador de productos">
          <div className="search-panel-inner page-width">
            <div className="search-field"><Search size={19} /><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca llaveros, peluches o un personaje..." aria-label="Buscar en la tienda" /><button onClick={() => { setSearchOpen(false); setSearch(''); }} aria-label="Cerrar buscador"><X size={18} /></button></div>
            <div className="search-results">
              {searchResults.length ? searchResults.map((product) => <button key={product.id} onClick={() => { setSearchOpen(false); setSearch(''); document.getElementById('tienda')?.scrollIntoView({ behavior: 'smooth' }); }}><span style={{ backgroundColor: product.color }}>{product.art}</span><span><strong>{product.name}</strong><small>{product.type} · {formatPrice(product.price)}</small></span><ArrowRight size={15} /></button>) : <p>No encontramos productos con ese nombre.</p>}
            </div>
          </div>
        </section>
      )}

      <section id="inicio" className="hero-section page-width">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> Pequeñas cosas, grandes sonrisas</div>
          <h1>Un poquito de<br /><em>ternura</em> para llevar.</h1>
          <p>Llaveros y peluches tejidos a mano, puntada por puntada, para acompañarte todos los días.</p>
          <div className="hero-actions"><Button className="primary-button" onClick={() => document.getElementById('tienda')?.scrollIntoView({ behavior: 'smooth' })}>Ver la colección <ArrowRight size={17} /></Button><a className="text-link" href="#nosotros">Conoce Lúmina <ArrowRight size={15} /></a></div>
          <div className="hero-notes"><span><Check size={15} /> Hecho a mano</span><span><Check size={15} /> Materiales suaves</span></div>
        </div>
        <div className="hero-image-wrap"><div className="hero-scribble">para regalar<br />o regalarte <span>♡</span></div><img src="/lumina-hero.png" alt="Tres productos de crochet: un conejo, un oso y un hongo" className="hero-image" /><div className="hero-sticker">nuevos<br /><strong>amiguitos</strong></div></div>
      </section>

      <section className="work-showcase" aria-label="Trabajos recientes">
        <div className="showcase-heading page-width"><div><p className="section-kicker">Trabajos recientes</p><h2>Hechos para <em>acompañarte</em></h2></div><p>La vitrina se actualiza automáticamente para mostrarte nuestros últimos tejidos.</p></div>
        <Carousel setApi={setCarouselApi} opts={{ loop: true, align: 'start' }} className="work-carousel" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)}>
          <CarouselContent className="carousel-track">
            {[...products, ...products.slice(0, 2)].map((product, index) => (
              <CarouselItem className="work-slide" key={`${product.id}-${index}`}>
                <article className="work-card" style={{ backgroundColor: product.color }}>
                  <div className="work-art">{product.art}</div>
                  <div><span>{product.type}</span><h3>{product.name}</h3><p>{formatPrice(product.price)}</p></div>
                  <Button aria-label={`Agregar ${product.name} al carrito`} size="icon" className="quick-add" onClick={() => addToCart(product.id)}><Plus size={17} /></Button>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </section>

      <section className="category-strip page-width" aria-label="Categorías destacadas"><div><span className="category-icon pink">♡</span><span>Regalos con cariño</span></div><div><span className="category-icon yellow">✳</span><span>Diseños únicos</span></div><div><span className="category-icon lilac">⌁</span><span>Hecho en Chile</span></div></section>

      <section id="tienda" className="collection-section page-width">
        <div className="section-heading"><div><p className="section-kicker">La colección</p><h2>Elige tu nuevo <em>favorito</em></h2></div><div className="category-tabs" role="tablist" aria-label="Filtrar productos">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} role="tab" aria-selected={category === item}>{item}</button>)}</div></div>
        <div className="product-grid">{visibleProducts.map((product) => <article className="product-card" key={product.id}><div className="product-visual" style={{ backgroundColor: product.color }}>{product.tag && <span className="product-tag">{product.tag}</span>}<button className={`heart-icon ${favorites.includes(product.id) ? 'liked' : ''}`} onClick={() => setFavorites((current) => current.includes(product.id) ? current.filter((item) => item !== product.id) : [...current, product.id])} aria-label={favorites.includes(product.id) ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}><Heart size={18} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button><span className="product-emoji" role="img" aria-label={product.name}>{product.art}</span><span className="yarn-shadow" /></div><div className="product-info"><div><h3>{product.name}</h3><p>{product.type} · edición limitada</p></div><strong>{formatPrice(product.price)}</strong></div><Button className="add-button" variant="outline" onClick={() => addToCart(product.id)}>Agregar a la bolsita <Plus size={16} /></Button></article>)}</div>
      </section>

      <section id="nosotros" className="story-section page-width"><div className="story-card"><span className="story-number">01</span><p className="section-kicker">Sobre nosotros</p><h2>Hecho lento,<br /><em>hecho bonito.</em></h2><p>Cada pieza nace en un pequeño taller, entre ovillos de colores, café calentito y muchas ganas de crear algo especial.</p><a className="text-link" href="#contacto">Hablemos de tu idea <ArrowRight size={15} /></a></div><div className="story-quote"><span>“</span><p>Lo imperfecto es parte de lo encantador.</p><small>— filosofía Lúmina</small></div></section>

      <footer id="contacto" className="site-footer page-width"><div className="footer-brand"><span className="brand-mark">✦</span><span>LÚMINA<small>hecho a mano</small></span></div><div className="footer-contact"><p>¿Tienes una idea especial?</p><a href="tel:+56912345678"><Phone size={14} /> +56 9 1234 5678</a><a href="mailto:hola@lumina.cl"><Mail size={14} /> hola@lumina.cl</a></div><div className="footer-links"><a href="#inicio">Inicio</a><a href="#tienda">Tienda</a><a href="#nosotros">Sobre nosotros</a></div></footer>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="account-dialog">
          <DialogHeader><div className="account-mark">✦</div><DialogTitle>{accountMode === 'login' ? 'Bienvenida de vuelta' : 'Crea tu cuenta'}</DialogTitle><DialogDescription>{accountMode === 'login' ? 'Ingresa para revisar tus pedidos y guardar tus favoritos.' : 'Regístrate para comprar más rápido y seguir tus pedidos.'}</DialogDescription></DialogHeader>
          <form className="account-form" onSubmit={(event) => { event.preventDefault(); setNotice('La cuenta estará disponible próximamente'); setAccountOpen(false); window.setTimeout(() => setNotice(''), 2600); }}>
            {accountMode === 'register' && <label>Nombre<Input required placeholder="Tu nombre" autoComplete="name" /></label>}
            <label>Correo electrónico<div className="input-with-icon"><Mail size={17} /><Input required type="email" placeholder="tu@correo.com" autoComplete="email" /></div></label>
            <label>Contraseña<div className="input-with-icon"><LockKeyhole size={17} /><Input required type="password" placeholder="••••••••" autoComplete={accountMode === 'login' ? 'current-password' : 'new-password'} /></div></label>
            <Button type="submit" className="primary-button account-submit">{accountMode === 'login' ? 'Iniciar sesión' : 'Registrarme'} <ArrowRight size={16} /></Button>
          </form>
          <div className="login-divider"><span /> o <span /></div>
          <Button variant="outline" className="google-button" disabled><strong>G</strong> Continuar con Google <small>próximamente</small></Button>
          <p className="account-switch">{accountMode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'} <button onClick={() => setAccountMode(accountMode === 'login' ? 'register' : 'login')}>{accountMode === 'login' ? 'Regístrate' : 'Inicia sesión'}</button></p>
        </DialogContent>
      </Dialog>

      {notice && <div className="notice" role="status"><Check size={16} /> {notice}</div>}

      {cartOpen && <div className="cart-overlay" onClick={() => setCartOpen(false)}><aside className="cart-panel" onClick={(event) => event.stopPropagation()}><div className="cart-heading"><div><p className="section-kicker">Tu selección</p><h2>Tu bolsita <span>({cart.length})</span></h2></div><button className="close-cart" onClick={() => setCartOpen(false)} aria-label="Cerrar bolsita"><X size={20} /></button></div>{cartProducts.length === 0 ? <div className="empty-cart"><span>♡</span><p>Tu bolsita está esperando<br />algo bonito.</p><Button className="primary-button" onClick={() => { setCartOpen(false); document.getElementById('tienda')?.scrollIntoView({ behavior: 'smooth' }); }}>Explorar tienda</Button></div> : <><div className="cart-items">{cartProducts.map((product, index) => <div className="cart-item" key={`${product.id}-${index}`}><div className="cart-thumb" style={{ backgroundColor: product.color }}>{product.art}</div><div><h3>{product.name}</h3><p>{formatPrice(product.price)}</p></div><button aria-label={`Eliminar ${product.name}`} onClick={() => setCart((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Minus size={15} /></button></div>)}</div><div className="cart-total"><span>Total</span><strong>{formatPrice(total)}</strong></div><Button className="primary-button checkout-button">Continuar compra <ArrowRight size={17} /></Button></>}</aside></div>}
    </main>
  );
}
