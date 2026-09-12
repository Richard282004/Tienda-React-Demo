'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Heart,
  LockKeyhole,
  Mail,
  MessageCircle,
  Menu,
  Pause,
  Play,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
  X,
} from 'lucide-react';

import { ProductArtwork } from '@/components/product-artwork';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { defaultProducts, defaultStoreContent, readCachedStoreContent, writeCachedStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { type Faq, type Review, type ShowcaseItem } from '@/lib/orders';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { formatPrice as formatCurrency } from '@/lib/currency';
import { levenshteinWithin, normalizeSearchText } from '@/lib/search';

export default function Home() {
  const [products, setProducts] = useState<Product[]>(isSupabaseConfigured ? [] : defaultProducts);
  const [content, setContent] = useState<StoreContent>(readCachedStoreContent);
  const categories = useMemo(() => ['Todo', ...content.categories], [content.categories]);
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);
  const [storeLoading, setStoreLoading] = useState(isSupabaseConfigured);
  const [storeError, setStoreError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [category, setCategory] = useState('Todo');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<'login' | 'register'>('login');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [carouselHovering, setCarouselHovering] = useState(false);
  const [scrolledPastHeader, setScrolledPastHeader] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolledPastHeader(window.scrollY > 420);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    // Bloquea el scroll del fondo mientras el menú lateral está abierto.
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);
  useEffect(() => {
    // Aprovecha cada visita para liberar el stock de pedidos abandonados
    // (pending sin pago hace más de 10 min), sin depender de un cron.
    fetch('/api/orders/expire', { method: 'POST' }).catch(() => {});
  }, []);


  const visibleProducts = useMemo(
    () => (category === 'Todo' ? products : products.filter((product) => product.type === category)),
    [category, products],
  );
  const searchResults = useMemo(() => {
    const words = normalizeSearchText(search).split(/\s+/).filter(Boolean);
    if (!words.length) return products.slice(0, 4);
    return products.filter((product) => {
      const haystack = normalizeSearchText(`${product.name} ${product.type} ${product.tag ?? ''}`);
      const tokens = haystack.split(/\s+/);
      return words.every((word) => haystack.includes(word) || tokens.some((token) => levenshteinWithin(token, word, 1)));
    });
  }, [search, products]);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [reviewsProduct, setReviewsProduct] = useState<Product | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  const addToCart = (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product || product.active === false) return;
    const inCart = cart.filter((item) => item === id).length;
    if (product.stock != null && inCart >= product.stock) { setNotice('No quedan más unidades disponibles'); window.setTimeout(() => setNotice(''), 2200); return; }
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
      setSessionUserId(user?.id ?? null);
      setIsAdmin(false);
      if (!user) return;
      const { data } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (active && revision === sessionRevision) setIsAdmin(data?.role === 'admin');
    };
    const loadStore = async () => {
      try {
        const [catalog, settings, reviewRows, showcaseRows, faqRows] = await Promise.all([
          client.from('products').select('*').eq('active', true).order('sort_order'),
          client.from('site_content').select('value').eq('key', 'store').maybeSingle(),
          client.from('reviews').select('*').order('created_at', { ascending: false }),
          client.from('showcase_items').select('*').eq('active', true).order('sort_order'),
          client.from('faqs').select('*').eq('active', true).order('sort_order'),
        ]);
        if (!active) return;
        if (catalog.error) { setStoreError('No pudimos cargar la colección. Intenta recargar la página.'); return; }
        setProducts((catalog.data ?? []) as Product[]);
        const available = new Set((catalog.data ?? []).map((product) => product.id));
        setCart((current) => current.filter((id) => available.has(id)));
        if (settings.data?.value) {
          const merged = { ...defaultStoreContent, ...(settings.data.value as Partial<StoreContent>) };
          setContent(merged);
          writeCachedStoreContent(merged);
        }
        const reviewsByProduct: Record<string, Review[]> = {};
        for (const review of (reviewRows.data ?? []) as Review[]) (reviewsByProduct[review.product_id] ??= []).push(review);
        setReviews(reviewsByProduct);
        setShowcaseItems((showcaseRows.data ?? []) as ShowcaseItem[]);
        setFaqs((faqRows.data ?? []) as Faq[]);
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
    if (!carouselApi || carouselPaused || carouselHovering) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => carouselApi.scrollNext(), 3200);
    return () => window.clearInterval(interval);
  }, [carouselApi, carouselPaused, carouselHovering]);

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
        description: `Muestra los productos de la categoría elegida: ${categories.join(', ')}.`,
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
  }, [cart.length, products, categories]);

  const openAccount = (mode: 'login' | 'register') => {
    setAccountMode(mode);
    setAccountMessage('');
    setAccountOpen(true);
  };

  useEffect(() => {
    // Permite abrir el modal de cuenta llegando desde otra página (ej. el
    // ícono de cuenta en la ficha de producto) vía ?account=1.
    if (new URLSearchParams(window.location.search).get('account') === '1') {
      openAccount('login');
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
  }, []);

  const passwordRules = [
    { test: (value: string) => value.length >= 8, label: 'mínimo 8 caracteres' },
    { test: (value: string) => /[A-Z]/.test(value), label: 'una mayúscula' },
    { test: (value: string) => /[0-9]/.test(value), label: 'un número' },
    { test: (value: string) => /[^A-Za-z0-9]/.test(value), label: 'un símbolo (@, #, !...)' },
  ];
  const passwordIssues = passwordRules.filter((rule) => !rule.test(accountPassword)).map((rule) => rule.label);

  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setAccountMessage('El acceso a cuentas no está disponible por el momento.'); return; }
    if (accountMode === 'register' && passwordIssues.length) {
      setAccountMessage(`La contraseña necesita: ${passwordIssues.join(', ')}.`);
      return;
    }
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

  const handleForgotPassword = async () => {
    if (!supabase) { setAccountMessage('El acceso a cuentas no está disponible por el momento.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail.trim())) {
      setAccountMessage('Escribe tu correo arriba y te enviamos un enlace para crear una contraseña nueva.');
      return;
    }
    setAccountBusy(true);
    setAccountMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(accountEmail.trim(), {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    setAccountBusy(false);
    setAccountMessage(
      error
        ? 'No pudimos enviar el correo. Inténtalo de nuevo en unos minutos.'
        : 'Te enviamos un enlace a tu correo para crear una contraseña nueva.',
    );
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

  const openReviews = (product: Product) => {
    setReviewsProduct(product);
    setReviewRating(5);
    setReviewComment('');
    setReviewMessage('');
  };

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !reviewsProduct) return;
    if (!sessionUserId) { setReviewMessage('Inicia sesión para dejar una reseña.'); return; }
    setReviewBusy(true);
    setReviewMessage('');
    const { error } = await supabase.from('reviews').insert({
      product_id: reviewsProduct.id,
      user_id: sessionUserId,
      customer_name: sessionEmail?.split('@')[0] ?? 'Cliente',
      rating: reviewRating,
      comment: reviewComment || null,
    });
    setReviewBusy(false);
    if (error) { setReviewMessage('No pudimos guardar tu reseña. Intenta de nuevo.'); return; }
    const { data } = await supabase.from('reviews').select('*').eq('product_id', reviewsProduct.id).order('created_at', { ascending: false });
    setReviews((current) => ({ ...current, [reviewsProduct.id]: (data ?? []) as Review[] }));
    setReviewComment('');
    setReviewMessage('¡Gracias por tu reseña!');
  };

  return (
    <main className="site-shell">
      <a className="skip-link" href="#tienda">Saltar a la colección</a>
      <div className="utility-bar">
        <span><Truck size={15} /> Envíos a todo Chile</span>
        {!storeLoading && <span className="utility-message">{content.shippingMessage}</span>}
        <div className="utility-actions">
          <a href={`tel:${content.phone.replace(/\s/g, '')}`}><Phone size={14} /> {content.phone}</a>
          <button onClick={() => openAccount('login')}><UserRound size={14} /> {sessionEmail ?? 'Iniciar sesión'}</button>
          {sessionEmail ? <button className="register-link" onClick={handleSignOut}>Cerrar sesión</button> : <button className="register-link" onClick={() => openAccount('register')}>Crear cuenta</button>}
        </div>
      </div>

      <header className="site-header">
        <a href="#inicio" className="brand" aria-label={`${content.brandName}, inicio`}>
          {content.logoUrl ? (
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
          ) : (
            <span className="brand-mark">✦</span>
          )}
          {!(content.logoUrl && content.hideBrandText) && <span><b className="brand-name">{content.brandName}</b><small>{content.brandTagline}</small></span>}
        </a>
        <nav id="main-navigation" className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Navegación principal">
          <a href="#inicio" onClick={() => setMenuOpen(false)}>Inicio</a>
          <a href="#tienda" onClick={() => setMenuOpen(false)}>Tienda</a>
          <a href="#nosotros" onClick={() => setMenuOpen(false)}>Sobre nosotros</a>
          <a href="#contacto" onClick={() => setMenuOpen(false)}>Contáctanos</a><a href="/favoritos" onClick={() => setMenuOpen(false)}>Favoritos</a>
        </nav>
        <div className="header-actions">
          <Button aria-label={`Ver favoritos, ${favorites.length} guardados`} variant="ghost" size="icon" className="icon-button bag-button" onClick={() => { window.location.href = '/favoritos'; }}><Heart key={`fav-heart-${favorites.length}`} className="heart-pop" size={19} fill={favorites.length ? 'currentColor' : 'none'} />{favorites.length > 0 && <span key={`fav-badge-${favorites.length}`} className="bag-badge">{favorites.length}</span>}</Button>
          <Button aria-label="Buscar productos" variant="ghost" size="icon" className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={() => setSearchOpen((open) => !open)}><Search size={19} /></Button>
          <Button aria-label="Mi cuenta" variant="ghost" size="icon" className="icon-button account-icon" onClick={() => openAccount('login')}><UserRound size={19} /></Button>
          <Button aria-label={`Abrir bolsita, ${cart.length} productos`} variant="ghost" size="icon" className="bag-button" onClick={() => { window.location.href = '/carrito'; }}><ShoppingBag size={19} />{cart.length > 0 && <span key={cart.length} className="bag-badge">{cart.length}</span>}</Button>
          <Button aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} aria-controls="main-navigation" variant="ghost" size="icon" className="menu-button" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</Button>
        </div>
      </header>
      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      {searchOpen && (
        <>
        <div className="search-overlay" onClick={() => { setSearchOpen(false); setSearch(''); }} aria-hidden="true" />
        <section className="search-panel" aria-label="Buscador de productos">
          <div className="search-panel-inner page-width">
            <div className="search-field"><Search size={19} /><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca llaveros, peluches o un personaje..." aria-label="Buscar en la tienda" /><button onClick={() => { setSearchOpen(false); setSearch(''); }} aria-label="Cerrar buscador"><X size={18} /></button></div>
            <div className="search-results">
              {searchResults.length ? searchResults.map((product) => <button key={product.id} onClick={() => { setSearchOpen(false); setSearch(''); setCategory('Todo'); window.setTimeout(() => document.getElementById(`producto-${product.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }}><span style={{ backgroundColor: product.color }}><ProductArtwork product={product} /></span><span><strong>{product.name}</strong><small>{product.type} · {formatPrice(product.price)}</small></span><ArrowRight size={15} /></button>) : <p>No encontramos productos con ese nombre.</p>}
            </div>
          </div>
        </section>
        </>
      )}

      <section id="inicio" className="hero-section page-width">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> {content.heroEyebrow}</div>
          <h1>{content.heroTitle}<br /><em>{content.heroHighlight}</em></h1>
          <p>{content.heroDescription}</p>
          <div className="hero-actions"><Button className="primary-button" onClick={() => document.getElementById('tienda')?.scrollIntoView({ behavior: 'smooth' })}>{content.heroCtaPrimary} <ArrowRight size={17} /></Button><a className="text-link" href="#nosotros">{content.heroCtaSecondary} <ArrowRight size={15} /></a></div>
          <div className="hero-notes"><span><Check size={15} /> {content.heroNote1}</span><span><Check size={15} /> {content.heroNote2}</span></div>
        </div>
        <div className="hero-image-wrap"><div className="hero-scribble">para regalar<br />o regalarte <span>♡</span></div><img src="/lumina-hero.jpg" alt="Tres productos de crochet: un conejo, un oso y un hongo" className="hero-image" width={1122} height={1402} fetchPriority="high" /><div className="hero-sticker">nuevos<br /><strong>amiguitos</strong></div></div>
      </section>

      <section className="work-showcase" aria-label="Trabajos recientes">
        <div className="showcase-heading page-width"><div><p className="section-kicker">Trabajos recientes</p><h2>Hechos para <em>acompañarte</em></h2></div><div className="carousel-controls"><button className="pause-carousel" aria-label={carouselPaused ? 'Reanudar carrusel automático' : 'Pausar carrusel automático'} onClick={() => setCarouselPaused((paused) => !paused)}>{carouselPaused ? <Play size={16} /> : <Pause size={16} />}</button><button aria-label="Ver productos anteriores" onClick={() => carouselApi?.scrollPrev()}><ArrowLeft size={18} /></button><button aria-label="Ver siguientes productos" onClick={() => carouselApi?.scrollNext()}><ArrowRight size={18} /></button></div></div>
        <Carousel setApi={setCarouselApi} opts={{ loop: true, align: 'start' }} className="work-carousel page-width" onMouseEnter={() => setCarouselHovering(true)} onMouseLeave={() => setCarouselHovering(false)}>
          <CarouselContent className="carousel-track">
            {showcaseItems.length > 0
              ? showcaseItems.map((item) => (
                <CarouselItem className="work-slide" key={item.id}>
                  <article className="work-card work-card-photo"><img src={item.image_url} alt={item.title} /><div><h3>{item.title}</h3>{item.subtitle && <p>{item.subtitle}</p>}</div></article>
                </CarouselItem>
              ))
              : products.map((product, index) => (
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

      <section className="category-strip page-width" aria-label="Categorías destacadas"><div><span className="category-icon pink">♡</span><span>{content.categoryText1}</span></div><div><span className="category-icon yellow">✳</span><span>{content.categoryText2}</span></div><div><span className="category-icon lilac">⌁</span><span>{content.categoryText3}</span></div></section>

      <section id="tienda" className="collection-section page-width">
        <div className="section-heading"><div><p className="section-kicker">La colección</p><h2>Elige tu nuevo <em>favorito</em></h2></div><div className="category-tabs" role="group" aria-label="Filtrar productos">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} aria-pressed={category === item}>{item === 'Todo' ? 'Todo' : item}</button>)}</div></div>
        {storeLoading && <p className="store-feedback" role="status">Preparando la colección…</p>}
        {storeError && <p className="store-feedback" role="alert">{storeError}</p>}
        {!storeLoading && !storeError && visibleProducts.length === 0 && <p className="empty-collection">Pronto habrá nuevos amiguitos por aquí. Vuelve a visitarnos.</p>}
        <div className="product-grid" key={category}>{visibleProducts.map((product) => {
          const outOfStock = product.active === false || (product.stock != null && product.stock <= 0);
          const lowStock = !outOfStock && product.stock != null && product.stock <= 5;
          const productReviews = reviews[product.id] ?? [];
          const avgRating = productReviews.length ? productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length : null;
          const goToProduct = () => { window.location.href = `/producto/${product.id}`; };
          return <article className="product-card" id={`producto-${product.id}`} key={product.id}>
            <div className="product-visual" style={{ backgroundColor: product.color }} onClick={goToProduct} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); goToProduct(); } }} role="link" tabIndex={0} aria-label={`Ver ${product.name}`}>
              {product.tag && <span className="product-tag">{product.tag}</span>}
              <button className={`heart-icon ${favorites.includes(product.id) ? 'liked' : ''}`} onClick={(event) => { event.stopPropagation(); setFavorites((current) => current.includes(product.id) ? current.filter((item) => item !== product.id) : [...current, product.id]); }} aria-pressed={favorites.includes(product.id)} aria-label={favorites.includes(product.id) ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}><Heart key={String(favorites.includes(product.id))} className="heart-pop" size={18} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button>
              <ProductArtwork product={product} className="product-photo" />
              <span className="yarn-shadow" />
            </div>
            <div className="product-info">
              <div>
                <h3 className="product-name-link" onClick={goToProduct}>{product.name}</h3>
                <p>{product.type} · tejido a mano</p>
                {product.description && <p className="product-description">{product.description}</p>}
                <button className="reviews-link" onClick={() => openReviews(product)}>
                  {avgRating ? <><Star size={13} fill="currentColor" /> {avgRating.toFixed(1)} ({productReviews.length})</> : 'Sé el primero en opinar'}
                </button>
                <span className={`availability-badge ${outOfStock ? 'unavailable' : 'available'}`}>{outOfStock ? 'Agotado' : lowStock ? `¡Últimas ${product.stock}!` : 'Disponible'}</span>
              </div>
              <strong>{formatPrice(product.price)}</strong>
            </div>
            <Button className="add-button" variant="outline" disabled={outOfStock} onClick={() => addToCart(product.id)}>Agregar a la bolsita <Plus size={16} /></Button>
          </article>;
        })}</div>
      </section>

      {faqs.length > 0 && <section className="faq-section page-width" aria-label="Preguntas frecuentes">
        <div className="showcase-heading"><div><p className="section-kicker">Ayuda</p><h2>Preguntas frecuentes</h2></div></div>
        <div className="faq-list">
          {faqs.map((faq) => {
            const isOpen = openFaq === faq.id;
            return <div className={`faq-item ${isOpen ? 'open' : ''}`} key={faq.id}>
              <button type="button" onClick={() => setOpenFaq(isOpen ? null : faq.id)} aria-expanded={isOpen}>{faq.question}<Plus size={16} className="faq-toggle-icon" /></button>
              {isOpen && <p>{faq.answer}</p>}
            </div>;
          })}
        </div>
      </section>}

      <section id="nosotros" className="story-section page-width"><div className="story-card"><p className="section-kicker">Sobre nosotros</p><h2>{content.aboutTitle}<br /><em>{content.aboutHighlight}</em></h2><p>{content.aboutText}</p><a className="text-link" href="#contacto">Hablemos de tu idea <ArrowRight size={15} /></a></div><div className="story-quote"><span>“</span><p>{content.storyQuote}</p><small>{content.storyQuoteAuthor}</small></div></section>

      <footer id="contacto" className="site-footer page-width"><div className="footer-brand">{content.logoUrl ? (
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
      ) : <span className="brand-mark">✦</span>}{!(content.logoUrl && content.hideBrandText) && <span><b className="brand-name">{content.brandName}</b><small>{content.brandTagline}</small></span>}</div><div className="footer-contact"><p>{content.footerCta}</p><a href={`tel:${content.phone.replace(/\s/g, '')}`}><Phone size={14} /> {content.phone}</a><a href={`mailto:${content.email}`}><Mail size={14} /> {content.email}</a></div><div className="footer-links"><a href="#inicio">Inicio</a><a href="#tienda">Tienda</a><a href="#nosotros">Sobre nosotros</a><a href="/terminos">Términos y condiciones</a><a href="/privacidad">Privacidad</a></div></footer>

      {cart.length > 0 && scrolledPastHeader && <button type="button" className="cart-fab" onClick={() => { window.location.href = '/carrito'; }} aria-label={`Abrir bolsita, ${cart.length} productos`}><ShoppingBag size={22} /><span key={cart.length} className="cart-fab-badge">{cart.length}</span></button>}
      {content.whatsapp && <a className="whatsapp-fab" href={`https://wa.me/${content.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7C17.18 3.03 14.69 2 12.04 2Zm0 18.12h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.19 8.19 0 0 1-1.26-4.33c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.26.86 5.82 2.41a8.16 8.16 0 0 1 2.41 5.82c0 4.53-3.69 8.2-8.2 8.2Zm4.51-6.15c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.96-.14.16-.29.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.83-.2-.48-.4-.42-.56-.42-.14 0-.31-.02-.47-.02s-.43.06-.66.31c-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" /></svg></a>}

      <Dialog open={!!reviewsProduct} onOpenChange={(open) => !open && setReviewsProduct(null)}>
        <DialogContent className="reviews-dialog">
          <DialogHeader><DialogTitle>Reseñas de {reviewsProduct?.name}</DialogTitle><DialogDescription>Lo que dicen quienes ya compraron.</DialogDescription></DialogHeader>
          <div className="reviews-list">
            {(reviewsProduct ? reviews[reviewsProduct.id] ?? [] : []).length === 0 && <p className="reviews-empty">Aún no hay reseñas para este producto.</p>}
            {(reviewsProduct ? reviews[reviewsProduct.id] ?? [] : []).map((review) => <div className="review-item" key={review.id}>
              <div className="review-stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < review.rating ? 'currentColor' : 'none'} />)}</div>
              <p>{review.comment}</p>
              <small>{review.customer_name} · {new Date(review.created_at).toLocaleDateString('es-CL')}</small>
            </div>)}
          </div>
          <form className="review-form" onSubmit={submitReview}>
            <label>Tu calificación
              <div className="review-star-picker">{Array.from({ length: 5 }, (_, index) => <button type="button" key={index} onClick={() => setReviewRating(index + 1)} aria-label={`${index + 1} estrellas`}><Star size={20} fill={index < reviewRating ? 'currentColor' : 'none'} /></button>)}</div>
            </label>
            <label>Comentario (opcional)<Textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Cuéntanos qué te pareció" /></label>
            {reviewMessage && <p className="account-message">{reviewMessage}</p>}
            <Button disabled={reviewBusy} type="submit" className="primary-button">{reviewBusy ? 'Enviando…' : 'Publicar reseña'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="account-dialog">
          <DialogHeader>{content.logoUrl ? <img className="account-mark-logo" src={content.logoUrl} alt="" /> : <div className="account-mark">✦</div>}<DialogTitle>{sessionEmail ? `Tu cuenta ${content.brandName}` : accountMode === 'login' ? 'Hola de nuevo' : 'Crea tu cuenta'}</DialogTitle><DialogDescription>{sessionEmail ? `Sesión iniciada como ${sessionEmail}` : accountMode === 'login' ? 'Ingresa a tu cuenta para continuar en la tienda.' : 'Crea tu cuenta con tu correo electrónico.'}</DialogDescription></DialogHeader>
          {sessionEmail ? <div className="signed-account"><a href="/mi-cuenta">Resumen de tu cuenta</a>{isAdmin && <a href="/admin">Ir al panel de administración</a>}<Button variant="outline" onClick={handleSignOut}>Cerrar sesión</Button></div> : <>
            <form className="account-form" onSubmit={handleAccountSubmit}>
              {accountMode === 'register' && <label>Nombre<Input required value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Tu nombre" autoComplete="name" /></label>}
              <label>Correo electrónico<div className="input-with-icon"><Mail size={17} /><Input required type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="tu@correo.com" autoComplete="email" /></div></label>
              <label>Contraseña<div className="input-with-icon"><LockKeyhole size={17} /><Input required minLength={8} type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder="••••••••" autoComplete={accountMode === 'login' ? 'current-password' : 'new-password'} /></div>
                {accountMode === 'register' && <small className="password-hint">{accountPassword ? (passwordIssues.length ? `Falta: ${passwordIssues.join(', ')}.` : '✓ Contraseña segura') : 'Mínimo 8 caracteres, una mayúscula, un número y un símbolo (@, #, !...).'}</small>}
              </label>
              {accountMode === 'login' && <button type="button" className="account-forgot" onClick={handleForgotPassword} disabled={accountBusy || !isSupabaseConfigured}>¿Olvidaste tu contraseña?</button>}
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

    </main>
  );
}
