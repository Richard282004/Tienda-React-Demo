'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ImagePlus, LogOut, PackagePlus, Pencil, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { defaultStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import './admin.css';

type AdminState = 'loading' | 'setup' | 'login' | 'denied' | 'ready';
type ProductDraft = Omit<Product, 'id'> & { id?: string };

const emptyProduct: ProductDraft = {
  name: '', type: 'Llaveros', price: 0, color: '#f3dedb', art: '🧶', image_url: null, tag: '', active: true, sort_order: 0,
};

export default function AdminPage() {
  const [state, setState] = useState<AdminState>('loading');
  const [products, setProducts] = useState<Product[]>([]);
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const loadAdminData = async () => {
    if (!supabase) return;
    const [{ data: productRows, error: productError }, { data: contentRow, error: contentError }] = await Promise.all([
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('site_content').select('value').eq('key', 'store').maybeSingle(),
    ]);
    if (productError || contentError) { setMessage(productError?.message ?? contentError?.message ?? 'No se pudo cargar la información.'); return; }
    setProducts((productRows ?? []) as Product[]);
    if (contentRow?.value) setContent({ ...defaultStoreContent, ...(contentRow.value as Partial<StoreContent>) });
  };

  const resolveSession = async () => {
    if (!supabase) { setState('setup'); return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setState('login'); return; }
    const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
    if (error || profile?.role !== 'admin') { setState('denied'); return; }
    setState('ready');
    await loadAdminData();
  };

  useEffect(() => {
    void resolveSession();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => void resolveSession());
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
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/admin` } });
    if (error) setMessage(error.message);
  };

  const logout = async () => {
    await supabase?.auth.signOut();
    setState('login');
  };

  const openNewProduct = () => {
    setDraft({ ...emptyProduct, sort_order: products.length + 1 });
    setImageFile(null);
    setProductOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setDraft({ ...product });
    setImageFile(null);
    setProductOpen(true);
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
    const payload = { name: draft.name, type: draft.type, price: Number(draft.price), color: draft.color, art: draft.art, image_url: imageUrl, tag: draft.tag || null, active: draft.active ?? true, sort_order: Number(draft.sort_order ?? 0), updated_at: new Date().toISOString() };
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

  const saveContent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.from('site_content').upsert({ key: 'store', value: content, updated_at: new Date().toISOString() });
    setBusy(false);
    setMessage(error ? error.message : 'Textos y datos de contacto actualizados.');
  };

  if (state === 'loading') return <main className="admin-center"><div className="admin-loader">Preparando tu panel…</div></main>;

  if (state === 'setup') return <main className="admin-center"><section className="setup-card"><div className="admin-badge"><ShieldCheck /> Configuración pendiente</div><h1>Conecta Supabase para activar el panel</h1><p>La administración ya está construida. Para encenderla, crea el proyecto en Supabase, ejecuta el archivo de configuración SQL y agrega la URL y la clave pública del proyecto.</p><ol><li>Ejecuta <strong>supabase/schema.sql</strong> en el editor SQL.</li><li>Copia la URL del proyecto y la clave publicable.</li><li>Registra tu cuenta y márcala como administradora.</li></ol><a href="/"><ArrowLeft size={16} /> Volver a la tienda</a></section></main>;

  if (state === 'login') return <main className="admin-center"><section className="admin-login"><div className="admin-brand">✦</div><p className="admin-kicker">Administración Lúmina</p><h1>Gestiona tu tienda</h1><p>Ingresa con la cuenta administradora.</p><form onSubmit={login}><label>Correo<Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<Input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <p className="admin-message error">{message}</p>}<Button disabled={busy} type="submit">{busy ? 'Ingresando…' : 'Iniciar sesión'}</Button></form><div className="admin-divider"><span /> o <span /></div><Button variant="outline" onClick={googleLogin}><strong>G</strong> Continuar con Google</Button><a className="back-store" href="/"><ArrowLeft size={16} /> Volver a la tienda</a></section></main>;

  if (state === 'denied') return <main className="admin-center"><section className="setup-card"><div className="admin-badge danger">Acceso restringido</div><h1>Esta cuenta no es administradora</h1><p>La sesión es válida, pero no tiene permiso para modificar la tienda.</p><div className="denied-actions"><Button variant="outline" onClick={logout}>Cerrar sesión</Button><a href="/">Volver a la tienda</a></div></section></main>;

  return <main className="admin-shell">
    <header className="admin-header"><div><p className="admin-kicker">Lúmina · Panel privado</p><h1>Administración de la tienda</h1></div><div><a href="/">Ver tienda</a><Button variant="outline" onClick={logout}><LogOut size={16} /> Salir</Button></div></header>
    {message && <div className="admin-message success"><Check size={16} /> {message}</div>}
    <Tabs defaultValue="products" className="admin-tabs">
      <TabsList className="admin-tabs-list"><TabsTrigger value="products">Productos</TabsTrigger><TabsTrigger value="content">Textos y contacto</TabsTrigger></TabsList>
      <TabsContent value="products">
        <div className="admin-section-heading"><div><h2>Productos</h2><p>{products.length} productos en el catálogo</p></div><Button onClick={openNewProduct}><PackagePlus size={17} /> Nuevo producto</Button></div>
        <div className="admin-product-grid">{products.length ? products.map((product) => <article className="admin-product" key={product.id}><div className="admin-product-image" style={{ backgroundColor: product.color }}>{product.image_url ? <img src={product.image_url} alt={product.name} /> : product.art}</div><div className="admin-product-info"><span>{product.type} · {product.active ? 'Publicado' : 'Oculto'}</span><h3>{product.name}</h3><strong>${product.price.toLocaleString('es-CL')}</strong></div><div className="admin-product-actions"><Button size="icon-sm" variant="outline" onClick={() => openEditProduct(product)} aria-label={`Editar ${product.name}`}><Pencil /></Button><Button size="icon-sm" variant="destructive" onClick={() => deleteProduct(product)} aria-label={`Eliminar ${product.name}`}><Trash2 /></Button></div></article>) : <div className="admin-empty"><ImagePlus size={34} /><h3>Aún no hay productos</h3><p>Crea el primero para mostrarlo en la tienda.</p><Button onClick={openNewProduct}>Crear producto</Button></div>}</div>
      </TabsContent>
      <TabsContent value="content">
        <form className="content-editor" onSubmit={saveContent}><div className="admin-section-heading"><div><h2>Textos y contacto</h2><p>Cambia el contenido principal sin tocar código.</p></div><Button disabled={busy} type="submit"><Save size={17} /> Guardar cambios</Button></div><section><h3>Portada</h3><div className="form-grid"><label>Texto superior<Input value={content.heroEyebrow} onChange={(event) => setContent({ ...content, heroEyebrow: event.target.value })} /></label><label>Título<Input value={content.heroTitle} onChange={(event) => setContent({ ...content, heroTitle: event.target.value })} /></label><label>Texto destacado<Input value={content.heroHighlight} onChange={(event) => setContent({ ...content, heroHighlight: event.target.value })} /></label><label className="full">Descripción<Textarea value={content.heroDescription} onChange={(event) => setContent({ ...content, heroDescription: event.target.value })} /></label></div></section><section><h3>Sobre nosotros</h3><div className="form-grid"><label>Título<Input value={content.aboutTitle} onChange={(event) => setContent({ ...content, aboutTitle: event.target.value })} /></label><label>Texto destacado<Input value={content.aboutHighlight} onChange={(event) => setContent({ ...content, aboutHighlight: event.target.value })} /></label><label className="full">Historia<Textarea value={content.aboutText} onChange={(event) => setContent({ ...content, aboutText: event.target.value })} /></label></div></section><section><h3>Contacto y envíos</h3><div className="form-grid"><label>Teléfono<Input value={content.phone} onChange={(event) => setContent({ ...content, phone: event.target.value })} /></label><label>Correo<Input type="email" value={content.email} onChange={(event) => setContent({ ...content, email: event.target.value })} /></label><label className="full">Mensaje superior<Input value={content.shippingMessage} onChange={(event) => setContent({ ...content, shippingMessage: event.target.value })} /></label></div></section></form>
      </TabsContent>
    </Tabs>

    <Dialog open={productOpen} onOpenChange={setProductOpen}><DialogContent className="product-dialog"><DialogHeader><DialogTitle>{draft.id ? 'Editar producto' : 'Nuevo producto'}</DialogTitle><DialogDescription>Los cambios publicados aparecerán en la tienda.</DialogDescription></DialogHeader><form className="product-form" onSubmit={saveProduct}><div className="form-grid"><label>Nombre<Input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Categoría<NativeSelect className="admin-select" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Product['type'] })}><NativeSelectOption value="Llaveros">Llaveros</NativeSelectOption><NativeSelectOption value="Peluches">Peluches</NativeSelectOption></NativeSelect></label><label>Precio en CLP<Input required min="0" type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label><label>Orden<Input min="0" type="number" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })} /></label><label>Color<Input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label><label>Emoji<Input value={draft.art} onChange={(event) => setDraft({ ...draft, art: event.target.value })} /></label><label>Etiqueta<Input value={draft.tag ?? ''} placeholder="Nuevo, Más vendido…" onChange={(event) => setDraft({ ...draft, tag: event.target.value })} /></label><label>Visibilidad<NativeSelect className="admin-select" value={draft.active ? 'active' : 'hidden'} onChange={(event) => setDraft({ ...draft, active: event.target.value === 'active' })}><NativeSelectOption value="active">Publicado</NativeSelectOption><NativeSelectOption value="hidden">Oculto</NativeSelectOption></NativeSelect></label><label className="full upload-field"><span>Fotografía</span><div><Upload size={18} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /><small>{imageFile?.name ?? (draft.image_url ? 'Se conservará la foto actual' : 'PNG, JPG o WebP · máximo 5 MB')}</small></div></label></div>{message && <p className="admin-message">{message}</p>}<Button disabled={busy} type="submit" className="save-product"><Save size={17} /> {busy ? 'Guardando…' : 'Guardar producto'}</Button></form></DialogContent></Dialog>
  </main>;
}
