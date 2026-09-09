'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Clock, DollarSign, FileText, GripVertical, HelpCircle, ImagePlus, Images, LogOut, Package, PackagePlus, Pencil, Save, ShieldCheck, Star, Tag, Trash2, Truck, Upload, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageCropDialog } from '@/components/image-crop-dialog';
import { OrderChat } from '@/components/order-chat';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { defaultStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { orderStatusLabel, type DiscountCode, type Faq, type Order, type OrderStatus, type Profile, type ProductImage, type Review, type ShippingRate, type ShowcaseItem } from '@/lib/orders';
import { formatPrice as formatCurrency } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import './admin.css';

type AdminState = 'loading' | 'setup' | 'login' | 'denied' | 'ready';
type ProductDraft = Omit<Product, 'id'> & { id?: string };

const emptyProduct: ProductDraft = {
  name: '', description: '', type: 'Llaveros', price: 0, color: '#f3dedb', art: '🧶', image_url: null,
  image_position_x: 50, image_position_y: 50, image_zoom: 1, tag: '', active: true, sort_order: 0, stock: null,
};

const emptyDiscount = { code: '', type: 'percent' as 'percent' | 'fixed', value: 10, active: true, max_uses: '' as number | '', expires_at: '' };

export default function AdminPage() {
  const [state, setState] = useState<AdminState>('loading');
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [newShippingRegion, setNewShippingRegion] = useState('');
  const [newShippingCost, setNewShippingCost] = useState(0);
  const [newShippingRequiresAddress, setNewShippingRequiresAddress] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<ProductImage[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropTarget, setCropTarget] = useState<'product' | 'gallery' | 'showcase' | null>(null);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [discountDraft, setDiscountDraft] = useState(emptyDiscount);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [showcaseFile, setShowcaseFile] = useState<File | null>(null);
  const [showcaseBusy, setShowcaseBusy] = useState(false);
  const [showcaseDraft, setShowcaseDraft] = useState({ title: '', subtitle: '' });
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [faqDraft, setFaqDraft] = useState({ question: '', answer: '' });

  const loadAdminData = async () => {
    if (!supabase) return;
    const [{ data: productRows, error: productError }, { data: contentRow, error: contentError }, { data: orderRows }, { data: rateRows }, { data: discountRows }, { data: reviewRows }, { data: profileRows }, { data: showcaseRows }, { data: faqRows }] = await Promise.all([
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('site_content').select('value').eq('key', 'store').maybeSingle(),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('shipping_rates').select('region, cost, requires_address').order('region'),
      supabase.from('discount_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('showcase_items').select('*').order('sort_order'),
      supabase.from('faqs').select('*').order('sort_order'),
    ]);
    if (productError || contentError) { setMessage(productError?.message ?? contentError?.message ?? 'No se pudo cargar la información.'); return; }
    setProducts((productRows ?? []) as Product[]);
    if (contentRow?.value) setContent({ ...defaultStoreContent, ...(contentRow.value as Partial<StoreContent>) });
    setOrders((orderRows ?? []) as Order[]);
    if (rateRows?.length) setShippingRates(rateRows as ShippingRate[]);
    setDiscounts((discountRows ?? []) as DiscountCode[]);
    setReviews((reviewRows ?? []) as Review[]);
    setProfiles((profileRows ?? []) as Profile[]);
    setShowcaseItems((showcaseRows ?? []) as ShowcaseItem[]);
    setFaqs((faqRows ?? []) as Faq[]);
  };

  const addShowcaseItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !showcaseFile) { setMessage('Elige una foto para la vitrina.'); return; }
    setShowcaseBusy(true); setMessage('');
    const safeName = showcaseFile.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    const path = `showcase-${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('products').upload(path, showcaseFile, { cacheControl: '3600' });
    if (uploadError) { setShowcaseBusy(false); setMessage(uploadError.message); return; }
    const imageUrl = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from('showcase_items').insert({ title: showcaseDraft.title || 'Trabajo reciente', subtitle: showcaseDraft.subtitle || null, image_url: imageUrl, sort_order: showcaseItems.length });
    setShowcaseBusy(false);
    if (error) { setMessage(error.message); return; }
    setShowcaseDraft({ title: '', subtitle: '' });
    setShowcaseFile(null);
    await loadAdminData();
  };

  const toggleShowcaseActive = async (id: string, active: boolean) => {
    if (!supabase) return;
    await supabase.from('showcase_items').update({ active }).eq('id', id);
    setShowcaseItems((current) => current.map((item) => (item.id === id ? { ...item, active } : item)));
  };

  const deleteShowcaseItem = async (id: string) => {
    if (!supabase || !window.confirm('¿Eliminar esta foto de la vitrina?')) return;
    await supabase.from('showcase_items').delete().eq('id', id);
    setShowcaseItems((current) => current.filter((item) => item.id !== id));
  };

  const saveFaq = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.from('faqs').insert({ question: faqDraft.question, answer: faqDraft.answer, sort_order: faqs.length });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setFaqDraft({ question: '', answer: '' });
    await loadAdminData();
  };

  const toggleFaqActive = async (id: string, active: boolean) => {
    if (!supabase) return;
    await supabase.from('faqs').update({ active }).eq('id', id);
    setFaqs((current) => current.map((faq) => (faq.id === id ? { ...faq, active } : faq)));
  };

  const deleteFaq = async (id: string) => {
    if (!supabase || !window.confirm('¿Eliminar esta pregunta?')) return;
    await supabase.from('faqs').delete().eq('id', id);
    setFaqs((current) => current.filter((faq) => faq.id !== id));
  };

  const saveDiscount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.from('discount_codes').upsert({
      code: discountDraft.code.trim().toUpperCase(),
      type: discountDraft.type,
      value: Number(discountDraft.value),
      active: discountDraft.active,
      max_uses: discountDraft.max_uses === '' ? null : Number(discountDraft.max_uses),
      expires_at: discountDraft.expires_at || null,
    });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Código de descuento guardado.');
    setDiscountDraft(emptyDiscount);
    await loadAdminData();
  };

  const deleteDiscount = async (code: string) => {
    if (!supabase || !window.confirm(`¿Eliminar el código ${code}?`)) return;
    const { error } = await supabase.from('discount_codes').delete().eq('code', code);
    if (error) setMessage(error.message); else await loadAdminData();
  };

  const toggleDiscountActive = async (code: string, active: boolean) => {
    if (!supabase) return;
    await supabase.from('discount_codes').update({ active }).eq('code', code);
    await loadAdminData();
  };

  const toggleReviewApproved = async (id: string, approved: boolean) => {
    if (!supabase) return;
    setReviews((current) => current.map((review) => (review.id === id ? { ...review, approved } : review)));
    await supabase.from('reviews').update({ approved }).eq('id', id);
  };

  const deleteReview = async (id: string) => {
    if (!supabase || !window.confirm('¿Eliminar esta reseña?')) return;
    await supabase.from('reviews').delete().eq('id', id);
    setReviews((current) => current.filter((review) => review.id !== id));
  };

  const toggleAdminRole = async (profile: Profile) => {
    if (!supabase) return;
    if (profile.id === currentUserId && profile.role === 'admin') { setMessage('No puedes quitarte tu propio acceso de administradora.'); return; }
    const nextRole = profile.role === 'admin' ? 'customer' : 'admin';
    if (!window.confirm(`¿${nextRole === 'admin' ? 'Dar' : 'Quitar'} acceso de administradora a ${profile.email ?? profile.id}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', profile.id);
    if (error) { setMessage(error.message); return; }
    setProfiles((current) => current.map((item) => (item.id === profile.id ? { ...item, role: nextRole } : item)));
  };

  const updateOrder = async (orderId: string, patch: Partial<Pick<Order, 'status' | 'tracking_number'>>) => {
    if (!supabase) return;
    const previous = orders.find((item) => item.id === orderId);
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, ...patch } : order)));
    // Cancelar a mano no pasa por Mercado Pago solo: este endpoint reembolsa
    // de verdad (si ya se cobró), devuelve el stock y cambia el estado.
    if (patch.status === 'cancelled' && previous && previous.status !== 'cancelled') {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      try {
        const response = await fetch('/api/orders/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ orderId }),
        });
        const result = (await response.json()) as { error?: string; refunded?: boolean; refundError?: string };
        if (!response.ok || result.error) { setMessage(result.error ?? 'No se pudo cancelar el pedido.'); await loadAdminData(); return; }
        setMessage(result.refunded ? 'Pedido cancelado y reembolsado en Mercado Pago.' : result.refundError ? `Pedido cancelado, pero el reembolso automático falló: ${result.refundError}. Revisa el reembolso a mano en Mercado Pago.` : 'Pedido cancelado.');
      } catch {
        setMessage('No se pudo conectar para cancelar el pedido.');
        await loadAdminData();
        return;
      }
      if (patch.tracking_number !== undefined) {
        await supabase.from('orders').update({ tracking_number: patch.tracking_number }).eq('id', orderId);
      }
    } else {
      const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
      if (error) { setMessage(error.message); await loadAdminData(); return; }
    }
    if (patch.status) {
      const order = previous;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        void fetch('/api/orders/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderId, status: patch.status, trackingNumber: patch.tracking_number ?? order?.tracking_number ?? null }),
        }).catch(() => {});
      }
    }
  };

  const saveShippingRate = async (region: string, cost: number) => {
    if (!supabase) return;
    const { error } = await supabase.from('shipping_rates').update({ cost, updated_at: new Date().toISOString() }).eq('region', region);
    setMessage(error ? error.message : `Costo de envío actualizado para ${region}.`);
  };

  const addShippingRate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !newShippingRegion.trim()) return;
    const { error } = await supabase.from('shipping_rates').insert({ region: newShippingRegion.trim(), cost: newShippingCost, requires_address: newShippingRequiresAddress });
    if (error) { setMessage(error.message); return; }
    const { data } = await supabase.from('shipping_rates').select('region, cost, requires_address').order('region');
    setShippingRates((data ?? []) as ShippingRate[]);
    setNewShippingRegion('');
    setNewShippingCost(0);
    setNewShippingRequiresAddress(true);
  };

  const toggleShippingRequiresAddress = async (region: string, requiresAddress: boolean) => {
    if (!supabase) return;
    await supabase.from('shipping_rates').update({ requires_address: requiresAddress }).eq('region', region);
    setShippingRates((current) => current.map((rate) => (rate.region === region ? { ...rate, requires_address: requiresAddress } : rate)));
  };

  const deleteShippingRate = async (region: string) => {
    if (!supabase) return;
    await supabase.from('shipping_rates').delete().eq('region', region);
    setShippingRates((current) => current.filter((rate) => rate.region !== region));
  };

  const resolveSession = async () => {
    if (!supabase) { setState('setup'); return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setState('login'); return; }
    const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
    if (error || profile?.role !== 'admin') { setState('denied'); return; }
    setCurrentUserId(data.session.user.id);
    setState('ready');
    await loadAdminData();
  };

  useEffect(() => {
    void resolveSession();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => { window.setTimeout(() => void resolveSession(), 0); });
    return () => data.subscription.unsubscribe();
  }, []);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage(error.message); else await resolveSession();
  };

  const googleLogin = async () => {
    if (!supabase || busy) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/admin` } });
      if (error) setMessage('No pudimos abrir Google. Inténtalo nuevamente.');
    } catch {
      setMessage('No pudimos conectar con Google. Revisa tu conexión.');
    } finally { setBusy(false); }
  };

  const logout = async () => {
    await supabase?.auth.signOut();
    setState('login');
  };

  const openNewProduct = () => {
    setDraft({ ...emptyProduct, type: content.categories[0] ?? '', sort_order: products.length + 1 });
    setImageFile(null);
    setImagePreview(null);
    setGallery([]);
    setProductOpen(true);
  };

  const openEditProduct = async (product: Product) => {
    setDraft({ ...product, image_position_x: product.image_position_x ?? 50, image_position_y: product.image_position_y ?? 50, image_zoom: product.image_zoom ?? 1 });
    setImageFile(null);
    setImagePreview(null);
    setGallery([]);
    setProductOpen(true);
    if (!supabase) return;
    const { data } = await supabase.from('product_images').select('*').eq('product_id', product.id).order('sort_order');
    setGallery((data ?? []) as ProductImage[]);
  };

  const handleImageFile = (file: File | null) => {
    setImageFile(file);
    setImagePreview((current) => { if (current) URL.revokeObjectURL(current); return file ? URL.createObjectURL(file) : null; });
  };

  // Toda foto nueva (producto, galería o vitrina) pasa primero por el
  // recorte cuadrado obligatorio, para que se vea igual de bien en la
  // tarjeta grande, la miniatura del carrito y la galería.
  const startCrop = (files: File[], target: 'product' | 'gallery' | 'showcase') => {
    if (!files.length) return;
    setCropQueue(files);
    setCropTarget(target);
  };
  const onCropCancel = () => { setCropQueue([]); setCropTarget(null); };
  const uploadSingleGalleryPhoto = async (file: File) => {
    if (!supabase || !draft.id) return;
    const path = `${crypto.randomUUID()}-foto.jpg`;
    const { error: uploadError } = await supabase.storage.from('products').upload(path, file, { cacheControl: '3600' });
    if (uploadError) { setMessage(uploadError.message); return; }
    const imageUrl = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
    await supabase.from('product_images').insert({ product_id: draft.id, image_url: imageUrl, sort_order: gallery.length });
    const { data } = await supabase.from('product_images').select('*').eq('product_id', draft.id).order('sort_order');
    setGallery((data ?? []) as ProductImage[]);
  };
  const onCropConfirm = async (blob: Blob) => {
    const file = new File([blob], 'foto.jpg', { type: 'image/jpeg' });
    if (cropTarget === 'product') handleImageFile(file);
    if (cropTarget === 'showcase') setShowcaseFile(file);
    if (cropTarget === 'gallery') { setGalleryBusy(true); await uploadSingleGalleryPhoto(file); }
    setCropQueue((current) => {
      const next = current.slice(1);
      if (!next.length) { setCropTarget(null); setGalleryBusy(false); }
      return next;
    });
  };

  const addGalleryPhotos = (files: FileList | null) => {
    if (!files?.length || !draft.id) return;
    startCrop(Array.from(files), 'gallery');
  };

  const deleteGalleryPhoto = async (id: string) => {
    if (!supabase) return;
    await supabase.from('product_images').delete().eq('id', id);
    setGallery((current) => current.filter((image) => image.id !== id));
  };

  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    let imageUrl = draft.image_url ?? null;
    if (imageFile) {
      const safeName = imageFile.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, imageFile, { cacheControl: '3600' });
      if (uploadError) { setBusy(false); setMessage(uploadError.message); return; }
      imageUrl = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
    }
    const payload = { name: draft.name, description: draft.description || null, type: draft.type, price: Number(draft.price), color: draft.color, art: draft.art, image_url: imageUrl, image_position_x: Math.round(draft.image_position_x ?? 50), image_position_y: Math.round(draft.image_position_y ?? 50), image_zoom: draft.image_zoom ?? 1, tag: draft.tag || null, active: draft.active ?? true, sort_order: Number(draft.sort_order ?? 0), stock: draft.stock === null || draft.stock === undefined || Number.isNaN(Number(draft.stock)) ? null : Number(draft.stock), updated_at: new Date().toISOString() };
    const result = draft.id
      ? await supabase.from('products').update(payload).eq('id', draft.id)
      : await supabase.from('products').insert(payload);
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    setProductOpen(false);
    setMessage('Producto guardado correctamente.');
    await loadAdminData();
  };

  const deleteProduct = async (product: Product) => {
    if (!supabase || !window.confirm(`¿Eliminar ${product.name}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) setMessage(error.message); else { setMessage('Producto eliminado.'); await loadAdminData(); }
  };

  // Arrastrar para reordenar: se ve al toque, sin adivinar números en "Orden".
  const reorderProducts = async (draggedId: string, targetId: string) => {
    const client = supabase;
    if (!client || draggedId === targetId) return;
    const current = [...products];
    const fromIndex = current.findIndex((product) => product.id === draggedId);
    const toIndex = current.findIndex((product) => product.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setProducts(current);
    await Promise.all(current.map((product, index) => product.sort_order === index ? null : client.from('products').update({ sort_order: index }).eq('id', product.id)));
  };

  const saveContent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.from('site_content').upsert({ key: 'store', value: content, updated_at: new Date().toISOString() });
    setBusy(false);
    setMessage(error ? error.message : 'Textos y datos de contacto actualizados.');
  };

  const now = new Date();
  const revenueThisMonth = orders
    .filter((order) => ['paid', 'shipped', 'delivered'].includes(order.status) && new Date(order.created_at).getMonth() === now.getMonth() && new Date(order.created_at).getFullYear() === now.getFullYear())
    .reduce((sum, order) => sum + order.total, 0);
  const pendingShipmentCount = orders.filter((order) => order.status === 'paid').length;
  const lowStockCount = products.filter((product) => product.stock != null && product.stock <= 5).length;

  if (state === 'loading') return <main className="admin-center"><div className="admin-loader">Preparando tu panel…</div></main>;

  if (state === 'setup') return <main className="admin-center"><section className="setup-card"><div className="admin-badge"><ShieldCheck /> Configuración pendiente</div><h1>Conecta Supabase para activar el panel</h1><p>La administración ya está construida. Para encenderla, crea el proyecto en Supabase, ejecuta el archivo de configuración SQL y agrega la URL y la clave pública del proyecto.</p><ol><li>Ejecuta <strong>supabase/schema.sql</strong> en el editor SQL.</li><li>Copia la URL del proyecto y la clave publicable.</li><li>Registra tu cuenta y márcala como administradora.</li></ol><a href="/"><ArrowLeft size={16} /> Volver a la tienda</a></section></main>;

  if (state === 'login') return <main className="admin-center"><section className="admin-login"><div className="admin-brand">✦</div><p className="admin-kicker">Administración {content.brandName}</p><h1>Gestiona tu tienda</h1><p>Ingresa con la cuenta administradora.</p><form onSubmit={login}><label>Correo<Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<Input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <p className="admin-message error">{message}</p>}<Button disabled={busy} type="submit">{busy ? 'Ingresando…' : 'Iniciar sesión'}</Button></form><div className="admin-divider"><span /> o <span /></div><Button variant="outline" disabled={busy} onClick={googleLogin}><strong>G</strong> Continuar con Google</Button><a className="back-store" href="/"><ArrowLeft size={16} /> Volver a la tienda</a></section></main>;

  if (state === 'denied') return <main className="admin-center"><section className="setup-card"><div className="admin-badge danger">Acceso restringido</div><h1>Esta cuenta no es administradora</h1><p>La sesión es válida, pero no tiene permiso para modificar la tienda.</p><div className="denied-actions"><Button variant="outline" onClick={logout}>Cerrar sesión</Button><a href="/">Volver a la tienda</a></div></section></main>;

  return <main className="admin-shell">
    <header className="admin-header"><div><p className="admin-kicker">{content.brandName} · Panel privado</p><h1>Administración de la tienda</h1></div><div><a href="/">Ver tienda ↗</a><Button variant="outline" onClick={logout}><LogOut size={16} /> Salir</Button></div></header>
    {message && <div className="admin-message success"><Check size={16} /> {message}</div>}
    <div className="stat-cards">
      <button type="button" className="stat-card" onClick={() => setActiveTab('orders')}><div className="stat-icon revenue"><DollarSign size={18} /></div><div><span>Ventas este mes</span><strong>{formatPrice(revenueThisMonth)}</strong></div></button>
      <button type="button" className="stat-card" onClick={() => setActiveTab('orders')}><div className="stat-icon orders"><Clock size={18} /></div><div><span>Por despachar</span><strong>{pendingShipmentCount}</strong></div></button>
      <button type="button" className="stat-card" onClick={() => setActiveTab('products')}><div className="stat-icon stock"><AlertTriangle size={18} /></div><div><span>Stock bajo</span><strong>{lowStockCount}</strong></div></button>
      <button type="button" className="stat-card" onClick={() => setActiveTab('products')}><div className="stat-icon products"><Package size={18} /></div><div><span>Productos activos</span><strong>{products.filter((product) => product.active !== false).length}</strong></div></button>
    </div>
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)} className="admin-tabs" orientation="vertical">
      <TabsList className="admin-tabs-list">
        <TabsTrigger value="products"><Package size={17} /> Productos</TabsTrigger>
        <TabsTrigger value="orders"><Truck size={17} /> Pedidos</TabsTrigger>
        <TabsTrigger value="shipping"><Truck size={17} /> Envíos</TabsTrigger>
        <TabsTrigger value="discounts"><Tag size={17} /> Descuentos</TabsTrigger>
        <TabsTrigger value="reviews"><Star size={17} /> Reseñas</TabsTrigger>
        <TabsTrigger value="users"><Users size={17} /> Usuarios</TabsTrigger>
        <TabsTrigger value="showcase"><Images size={17} /> Vitrina</TabsTrigger>
        <TabsTrigger value="faq"><HelpCircle size={17} /> FAQ</TabsTrigger>
        <TabsTrigger value="content"><FileText size={17} /> Textos y contacto</TabsTrigger>
      </TabsList>
      <TabsContent value="orders">
        <div className="admin-section-heading"><div><h2>Pedidos</h2><p>{orders.length} pedidos recibidos</p></div></div>
        {orders.length === 0 ? <div className="admin-empty"><PackagePlus size={34} /><h3>Aún no hay pedidos</h3><p>Aquí aparecerán las compras pagadas con Mercado Pago.</p></div> : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div><strong>#{order.id.slice(0, 8)}</strong><span>{new Date(order.created_at).toLocaleString('es-CL')}</span></div>
                  <span className={`order-status-badge status-${order.status}`}>{orderStatusLabel[order.status]}</span>
                </div>
                <div className="order-card-body">
                  <div><span>Cliente</span><p>{order.customer_name} · {order.customer_email} · {order.customer_phone}</p></div>
                  <div><span>Dirección</span><p>{order.address}{order.address_extra ? `, ${order.address_extra}` : ''}, {order.comuna}, {order.region}</p></div>
                  <div><span>Productos</span><ul>{order.items.map((item, index) => <li key={`${item.productId}-${index}`}>{item.quantity}× {item.name} — {formatPrice(item.unitPrice * item.quantity)}</li>)}</ul></div>
                  <div><span>Total</span><p><strong>{formatPrice(order.total)}</strong> (envío {formatPrice(order.shipping_cost)})</p></div>
                </div>
                <div className="order-card-actions">
                  <label>Estado<NativeSelect className="admin-select" value={order.status} onChange={(event) => void updateOrder(order.id, { status: event.target.value as OrderStatus })}>
                    {(Object.keys(orderStatusLabel) as OrderStatus[]).map((status) => <NativeSelectOption key={status} value={status}>{orderStatusLabel[status]}</NativeSelectOption>)}
                  </NativeSelect></label>
                  <label>N° de seguimiento<Input value={order.tracking_number ?? ''} placeholder="Ej: 1234567890" onBlur={(event) => void updateOrder(order.id, { tracking_number: event.target.value || null })} onChange={(event) => setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, tracking_number: event.target.value } : item)))} /></label>
                </div>
                {order.user_id && currentUserId ? <OrderChat orderId={order.id} senderRole="admin" currentUserId={currentUserId} /> : <p className="admin-section-note">Compra de invitada: sin cuenta, no hay chat disponible.</p>}
              </article>
            ))}
          </div>
        )}
      </TabsContent>
      <TabsContent value="shipping">
        <div className="admin-section-heading"><div><h2>Costos de envío</h2><p>Estas son las regiones/zonas que el cliente puede elegir al pagar. Agrega, edita o quita las que quieras.</p></div></div>
        <div className="shipping-rates-grid">
          {shippingRates.map((rate) => (
            <div className="shipping-rate-row" key={rate.region}>
              <span>{rate.region}</span>
              <label className="shipping-rate-address-toggle"><input type="checkbox" checked={rate.requires_address ?? true} onChange={(event) => void toggleShippingRequiresAddress(rate.region, event.target.checked)} /> Requiere dirección</label>
              <Input type="number" min="0" defaultValue={rate.cost} onBlur={(event) => void saveShippingRate(rate.region, Number(event.target.value))} />
              <button type="button" className="shipping-rate-delete" aria-label={`Eliminar zona ${rate.region}`} onClick={() => void deleteShippingRate(rate.region)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <form className="shipping-rate-add" onSubmit={addShippingRate}>
          <Input required value={newShippingRegion} onChange={(event) => setNewShippingRegion(event.target.value)} placeholder="Nombre de la región/zona" />
          <Input required min="0" type="number" value={newShippingCost} onChange={(event) => setNewShippingCost(Number(event.target.value))} placeholder="Costo" />
          <label className="shipping-rate-address-toggle"><input type="checkbox" checked={newShippingRequiresAddress} onChange={(event) => setNewShippingRequiresAddress(event.target.checked)} /> Requiere dirección</label>
          <Button type="submit"><Truck size={16} /> Agregar zona</Button>
        </form>
        <p className="admin-section-note">Desmarca "Requiere dirección" para zonas de retiro/entrega personal: la clienta paga sin ingresar comuna ni dirección.</p>
      </TabsContent>
      <TabsContent value="products">
        <div className="admin-section-heading"><div><h2>Productos</h2><p>{products.length} productos en el catálogo</p></div><Button onClick={openNewProduct}><PackagePlus size={17} /> Nuevo producto</Button></div>
        {products.length > 1 && <p className="admin-section-note">Arrastra las tarjetas por el ícono <GripVertical size={12} /> para cambiar el orden en que aparecen en la tienda.</p>}
        <div className="admin-product-grid">{products.length ? products.map((product) => <article className={`admin-product${draggedProductId === product.id ? ' dragging' : ''}${product.stock != null && product.stock <= 5 ? ' low-stock' : ''}`} key={product.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedProductId) void reorderProducts(draggedProductId, product.id); setDraggedProductId(null); }}><button type="button" className="admin-product-handle" aria-label={`Arrastrar para reordenar ${product.name}`} draggable onDragStart={() => setDraggedProductId(product.id)} onDragEnd={() => setDraggedProductId(null)}><GripVertical size={16} /></button><div className="admin-product-image" style={{ backgroundColor: product.color }}>{product.image_url ? <img src={product.image_url} alt={product.name} style={{ objectPosition: `${product.image_position_x ?? 50}% ${product.image_position_y ?? 50}%`, transform: `scale(${product.image_zoom ?? 1})` }} /> : product.art}</div><div className="admin-product-info"><span>{product.type} · {product.active ? 'Publicado' : 'Oculto'}</span><h3>{product.name}</h3><strong>{formatPrice(product.price)}</strong>{product.stock != null && product.stock <= 5 && <small className="admin-product-lowstock-badge"><AlertTriangle size={11} /> Quedan {product.stock}</small>}</div><div className="admin-product-actions"><Button size="icon-sm" variant="outline" onClick={() => openEditProduct(product)} aria-label={`Editar ${product.name}`}><Pencil /></Button><Button size="icon-sm" variant="destructive" onClick={() => deleteProduct(product)} aria-label={`Eliminar ${product.name}`}><Trash2 /></Button></div></article>) : <div className="admin-empty"><ImagePlus size={34} /><h3>Aún no hay productos</h3><p>Crea el primero para mostrarlo en la tienda.</p><Button onClick={openNewProduct}>Crear producto</Button></div>}</div>
      </TabsContent>
      <TabsContent value="discounts">
        <div className="admin-section-heading"><div><h2>Códigos de descuento</h2><p>{discounts.length} códigos creados</p></div></div>
        <form className="discount-form" onSubmit={saveDiscount}>
          <label>Código<Input required value={discountDraft.code} placeholder="BIENVENIDA10" onChange={(event) => setDiscountDraft({ ...discountDraft, code: event.target.value })} /></label>
          <label>Tipo<NativeSelect className="admin-select" value={discountDraft.type} onChange={(event) => setDiscountDraft({ ...discountDraft, type: event.target.value as 'percent' | 'fixed' })}><NativeSelectOption value="percent">% Porcentaje</NativeSelectOption><NativeSelectOption value="fixed">$ Monto fijo</NativeSelectOption></NativeSelect></label>
          <label>Valor<Input required min="1" type="number" value={discountDraft.value} onChange={(event) => setDiscountDraft({ ...discountDraft, value: Number(event.target.value) })} /></label>
          <label>Usos máximos (vacío = ilimitado)<Input min="1" type="number" value={discountDraft.max_uses} placeholder="Ilimitado" onChange={(event) => setDiscountDraft({ ...discountDraft, max_uses: event.target.value === '' ? '' : Number(event.target.value) })} /></label>
          <label>Expira (opcional)<Input type="date" value={discountDraft.expires_at} onChange={(event) => setDiscountDraft({ ...discountDraft, expires_at: event.target.value })} /></label>
          <Button disabled={busy} type="submit" className="discount-submit"><Tag size={16} /> Crear / actualizar código</Button>
        </form>
        <div className="discounts-list">
          {discounts.length === 0 ? <div className="admin-empty"><Tag size={34} /><h3>Aún no hay códigos</h3><p>Crea uno arriba para ofrecer descuentos.</p></div> : discounts.map((discount) => (
            <div className="discount-row" key={discount.code}>
              <div><strong>{discount.code}</strong><span>{discount.type === 'percent' ? `${discount.value}% de descuento` : `${formatPrice(discount.value)} de descuento`} · usado {discount.used_count}{discount.max_uses ? `/${discount.max_uses}` : ''} veces{discount.expires_at ? ` · expira ${new Date(discount.expires_at).toLocaleDateString('es-CL')}` : ''}</span></div>
              <div className="discount-row-actions">
                <button className={`discount-toggle ${discount.active ? 'active' : ''}`} onClick={() => toggleDiscountActive(discount.code, !discount.active)}>{discount.active ? 'Activo' : 'Inactivo'}</button>
                <Button size="icon-sm" variant="destructive" onClick={() => deleteDiscount(discount.code)} aria-label={`Eliminar ${discount.code}`}><Trash2 /></Button>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="reviews">
        <div className="admin-section-heading"><div><h2>Reseñas</h2><p>{reviews.length} reseñas recibidas</p></div></div>
        {reviews.length === 0 ? <div className="admin-empty"><Star size={34} /><h3>Aún no hay reseñas</h3><p>Aparecerán aquí cuando tus clientes opinen.</p></div> : (
          <div className="admin-reviews-list">
            {reviews.map((review) => {
              const product = products.find((item) => item.id === review.product_id);
              return <div className={`admin-review-row ${review.approved ? '' : 'hidden-review'}`} key={review.id}>
                <div><strong>{product?.name ?? 'Producto eliminado'}</strong><div className="review-stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < review.rating ? 'currentColor' : 'none'} />)}</div><p>{review.comment}</p><span>{review.customer_name} · {new Date(review.created_at).toLocaleDateString('es-CL')}</span></div>
                <div className="discount-row-actions">
                  <button className={`discount-toggle ${review.approved ? 'active' : ''}`} onClick={() => toggleReviewApproved(review.id, !review.approved)}>{review.approved ? 'Visible' : 'Oculta'}</button>
                  <Button size="icon-sm" variant="destructive" onClick={() => deleteReview(review.id)} aria-label="Eliminar reseña"><Trash2 /></Button>
                </div>
              </div>;
            })}
          </div>
        )}
      </TabsContent>
      <TabsContent value="users">
        <div className="admin-section-heading"><div><h2>Usuarios</h2><p>{profiles.length} cuentas registradas</p></div></div>
        <div className="admin-users-list">
          {profiles.map((profile) => (
            <div className="admin-user-row" key={profile.id}>
              <div><strong>{profile.full_name || profile.email || profile.id}</strong><span>{profile.email}</span></div>
              <button className={`discount-toggle ${profile.role === 'admin' ? 'active' : ''}`} onClick={() => toggleAdminRole(profile)}>{profile.role === 'admin' ? <><Users size={13} /> Administradora</> : 'Clienta'}</button>
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="showcase">
        <div className="admin-section-heading"><div><h2>Vitrina ("Trabajos recientes")</h2><p>Si agregas al menos una foto aquí, reemplaza el carrusel automático del catálogo.</p></div></div>
        <form className="discount-form showcase-form" onSubmit={addShowcaseItem}>
          <label>Título<Input required value={showcaseDraft.title} placeholder="Encargo personalizado" onChange={(event) => setShowcaseDraft({ ...showcaseDraft, title: event.target.value })} /></label>
          <label>Subtítulo (opcional)<Input value={showcaseDraft.subtitle} placeholder="Para el cumpleaños de Sofía" onChange={(event) => setShowcaseDraft({ ...showcaseDraft, subtitle: event.target.value })} /></label>
          <label className="full upload-field"><span>Fotografía</span><div><Upload size={18} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) startCrop([file], 'showcase'); event.target.value = ''; }} /><small>{showcaseFile?.name ?? 'PNG, JPG o WebP · máximo 5 MB'}</small></div></label>
          <Button disabled={showcaseBusy} type="submit" className="discount-submit"><ImagePlus size={16} /> {showcaseBusy ? 'Subiendo…' : 'Agregar a la vitrina'}</Button>
        </form>
        <div className="discounts-list">
          {showcaseItems.length === 0 ? <div className="admin-empty"><ImagePlus size={34} /><h3>Aún no hay fotos en la vitrina</h3><p>Mientras esté vacía, el carrusel sigue mostrando el catálogo automáticamente.</p></div> : showcaseItems.map((item) => (
            <div className="discount-row" key={item.id}>
              <div className="showcase-row-info"><div className="showcase-thumb"><img src={item.image_url} alt={item.title} /></div><div><strong>{item.title}</strong><span>{item.subtitle}</span></div></div>
              <div className="discount-row-actions">
                <button className={`discount-toggle ${item.active ? 'active' : ''}`} onClick={() => toggleShowcaseActive(item.id, !item.active)}>{item.active ? 'Visible' : 'Oculto'}</button>
                <Button size="icon-sm" variant="destructive" onClick={() => deleteShowcaseItem(item.id)} aria-label={`Eliminar ${item.title}`}><Trash2 /></Button>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="faq">
        <div className="admin-section-heading"><div><h2>Preguntas frecuentes</h2><p>Aparecen antes de "Sobre nosotros" en la tienda.</p></div></div>
        <form className="discount-form" onSubmit={saveFaq}>
          <label className="full">Pregunta<Input required value={faqDraft.question} placeholder="¿Cuánto demora el envío?" onChange={(event) => setFaqDraft({ ...faqDraft, question: event.target.value })} /></label>
          <label className="full">Respuesta<Textarea required value={faqDraft.answer} onChange={(event) => setFaqDraft({ ...faqDraft, answer: event.target.value })} /></label>
          <Button disabled={busy} type="submit" className="discount-submit">Agregar pregunta</Button>
        </form>
        <div className="admin-reviews-list">
          {faqs.length === 0 ? <div className="admin-empty"><h3>Aún no hay preguntas</h3><p>Agrega las dudas más comunes de tus clientas.</p></div> : faqs.map((faq) => (
            <div className={`admin-review-row ${faq.active ? '' : 'hidden-review'}`} key={faq.id}>
              <div><strong>{faq.question}</strong><p>{faq.answer}</p></div>
              <div className="discount-row-actions">
                <button className={`discount-toggle ${faq.active ? 'active' : ''}`} onClick={() => toggleFaqActive(faq.id, !faq.active)}>{faq.active ? 'Visible' : 'Oculta'}</button>
                <Button size="icon-sm" variant="destructive" onClick={() => deleteFaq(faq.id)} aria-label="Eliminar pregunta"><Trash2 /></Button>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="content">
        <form className="content-editor" onSubmit={saveContent}><div className="admin-section-heading"><div><h2>Textos y contacto</h2><p>Cambia el contenido principal sin tocar código.</p></div><Button disabled={busy} type="submit"><Save size={17} /> Guardar cambios</Button></div>
          <section><h3>Marca</h3><div className="form-grid"><label>Nombre de la tienda<Input value={content.brandName} onChange={(event) => setContent({ ...content, brandName: event.target.value })} /></label><label>Frase bajo el nombre<Input value={content.brandTagline} onChange={(event) => setContent({ ...content, brandTagline: event.target.value })} /></label></div></section>
          <section><h3>Categorías y moneda</h3><p className="admin-section-note">Cambia esto para vender otro tipo de producto o en otro país, sin tocar código.</p><div className="form-grid"><label className="full">Categorías de producto (separadas por coma)<Input value={content.categories.join(', ')} onChange={(event) => setContent({ ...content, categories: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="Llaveros, Peluches" /></label><label>Código de moneda (ISO 4217)<Input value={content.currency} onChange={(event) => setContent({ ...content, currency: event.target.value.trim().toUpperCase() })} placeholder="CLP" /></label><label>Locale de formato<Input value={content.locale} onChange={(event) => setContent({ ...content, locale: event.target.value.trim() })} placeholder="es-CL" /></label></div></section>
          <section><h3>Portada</h3><div className="form-grid"><label>Texto superior<Input value={content.heroEyebrow} onChange={(event) => setContent({ ...content, heroEyebrow: event.target.value })} /></label><label>Título<Input value={content.heroTitle} onChange={(event) => setContent({ ...content, heroTitle: event.target.value })} /></label><label>Texto destacado<Input value={content.heroHighlight} onChange={(event) => setContent({ ...content, heroHighlight: event.target.value })} /></label><label className="full">Descripción<Textarea value={content.heroDescription} onChange={(event) => setContent({ ...content, heroDescription: event.target.value })} /></label><label>Botón principal<Input value={content.heroCtaPrimary} onChange={(event) => setContent({ ...content, heroCtaPrimary: event.target.value })} /></label><label>Enlace secundario<Input value={content.heroCtaSecondary} onChange={(event) => setContent({ ...content, heroCtaSecondary: event.target.value })} /></label><label>Nota 1<Input value={content.heroNote1} onChange={(event) => setContent({ ...content, heroNote1: event.target.value })} /></label><label>Nota 2<Input value={content.heroNote2} onChange={(event) => setContent({ ...content, heroNote2: event.target.value })} /></label></div></section>
          <section><h3>Franja de categorías</h3><div className="form-grid"><label>Texto 1<Input value={content.categoryText1} onChange={(event) => setContent({ ...content, categoryText1: event.target.value })} /></label><label>Texto 2<Input value={content.categoryText2} onChange={(event) => setContent({ ...content, categoryText2: event.target.value })} /></label><label>Texto 3<Input value={content.categoryText3} onChange={(event) => setContent({ ...content, categoryText3: event.target.value })} /></label></div></section>
          <section><h3>Sobre nosotros</h3><div className="form-grid"><label>Título<Input value={content.aboutTitle} onChange={(event) => setContent({ ...content, aboutTitle: event.target.value })} /></label><label>Texto destacado<Input value={content.aboutHighlight} onChange={(event) => setContent({ ...content, aboutHighlight: event.target.value })} /></label><label className="full">Historia<Textarea value={content.aboutText} onChange={(event) => setContent({ ...content, aboutText: event.target.value })} /></label><label className="full">Cita final<Input value={content.storyQuote} onChange={(event) => setContent({ ...content, storyQuote: event.target.value })} /></label><label>Firma de la cita<Input value={content.storyQuoteAuthor} onChange={(event) => setContent({ ...content, storyQuoteAuthor: event.target.value })} /></label></div></section>
          <section><h3>Contacto y envíos</h3><div className="form-grid"><label>Teléfono<Input value={content.phone} onChange={(event) => setContent({ ...content, phone: event.target.value })} /></label><label>Correo<Input type="email" value={content.email} onChange={(event) => setContent({ ...content, email: event.target.value })} /></label><label>WhatsApp (con código de país, sin espacios)<Input value={content.whatsapp ?? ''} placeholder="56912345678" onChange={(event) => setContent({ ...content, whatsapp: event.target.value })} /></label><label className="full">Mensaje superior<Input value={content.shippingMessage} onChange={(event) => setContent({ ...content, shippingMessage: event.target.value })} /></label><label className="full">Llamado a la acción del pie de página<Input value={content.footerCta} onChange={(event) => setContent({ ...content, footerCta: event.target.value })} /></label></div></section>
          <section><h3>English (opcional)</h3><p className="admin-section-note">Se muestra cuando la clienta cambia el idioma con el botón EN/ES de la tienda. Deja vacío lo que no quieras traducir todavía.</p><div className="form-grid"><label>Hero eyebrow<Input value={content.heroEyebrow_en ?? ''} onChange={(event) => setContent({ ...content, heroEyebrow_en: event.target.value })} /></label><label>Hero title<Input value={content.heroTitle_en ?? ''} onChange={(event) => setContent({ ...content, heroTitle_en: event.target.value })} /></label><label>Hero highlight<Input value={content.heroHighlight_en ?? ''} onChange={(event) => setContent({ ...content, heroHighlight_en: event.target.value })} /></label><label className="full">Hero description<Textarea value={content.heroDescription_en ?? ''} onChange={(event) => setContent({ ...content, heroDescription_en: event.target.value })} /></label><label>Primary button<Input value={content.heroCtaPrimary_en ?? ''} onChange={(event) => setContent({ ...content, heroCtaPrimary_en: event.target.value })} /></label><label>Secondary link<Input value={content.heroCtaSecondary_en ?? ''} onChange={(event) => setContent({ ...content, heroCtaSecondary_en: event.target.value })} /></label><label>About title<Input value={content.aboutTitle_en ?? ''} onChange={(event) => setContent({ ...content, aboutTitle_en: event.target.value })} /></label><label>About highlight<Input value={content.aboutHighlight_en ?? ''} onChange={(event) => setContent({ ...content, aboutHighlight_en: event.target.value })} /></label><label className="full">About text<Textarea value={content.aboutText_en ?? ''} onChange={(event) => setContent({ ...content, aboutText_en: event.target.value })} /></label><label className="full">Closing quote<Input value={content.storyQuote_en ?? ''} onChange={(event) => setContent({ ...content, storyQuote_en: event.target.value })} /></label><label className="full">Shipping message<Input value={content.shippingMessage_en ?? ''} onChange={(event) => setContent({ ...content, shippingMessage_en: event.target.value })} /></label><label className="full">Footer call to action<Input value={content.footerCta_en ?? ''} onChange={(event) => setContent({ ...content, footerCta_en: event.target.value })} /></label></div></section>
          <section><h3>Analítica</h3><p className="admin-section-note">Deja vacío para no cargar el script. Necesitas tus propios IDs de Google Analytics y/o Meta Pixel. Al activarlos, la tienda le pedirá consentimiento a la visitante antes de cargarlos (aviso de cookies).</p><div className="form-grid"><label>Google Analytics (Measurement ID)<Input value={content.gaId ?? ''} placeholder="G-XXXXXXXXXX" onChange={(event) => setContent({ ...content, gaId: event.target.value })} /></label><label>Meta Pixel ID<Input value={content.metaPixelId ?? ''} placeholder="123456789012345" onChange={(event) => setContent({ ...content, metaPixelId: event.target.value })} /></label></div></section>
          <section><h3>Legal</h3><p className="admin-section-note">Textos de /términos y /privacidad. Usa "## " al inicio de una línea para un título de sección y "- " para un ítem de lista. Puedes usar {'{{brandName}}'}, {'{{legalName}}'}, {'{{phone}}'}, {'{{email}}'} y {'{{retention}}'} dentro del texto: se reemplazan automáticamente.</p><div className="form-grid"><label>Nombre completo del responsable<Input value={content.legalName ?? ''} placeholder="Nombre y apellido" onChange={(event) => setContent({ ...content, legalName: event.target.value })} /></label><label className="full">Plazo de conservación de datos<Textarea value={content.legalRetention ?? ''} onChange={(event) => setContent({ ...content, legalRetention: event.target.value })} /></label><label className="full">Términos y condiciones<Textarea rows={16} value={content.termsContent ?? ''} onChange={(event) => setContent({ ...content, termsContent: event.target.value })} /></label><label className="full">Política de privacidad<Textarea rows={16} value={content.privacyContent ?? ''} onChange={(event) => setContent({ ...content, privacyContent: event.target.value })} /></label></div></section>
        </form>
      </TabsContent>
    </Tabs>

    <Dialog open={productOpen} onOpenChange={setProductOpen}><DialogContent className="product-dialog"><DialogHeader><DialogTitle>{draft.id ? 'Editar producto' : 'Nuevo producto'}</DialogTitle><DialogDescription>Los cambios publicados aparecerán en la tienda.</DialogDescription></DialogHeader><form className="product-form" onSubmit={saveProduct}><div className="form-grid"><label>Nombre<Input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="full">Descripción<Textarea value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Describe el producto: material, tamaño, detalles..." /></label><label>Categoría<NativeSelect className="admin-select" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{content.categories.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect></label><label>Precio en {content.currency}<Input required min="0" type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label><label>Stock (vacío = sin límite)<Input min="0" type="number" value={draft.stock ?? ''} placeholder="Sin límite" onChange={(event) => setDraft({ ...draft, stock: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Color<Input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label><label>Emoji<Input value={draft.art} onChange={(event) => setDraft({ ...draft, art: event.target.value })} /></label><label>Etiqueta<Input value={draft.tag ?? ''} placeholder="Nuevo, Más vendido…" onChange={(event) => setDraft({ ...draft, tag: event.target.value })} /></label><label>Visibilidad<NativeSelect className="admin-select" value={draft.active ? 'active' : 'hidden'} onChange={(event) => setDraft({ ...draft, active: event.target.value === 'active' })}><NativeSelectOption value="active">Publicado</NativeSelectOption><NativeSelectOption value="hidden">Oculto</NativeSelectOption></NativeSelect></label><label className="full upload-field"><span>Fotografía</span><div><Upload size={18} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) startCrop([file], 'product'); event.target.value = ''; }} /><small>{imageFile?.name ?? (draft.image_url ? 'Se conservará la foto actual' : 'PNG, JPG o WebP · máximo 5 MB')}</small></div></label>
{(imagePreview ?? draft.image_url) && <div className="full image-adjust-preview"><img src={imagePreview ?? draft.image_url ?? ''} alt="Vista previa" style={{ objectPosition: `${draft.image_position_x ?? 50}% ${draft.image_position_y ?? 50}%`, transformOrigin: `${draft.image_position_x ?? 50}% ${draft.image_position_y ?? 50}%`, transform: `scale(${draft.image_zoom ?? 1})` }} /></div>}
{draft.id && <div className="full gallery-manager">
  <span className="gallery-manager-label">Fotos adicionales (galería)</span>
  <div className="gallery-manager-grid">
    {gallery.map((image) => <div className="gallery-manager-item" key={image.id}><img src={image.image_url} alt="" /><button type="button" onClick={() => deleteGalleryPhoto(image.id)} aria-label="Eliminar foto"><Trash2 size={14} /></button></div>)}
    <label className="gallery-manager-add">{galleryBusy ? '...' : <><Upload size={16} /> Agregar</>}<input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={galleryBusy} onChange={(event) => { addGalleryPhotos(event.target.files); event.target.value = ''; }} /></label>
  </div>
</div>}
</div>{message && <p className="admin-message">{message}</p>}<Button disabled={busy} type="submit" className="save-product"><Save size={17} /> {busy ? 'Guardando…' : 'Guardar producto'}</Button></form></DialogContent></Dialog>

    <ImageCropDialog file={cropQueue[0] ?? null} onCancel={onCropCancel} onConfirm={onCropConfirm} />
  </main>;
}
