'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, LogOut, Pencil, Plus, Trash2 } from 'lucide-react';
import { OrderChat } from '@/components/order-chat';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { orderStatusLabel, type Address, type Order, type ShippingRate } from '@/lib/orders';
import { defaultStoreContent, type StoreContent } from '@/lib/store-data';
import { formatPrice as formatCurrency } from '@/lib/currency';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import './mi-cuenta.css';

type Tab = 'datos' | 'direcciones' | 'pedidos';

const emptyAddressForm = { full_name: '', phone: '', region: '', comuna: '', address: '', address_extra: '' };

export default function MiCuentaPage() {
  const [tab, setTab] = useState<Tab>('datos');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressForm, setAddressForm] = useState<typeof emptyAddressForm | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  const [marketingEmails, setMarketingEmails] = useState(true);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);
  const askConfirm = (confirmMessage: string) => new Promise<boolean>((resolve) => setConfirmState({ message: confirmMessage, resolve }));
  const closeConfirm = (ok: boolean) => { confirmState?.resolve(ok); setConfirmState(null); };
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);

  useEffect(() => {
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setEmail(user.email ?? null);
      const [{ data: profile }, { data: orderRows }, { data: addressRows }, { data: rateRows }, { data: settings }] = await Promise.all([
        supabase.from('profiles').select('full_name, marketing_emails_enabled').eq('id', user.id).maybeSingle<{ full_name: string | null; marketing_emails_enabled: boolean | null }>(),
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('addresses').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('shipping_rates').select('region, cost, requires_address'),
        supabase.from('site_content').select('value').eq('key', 'store').maybeSingle(),
      ]);
      setName(profile?.full_name ?? '');
      setMarketingEmails(profile?.marketing_emails_enabled ?? true);
      setOrders((orderRows ?? []) as Order[]);
      setOrdersLoaded(true);
      setAddresses((addressRows ?? []) as Address[]);
      setShippingRates((rateRows ?? []) as ShippingRate[]);
      if (settings?.value) setContent({ ...defaultStoreContent, ...(settings.value as Partial<StoreContent>) });
      setLoading(false);
    };
    void load();
  }, []);

  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.rpc('update_own_name', { p_full_name: name });
    setBusy(false);
    setMessage(error ? 'No pudimos guardar los cambios.' : 'Cambios guardados.');
    window.setTimeout(() => setMessage(''), 2500);
  };

  const toggleMarketingEmails = async (enabled: boolean) => {
    if (!supabase) return;
    setMarketingEmails(enabled);
    setPrefsBusy(true);
    const { error } = await supabase.rpc('update_own_notification_prefs', { p_marketing_emails_enabled: enabled });
    setPrefsBusy(false);
    if (error) { setMarketingEmails(!enabled); setMessage('No pudimos guardar la preferencia.'); window.setTimeout(() => setMessage(''), 2500); }
  };

  const deleteAccount = async () => {
    if (!supabase) return;
    const ok = await askConfirm('¿Eliminar tu cuenta? Se borran tus datos, direcciones y favoritos. Tus pedidos ya hechos se conservan (obligación legal) pero dejan de estar ligados a tu cuenta. Esta acción no se puede deshacer.');
    if (!ok) return;
    setDeleteBusy(true);
    const { error } = await supabase.rpc('delete_own_account');
    if (error) { setDeleteBusy(false); setMessage(`No pudimos eliminar la cuenta: ${error.message}`); return; }
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const openNewAddress = () => { setEditingAddressId('new'); setAddressForm(emptyAddressForm); };
  const openEditAddress = (item: Address) => {
    setEditingAddressId(item.id);
    setAddressForm({ full_name: item.full_name, phone: item.phone, region: item.region, comuna: item.comuna, address: item.address, address_extra: item.address_extra ?? '' });
  };
  const closeAddressForm = () => { setEditingAddressId(null); setAddressForm(null); };

  const saveAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !addressForm || !userId) return;
    setBusy(true);
    setMessage('');
    const payload = {
      user_id: userId,
      full_name: addressForm.full_name,
      phone: addressForm.phone,
      region: addressForm.region,
      comuna: addressForm.comuna,
      address: addressForm.address,
      address_extra: addressForm.address_extra || null,
    };
    const { error } = editingAddressId && editingAddressId !== 'new'
      ? await supabase.from('addresses').update(payload).eq('id', editingAddressId)
      : await supabase.from('addresses').insert(payload);
    setBusy(false);
    if (error) { setMessage(`No pudimos guardar la dirección: ${error.message}`); return; }
    const { data: addressRows } = await supabase.from('addresses').select('*').eq('user_id', userId).order('created_at');
    setAddresses((addressRows ?? []) as Address[]);
    closeAddressForm();
  };

  const deleteAddress = async (id: string) => {
    if (!supabase) return;
    await supabase.from('addresses').delete().eq('id', id);
    setAddresses((current) => current.filter((item) => item.id !== id));
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    window.location.href = '/';
  };

  if (loading) return <main className="account-page-shell"><p className="account-page-loading">Cargando tu cuenta…</p></main>;

  if (!email) {
    return (
      <main className="account-page-shell">
        <div className="account-page-guest">
          <h1>Inicia sesión para ver tu cuenta</h1>
          <p>Crea una cuenta o inicia sesión desde la tienda para ver tus datos y direcciones guardadas.</p>
          <a className="account-page-back" href="/"><ArrowLeft size={16} /> Volver a la tienda</a>
        </div>
      </main>
    );
  }

  return (
    <main className="account-page-shell">
      <a href="/" className="account-page-back"><ArrowLeft size={16} /> Volver a la tienda</a>
      <div className="account-page-grid">
        <nav className="account-page-nav">
          <p className="account-page-nav-title">Resumen de tu cuenta</p>
          <button type="button" className={tab === 'datos' ? 'active' : ''} onClick={() => setTab('datos')}>Datos personales<ChevronRight size={16} /></button>
          <button type="button" className={tab === 'direcciones' ? 'active' : ''} onClick={() => { setTab('direcciones'); closeAddressForm(); }}>Direcciones<ChevronRight size={16} /></button>
          <button type="button" className={tab === 'pedidos' ? 'active' : ''} onClick={() => setTab('pedidos')}>Mis pedidos<ChevronRight size={16} /></button>
          <button type="button" className="account-page-signout" onClick={signOut}><LogOut size={15} /> Cerrar sesión</button>
        </nav>

        <section className="account-page-content">
          {tab === 'datos' ? (
            <>
              <h1>Mis datos</h1>
              <p className="account-page-subtitle">Modifica tu nombre a continuación para que tu cuenta esté actualizada.</p>
              <form onSubmit={saveName} className="account-page-form">
                <h2>Detalles</h2>
                <label>Nombre completo<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" /></label>
                <h2>Datos de acceso</h2>
                <label>Correo electrónico<Input value={email} disabled /></label>
                {message && <p className="account-message">{message}</p>}
                <Button disabled={busy || !isSupabaseConfigured} type="submit" className="primary-button">{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
              </form>

              <div className="account-page-form account-notifications">
                <h2>Notificaciones por correo</h2>
                <label className="account-notifications-toggle">
                  <input type="checkbox" checked={marketingEmails} disabled={prefsBusy} onChange={(event) => void toggleMarketingEmails(event.target.checked)} />
                  Recibir correos de ofertas y novedades
                </label>
                <p className="account-page-subtitle">Los correos sobre el estado de tus pedidos siempre se envían, aunque apagues esto.</p>
              </div>

              <div className="account-page-form account-danger-zone">
                <h2>Eliminar cuenta</h2>
                <p className="account-page-subtitle">Borra tu perfil, direcciones y favoritos. No se puede deshacer.</p>
                <Button type="button" variant="destructive" disabled={deleteBusy} onClick={() => void deleteAccount()}>{deleteBusy ? 'Eliminando…' : 'Eliminar mi cuenta'}</Button>
              </div>
            </>
          ) : tab === 'direcciones' ? (
            <>
              <h1>Direcciones</h1>
              <p className="account-page-subtitle">Se ofrecen para elegir al pagar en el carrito.</p>
              {addressForm ? (
                <form onSubmit={saveAddress} className="account-page-form">
                  <label>Nombre de quien recibe<Input required value={addressForm.full_name} onChange={(event) => setAddressForm({ ...addressForm, full_name: event.target.value })} /></label>
                  <label>Teléfono<Input required type="tel" inputMode="tel" value={addressForm.phone} onChange={(event) => setAddressForm({ ...addressForm, phone: event.target.value })} placeholder="+56 9 ..." /></label>
                  <label>Región<NativeSelect required className="admin-select" value={addressForm.region} onChange={(event) => setAddressForm({ ...addressForm, region: event.target.value })}>
                    <NativeSelectOption value="">Selecciona tu región</NativeSelectOption>
                    {shippingRates.map((rate) => <NativeSelectOption key={rate.region} value={rate.region}>{rate.region}</NativeSelectOption>)}
                  </NativeSelect></label>
                  <label>Comuna / ciudad<Input required value={addressForm.comuna} onChange={(event) => setAddressForm({ ...addressForm, comuna: event.target.value })} /></label>
                  <label>Dirección<Input required value={addressForm.address} onChange={(event) => setAddressForm({ ...addressForm, address: event.target.value })} placeholder="Calle, número" /></label>
                  <label>Depto / referencia (opcional)<Input value={addressForm.address_extra} onChange={(event) => setAddressForm({ ...addressForm, address_extra: event.target.value })} /></label>
                  {message && <p className="account-message">{message}</p>}
                  <div className="account-page-address-actions">
                    <Button type="button" variant="outline" onClick={closeAddressForm}>Cancelar</Button>
                    <Button disabled={busy || !isSupabaseConfigured} type="submit" className="primary-button">{busy ? 'Guardando…' : 'Guardar dirección'}</Button>
                  </div>
                </form>
              ) : addresses.length === 0 ? (
                <button type="button" className="account-page-address-empty" onClick={openNewAddress}>
                  <Plus size={28} />
                  <span>Agregar dirección</span>
                </button>
              ) : (
                <div className="account-page-address-grid">
                  {addresses.map((item, index) => (
                    <div className="account-page-address-card" key={item.id}>
                      <strong>Dirección {index + 1}</strong>
                      <p>{item.full_name}</p>
                      <p>{item.phone}</p>
                      <p>{item.address}{item.address_extra ? `, ${item.address_extra}` : ''}</p>
                      <p>{item.comuna}, {item.region}</p>
                      <div className="account-page-address-card-actions">
                        <button type="button" onClick={() => openEditAddress(item)}><Pencil size={14} /> Editar</button>
                        <button type="button" onClick={() => deleteAddress(item.id)}><Trash2 size={14} /> Eliminar</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="account-page-address-add" onClick={openNewAddress}>
                    <Plus size={24} />
                    <span>Nueva dirección</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h1>Mis pedidos</h1>
              <p className="account-page-subtitle">Historial y estado de tus compras.</p>
              {!ordersLoaded ? (
                <p className="account-page-orders-loading">Cargando pedidos…</p>
              ) : orders.length === 0 ? (
                <p className="account-page-orders-empty">Todavía no tienes pedidos. Cuando compres algo, aparecerá aquí con su estado y seguimiento.</p>
              ) : (
                <div className="account-page-orders">
                  {orders.map((order) => (
                    <div className="account-page-order" key={order.id}>
                      <div className="account-page-order-header">
                        <div>
                          <strong>Pedido #{order.id.slice(0, 8)}</strong>
                          <span>{new Date(order.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                        <span className={`order-status-badge status-${order.status}`}>{orderStatusLabel[order.status]}</span>
                      </div>
                      <ul className="account-page-order-items">
                        {order.items.map((item, index) => (
                          <li key={`${item.productId}-${index}`}><span>{item.quantity}× {item.name}{item.variantLabel ? ` (${item.variantLabel})` : ''}</span><span>{formatPrice(item.unitPrice * item.quantity)}</span></li>
                        ))}
                      </ul>
                      {order.tracking_number && <p className="account-page-order-tracking">N° de seguimiento: <strong>{order.tracking_number}</strong></p>}
                      <div className="account-page-order-total"><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
                      {userId && <OrderChat orderId={order.id} senderRole="customer" currentUserId={userId} />}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Dialog open={confirmState !== null} onOpenChange={(open) => { if (!open) closeConfirm(false); }}>
        <DialogContent className="confirm-dialog">
          <DialogHeader>
            <div className="confirm-dialog-icon"><AlertTriangle size={20} /></div>
            <DialogTitle>Confirmar acción</DialogTitle>
            <DialogDescription>{confirmState?.message}</DialogDescription>
          </DialogHeader>
          <div className="confirm-dialog-actions">
            <Button variant="outline" onClick={() => closeConfirm(false)}>Cancelar</Button>
            <Button className="confirm-dialog-danger" onClick={() => closeConfirm(true)}>Sí, confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
