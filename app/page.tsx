'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
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

import { ProductArtwork } from '@/components/product-artwork';
import { calculateShipping } from '@/lib/checkout-validation';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { defaultProducts, defaultStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { CHILE_REGIONS, type ShippingRate } from '@/lib/orders';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const categories = ['Todo', 'Llaveros', 'Peluches'];
const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

export default function Home() {
  const [products, setProducts] = useState<Product[]>(isSupabaseConfigured ? [] : defaultProducts);
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  const [storeLoading, setStoreLoading] = useState(isSupabaseConfigured);
  const [storeError, setStoreError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const checkoutLock = useRef(false);
  const [category, setCategory] = useState('Todo');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();


  const visibleProducts = useMemo(
    () => (category === 'Todo' ? products : products.filter((product) => product.type === category)),
    [category, products],
  );
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? products.filter((product) => `${product.name} ${product.type}`.toLowerCase().includes(term)) : products.slice(0, 4);
  }, [search, products]);
  const cartProducts = cart.map((id) => products.find((product) => product.id === id)).filter(Boolean) as Product[];
  const total = cartProducts.reduce((sum, product) => sum + product.price, 0);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [shipping, setShipping] = useState({ name: '', email: '', phone: '', region: '', comuna: '', address: '', addressExtra: '' });
  const shippingCost = calculateShipping(total, shippingRates.find((rate) => rate.region === shipping.region)?.cost);
  const grandTotal = total + (shippingCost ?? 0);

  const handleCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkoutLock.current) return;
    if (!cartProducts.length || shippingCost === null) { setCheckoutError('Selecciona una región con envío disponible.'); return; }
    checkoutLock.current = true;
    setCheckoutBusy(true);
    setCheckoutError('');
    const counts = new Map<string, number>();
    cart.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [...counts.entries()].map(([productId, quantity]) => ({ productId, quantity })),
          customerName: shipping.name,
          customerEmail: shipping.email,
          customerPhone: shipping.phone,
          region: shipping.region,
          comuna: shipping.comuna,
          address: shipping.address,
          addressExtra: shipping.addressExtra,
        }),
      });
      const data = (await response.json()) as { initPoint?: string; error?: string };
      if (!response.ok || !data.initPoint) { setCheckoutError(data.error ?? 'No se pudo iniciar el pago.'); return; }
      window.location.href = data.initPoint;
    } catch {
      setCheckoutError('No se pudo conectar con el servidor de pagos.');
    } finally {
      checkoutLock.current = false;
      setCheckoutBusy(false);
    }
  };

  const addToCart = (id: string) => {
    if (!products.some((product) => product.id === id && product.active !== false)) return;
    setCart((current) => [...current, id]);
    setNotice('Agregado a tu bolsita');
    window.setTimeout(() => setNotice(''), 2200);
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lumina-bag') ?? '[]');
      const liked = JSON.parse(localStorage.getItem('lumina-favorites') ?? '[]');
      if (Array.isArray(saved)) setCart(saved.filter((id): id is string => typeof id === 'string').slice(0, 300));
      if (Array.isArray(liked)) setFavorites(liked.filter((id): id is string => typeof id === 'string').slice(0, 300));
    } catch { /* El almacenamiento privado puede no estar disponible. */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem('lumina-bag', JSON.stringify(cart));
      localStorage.setItem('lumina-favorites', JSON.stringify(favorites));
    } catch { /* La compra sigue funcionando sin persistencia local. */ }
  }, [cart, favorites, storageReady]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let sessionRevision = 0;
    const refreshAccount = async (user: { id: string; email?: string } | undefined) => {
      const revision = ++sessionRevision;
      if (!active) return;
      setSessionEmail(user?.email ?? null);
      setIsAdmin(false);
      if (!user) return;
      const { data } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (active && revision === sessionRevision) setIsAdmin(data?.role === 'admin');
    };
    const loadStore = async () => {
      try {
        const [catalog, settings, rates] = await Promise.all([
          client.from('products').select('*').eq('active', true).order('sort_order'),
          client.from('site_content').select('value').eq('key', 'store').maybeSingle(),
          client.from('shipping_rates').select('region, cost').order('region'),
        ]);
        if (!active) return;
        if (catalog.error) { setStoreError('No pudimos cargar la colección. Intenta recargar la página.'); return; }
        setProducts((catalog.data ?? []) as Product[]);
        const available = new Set((catalog.data ?? []).map((product) => product.id));
        setCart((current) => current.filter((id) => available.has(id)));
        if (settings.data?.value) setContent({ ...defaultStoreContent, ...(settings.data.value as Partial<StoreContent>) });
        setShippingRates((rates.data ?? []) as ShippingRate[]);
      } catch {
        if (active) setStoreError('No pudimos conectar con la tienda. Intenta recargar la página.');
      } finally {
        if (active) setStoreLoading(false);
      }
    };
    void loadStore();
    void client.auth.getSession().then(({ data }) => refreshAccount(data.session?.user)).catch(() => {});
    // No esperar otras llamadas a Supabase dentro del bloqueo de autenticación.
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { if (active) void refreshAccount(session?.user).catch(() => {}); }, 0);
    });
    return () => { active = false; sessionRevision++; subscription.subscription.unsubscribe(); };
  }, []);

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
        inputSchema: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const id = (input as { productId?: string })?.productId;
          const product = products.find((item) => item.id === id);
          if (!product) throw new Error('Producto no encontrado');
          setCart((current) => [...current, product.id]);
          return { productId: product.id, name: product.name, cartCount: cart.length + 1 };
        },
      }, { signal: lifecycle.signal });
    } catch { /* WebMCP es opcional según el navegador. */ }
    return () => lifecycle.abort();
  }, [cart.length, products]);

  const openAccount = (mode: 'login' | 'register') => {
    setAccountMode(mode);
    setAccountMessage('');
    setAccountOpen(true);
  };

  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setAccountMessage('El acceso a cuentas no está disponible por el momento.'); return; }
    setAccountBusy(true);
    setAccountMessage('');
    try {
      const result = accountMode === 'login'
        ? await supabase.auth.signInWithPassword({ email: accountEmail, password: accountPassword })
        : await supabase.auth.signUp({ email: accountEmail, password: accountPassword, options: { data: { full_name: accountName } } });
      if (result.error) { setAccountMessage(accountMode === 'login' ? 'No pudimos iniciar sesión. Revisa tu correo y contraseña.' : 'No pudimos crear la cuenta. Revisa tus datos e inténtalo de nuevo.'); return; }
      setAccountPassword('');
      if (accountMode === 'register' && !result.data.session) {
        setAccountMessage('Revisa tu correo para confirmar la cuenta.');
        return;
      }
      setAccountOpen(false);
      setNotice(accountMode === 'login' ? 'Sesión iniciada' : 'Cuenta creada');
      window.setTimeout(() => setNotice(''), 2200);
    } catch {
      setAccountMessage('No pudimos conectar. Inténtalo de nuevo.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) { setAccountMessage('El acceso a cuentas no está disponible por el momento.'); return; }
    if (accountBusy) return;
    setAccountBusy(true);
    setAccountMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
      if (error) setAccountMessage('No pudimos abrir Google. Inténtalo de nuevo en unos momentos.');
    } catch {
      setAccountMessage('No pudimos conectar con Google. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    setAccountOpen(false);
    setNotice('Sesión cerrada');
    window.setTimeout(() => setNotice(''), 2200);
  };

  return (
    <main className="site-shell">
      <a className="skip-link" href="#tienda">Saltar a la colección</a>
      <div className="utility-bar">
        <span><Truck size={15} /> Envíos a todo Chile</span>
        <span className="utility-message">{content.shippingMessage}</span>
        <div className="utility-actions">
          <a href={`tel:${content.phone.replace(/\s/g, '')}`}><Phone size={14} /> {content.phone}</a>
          <button onClick={() => openAccount('login')}><UserRound size={14} /> {sessionEmail ?? 'Iniciar sesión'}</button>
          {sessionEmail ? <button className="register-link" onClick={handleSignOut}>Cerrar sesión</button> : <button className="register-link" onClick={() => openAccount('register')}>Crear cuenta</button>}
        </div>
      </div>

      <header className="site-header">
        <a href="#inicio" className="brand" aria-label="Lúmina, inicio">
          <span className="brand-mark">✦</span>
          <span>LÚMINA<small>hecho a mano</small></span>
        </a>
        <nav id="main-navigation" className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Navegación principal">
          <a href="#inicio" onClick={() => setMenuOpen(false)}>Inicio</a>
          <a href="#tienda" onClick={() => setMenuOpen(false)}>Tienda</a>
          <a href="#nosotros" onClick={() => setMenuOpen(false)}>Sobre nosotros</a>
          <a href="#contacto" onClick={() => setMenuOpen(false)}>Contáctanos</a><button className="mobile-account" onClick={() => { setMenuOpen(false); openAccount('login'); }}>Mi cuenta</button>
        </nav>
        <div className="header-actions">
          <Button aria-label="Buscar productos" variant="ghost" size="icon" className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={() => setSearchOpen((open) => !open)}><Search size={19} /></Button>
          <Button aria-label="Mi cuenta" variant="ghost" size="icon" className="icon-button account-icon" onClick={() => openAccount('login')}><UserRound size={19} /></Button>
          <Button aria-label={`Abrir bolsita, ${cart.length} productos`} variant="ghost" size="icon" className="bag-button" onClick={() => setCartOpen(true)}><ShoppingBag size={19} /><span>{cart.length}</span></Button>
          <Button aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} aria-controls="main-navigation" variant="ghost" size="icon" className="menu-button" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</Button>
        </div>
      </header>

      {searchOpen && (
        <section className="search-panel" aria-label="Buscador de productos">
          <div className="search-panel-inner page-width">
            <div className="search-field"><Search size={19} /><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca llaveros, peluches o un personaje..." aria-label="Buscar en la tienda" /><button onClick={() => { setSearchOpen(false); setSearch(''); }} aria-label="Cerrar buscador"><X size={18} /></button></div>
            <div className="search-results">
              {searchResults.length ? searchResults.map((product) => <button key={product.id} onClick={() => { setSearchOpen(false); setSearch(''); setCategory('Todo'); window.setTimeout(() => document.getElementById(`producto-${product.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }}><span style={{ backgroundColor: product.color }}><ProductArtwork product={product} /></span><span><strong>{product.name}</strong><small>{product.type} · {formatPrice(product.price)}</small></span><ArrowRight size={15} /></button>) : <p>No encontramos productos con ese nombre.</p>}
            </div>
          </div>
        </section>
      )}

      <section id="inicio" className="hero-section page-width">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> {content.heroEyebrow}</div>
          <h1>{content.heroTitle}<br /><em>{content.heroHighlight}</em></h1>
          <p>{content.heroDescription}</p>
          <div className="hero-actions"><Button className="primary-button" onClick={() => document.getElementById('tienda')?.scrollIntoView({ behavior: 'smooth' })}>Ver la colección <ArrowRight size={17} /></Button><a className="text-link" href="#nosotros">Conoce Lúmina <ArrowRight size={15} /></a></div>
          <div className="hero-notes"><span><Check size={15} /> Hecho a mano</span><span><Check size={15} /> Materiales suaves</span></div>
        </div>
        <div className="hero-image-wrap"><div className="hero-scribble">para regalar<br />o regalarte <span>♡</span></div><img src="/lumina-hero.png" alt="Tres productos de crochet: un conejo, un oso y un hongo" className="hero-image" width={1122} height={1402} fetchPriority="high" /><div className="hero-sticker">nuevos<br /><strong>amiguitos</strong></div></div>
      </section>

      <section className="work-showcase" aria-label="Trabajos recientes">
        <div className="showcase-heading page-width"><div><p className="section-kicker">Trabajos recientes</p><h2>Hechos para <em>acompañarte</em></h2></div><div className="carousel-controls"><button aria-label="Ver productos anteriores" onClick={() => carouselApi?.scrollPrev()}><ArrowLeft size={18} /></button><button aria-label="Ver siguientes productos" onClick={() => carouselApi?.scrollNext()}><ArrowRight size={18} /></button></div></div>
        <Carousel setApi={setCarouselApi} opts={{ loop: true, align: 'start' }} className="work-carousel">
          <CarouselContent className="carousel-track">
            {products.map((product, index) => (
              <CarouselItem className="work-slide" key={`${product.id}-${index}`}>
                <article className="work-card" style={{ backgroundColor: product.color }}>
                  <div className="work-art"><ProductArtwork product={product} /></div>
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
        <div className="section-heading"><div><p className="section-kicker">La colección</p><h2>Elige tu nuevo <em>favorito</em></h2></div><div className="category-tabs" role="group" aria-label="Filtrar productos">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}</div></div>
        {storeLoading && <p className="store-feedback" role="status">Preparando la colección…</p>}
        {storeError && <p className="store-feedback" role="alert">{storeError}</p>}
        {!storeLoading && !storeError && visibleProducts.length === 0 && <p className="empty-collection">Pronto habrá nuevos amiguitos por aquí. Vuelve a visitarnos.</p>}
        <div className="product-grid">{visibleProducts.map((product) => <article className="product-card" id={`producto-${product.id}`} key={product.id}><div className="product-visual" style={{ backgroundColor: product.color }}>{product.tag && <span className="product-tag">{product.tag}</span>}<button className={`heart-icon ${favorites.includes(product.id) ? 'liked' : ''}`} onClick={() => setFavorites((current) => current.includes(product.id) ? current.filter((item) => item !== product.id) : [...current, product.id])} aria-pressed={favorites.includes(product.id)} aria-label={favorites.includes(product.id) ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}><Heart size={18} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button><ProductArtwork product={product} className="product-photo" /><span className="yarn-shadow" /></div><div className="product-info"><div><h3>{product.name}</h3><p>{product.type} · tejido a mano</p>{product.description && <p className="product-description">{product.description}</p>}<span className={`availability-badge ${product.active === false ? 'unavailable' : 'available'}`}>{product.active === false ? 'Agotado' : 'Disponible'}</span></div><strong>{formatPrice(product.price)}</strong></div><Button className="add-button" variant="outline" disabled={product.active === false} onClick={() => addToCart(product.id)}>Agregar a la bolsita <Plus size={16} /></Button></article>)}</div>
      </section>

      <section id="nosotros" className="story-section page-width"><div className="story-card"><span className="story-number">01</span><p className="section-kicker">Sobre nosotros</p><h2>{content.aboutTitle}<br /><em>{content.aboutHighlight}</em></h2><p>{content.aboutText}</p><a className="text-link" href="#contacto">Hablemos de tu idea <ArrowRight size={15} /></a></div><div className="story-quote"><span>“</span><p>Lo imperfecto es parte de lo encantador.</p><small>— filosofía Lúmina</small></div></section>

      <footer id="contacto" className="site-footer page-width"><div className="footer-brand"><span className="brand-mark">✦</span><span>LÚMINA<small>hecho a mano</small></span></div><div className="footer-contact"><p>¿Tienes una idea especial?</p><a href={`tel:${content.phone.replace(/\s/g, '')}`}><Phone size={14} /> {content.phone}</a><a href={`mailto:${content.email}`}><Mail size={14} /> {content.email}</a></div><div className="footer-links"><a href="#inicio">Inicio</a><a href="#tienda">Tienda</a><a href="#nosotros">Sobre nosotros</a></div></footer>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="account-dialog">
          <DialogHeader><div className="account-mark">✦</div><DialogTitle>{sessionEmail ? 'Tu cuenta Lúmina' : accountMode === 'login' ? 'Bienvenida de vuelta' : 'Crea tu cuenta'}</DialogTitle><DialogDescription>{sessionEmail ? `Sesión iniciada como ${sessionEmail}` : accountMode === 'login' ? 'Ingresa a tu cuenta para continuar en la tienda.' : 'Crea tu cuenta con tu correo electrónico.'}</DialogDescription></DialogHeader>
          {sessionEmail ? <div className="signed-account">{isAdmin && <a href="/admin">Ir al panel de administración</a>}<Button variant="outline" onClick={handleSignOut}>Cerrar sesión</Button></div> : <>
            <form className="account-form" onSubmit={handleAccountSubmit}>
              {accountMode === 'register' && <label>Nombre<Input required value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Tu nombre" autoComplete="name" /></label>}
              <label>Correo electrónico<div className="input-with-icon"><Mail size={17} /><Input required type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="tu@correo.com" autoComplete="email" /></div></label>
              <label>Contraseña<div className="input-with-icon"><LockKeyhole size={17} /><Input required minLength={6} type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder="••••••••" autoComplete={accountMode === 'login' ? 'current-password' : 'new-password'} /></div></label>
              {accountMessage && <p className="account-message">{accountMessage}</p>}
              <Button disabled={accountBusy || !isSupabaseConfigured} type="submit" className="primary-button account-submit">{accountBusy ? 'Procesando...' : accountMode === 'login' ? 'Iniciar sesión' : 'Registrarme'} <ArrowRight size={16} /></Button>
            </form>
            <div className="login-divider"><span /> o <span /></div>
            <Button variant="outline" className="google-button" disabled={!isSupabaseConfigured || accountBusy} onClick={handleGoogleLogin}><strong>G</strong> Continuar con Google</Button>
            {!isSupabaseConfigured && <p className="account-message">El acceso a cuentas no está disponible por el momento.</p>}
            <p className="account-switch">{accountMode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'} <button onClick={() => { setAccountMode(accountMode === 'login' ? 'register' : 'login'); setAccountMessage(''); }}>{accountMode === 'login' ? 'Regístrate' : 'Inicia sesión'}</button></p>
          </>}
        </DialogContent>
      </Dialog>

      {notice && <div className="notice" role="status"><Check size={16} /> {notice}</div>}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="cart-panel">
          <DialogHeader className="cart-heading"><p className="section-kicker">Tu selección</p><DialogTitle>Tu bolsita ({cartProducts.length})</DialogTitle><DialogDescription>Tus próximos compañeros, hechos a mano.</DialogDescription></DialogHeader>
          {cartProducts.length === 0 ? <div className="empty-cart"><span aria-hidden="true">♡</span><p>Tu bolsita está esperando<br />algo bonito.</p><Button className="primary-button" onClick={() => { setCartOpen(false); document.getElementById('tienda')?.scrollIntoView({ behavior: 'smooth' }); }}>Explorar tienda</Button></div> : <>
            <div className="cart-items">{cartProducts.map((product, index) => <div className="cart-item" key={`${product.id}-${index}`}><div className="cart-thumb" style={{ backgroundColor: product.color }}><ProductArtwork product={product} /></div><div><h3>{product.name}</h3><p>{formatPrice(product.price)}</p></div><button aria-label={`Eliminar una unidad de ${product.name}`} onClick={() => setCart((current) => { const at = current.indexOf(product.id); return current.filter((_, i) => i !== at); })}><Minus size={15} /></button></div>)}</div>
            <div className="cart-total"><span>Subtotal</span><strong>{formatPrice(total)}</strong></div><p className="cart-shipping-note">El envío se calcula al elegir tu región.</p><Button className="primary-button checkout-button" disabled={storeLoading || !!storeError} onClick={() => { setCartOpen(false); setCheckoutError(''); setCheckoutOpen(true); }}>Continuar compra <ArrowRight size={17} /></Button>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="checkout-dialog">
          <DialogHeader><DialogTitle>Datos de envío</DialogTitle><DialogDescription>Necesitamos esto para calcular el envío y despachar tu pedido.</DialogDescription></DialogHeader>
          <form className="checkout-form" onSubmit={handleCheckout}>
            <label>Nombre completo<Input required autoComplete="name" maxLength={120} value={shipping.name} onChange={(event) => setShipping({ ...shipping, name: event.target.value })} /></label>
            <label>Correo electrónico<Input required autoComplete="email" type="email" maxLength={254} value={shipping.email} onChange={(event) => setShipping({ ...shipping, email: event.target.value })} /></label>
            <label>Teléfono<Input required type="tel" autoComplete="tel" maxLength={40} value={shipping.phone} onChange={(event) => setShipping({ ...shipping, phone: event.target.value })} placeholder="+56 9 ..." /></label>
            <label>Región<NativeSelect required className="admin-select" value={shipping.region} onChange={(event) => setShipping({ ...shipping, region: event.target.value })}>
              <NativeSelectOption value="">Selecciona tu región</NativeSelectOption>
              {CHILE_REGIONS.map((region) => <NativeSelectOption key={region} value={region}>{region}</NativeSelectOption>)}
            </NativeSelect></label>
            <label>Comuna<Input required maxLength={120} value={shipping.comuna} onChange={(event) => setShipping({ ...shipping, comuna: event.target.value })} /></label>
            <label>Dirección<Input required autoComplete="address-line1" maxLength={250} value={shipping.address} onChange={(event) => setShipping({ ...shipping, address: event.target.value })} placeholder="Calle, número" /></label>
            <label>Depto / referencia (opcional)<Input autoComplete="address-line2" maxLength={250} value={shipping.addressExtra} onChange={(event) => setShipping({ ...shipping, addressExtra: event.target.value })} /></label>
            <div className="checkout-summary">
              <div><span>Productos</span><strong>{formatPrice(total)}</strong></div>
              <div><span>Envío{shipping.region ? '' : ' (elige región)'}</span><strong>{shipping.region ? (shippingCost === null ? 'No disponible' : shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost)) : '—'}</strong></div>
              <div className="checkout-total"><span>Total</span><strong>{shippingCost === null ? "Por calcular" : formatPrice(grandTotal)}</strong></div>
            </div>
            {checkoutError && <p className="account-message">{checkoutError}</p>}
            <Button disabled={checkoutBusy || shippingCost === null || cartProducts.length === 0} type="submit" className="primary-button account-submit">{checkoutBusy ? 'Redirigiendo a Mercado Pago…' : 'Pagar con Mercado Pago'} <ArrowRight size={16} /></Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
