'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { CHILE_REGIONS, COMUNAS_BY_REGION, orderStatusLabel, type Order } from '@/lib/orders';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import './mi-cuenta.css';

type Tab = 'datos' | 'direcciones' | 'pedidos';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

type Profile = {
  full_name: string | null;
  phone: string | null;
  region: string | null;
  comuna: string | null;
  address: string | null;
  address_extra: string | null;
};

export default function MiCuentaPage() {
  const [tab, setTab] = useState<Tab>('datos');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState({ phone: '', region: '', comuna: '', address: '', addressExtra: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { setLoading(false); return; }
      setEmail(user.email ?? null);
      const [{ data: profile }, { data: orderRows }] = await Promise.all([
        supabase.from('profiles').select('full_name, phone, region, comuna, address, address_extra').eq('id', user.id).maybeSingle<Profile>(),
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setName(profile?.full_name ?? '');
      setAddress({
        phone: profile?.phone ?? '',
        region: profile?.region ?? '',
        comuna: profile?.comuna ?? '',
        address: profile?.address ?? '',
        addressExtra: profile?.address_extra ?? '',
      });
      setOrders((orderRows ?? []) as Order[]);
      setOrdersLoaded(true);
      setLoading(false);
    };
    void load();
  }, []);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.rpc('update_own_profile', {
      p_full_name: name,
      p_phone: address.phone,
      p_region: address.region,
      p_comuna: address.comuna,
      p_address: address.address,
      p_address_extra: address.addressExtra,
    });
    setBusy(false);
    setMessage(error ? 'No pudimos guardar los cambios.' : 'Cambios guardados.');
    window.setTimeout(() => setMessage(''), 2500);
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
          <button type="button" className={tab === 'direcciones' ? 'active' : ''} onClick={() => setTab('direcciones')}>Direcciones<ChevronRight size={16} /></button>
          <button type="button" className={tab === 'pedidos' ? 'active' : ''} onClick={() => setTab('pedidos')}>Mis pedidos<ChevronRight size={16} /></button>
          <button type="button" className="account-page-signout" onClick={signOut}><LogOut size={15} /> Cerrar sesión</button>
        </nav>

        <section className="account-page-content">
          {tab === 'datos' ? (
            <>
              <h1>Mis datos</h1>
              <p className="account-page-subtitle">Modifica tu nombre a continuación para que tu cuenta esté actualizada.</p>
              <form onSubmit={saveProfile} className="account-page-form">
                <h2>Detalles</h2>
                <label>Nombre completo<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" /></label>
                <h2>Datos de acceso</h2>
                <label>Correo electrónico<Input value={email} disabled /></label>
                {message && <p className="account-message">{message}</p>}
                <Button disabled={busy || !isSupabaseConfigured} type="submit" className="primary-button">{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
              </form>
            </>
          ) : tab === 'direcciones' ? (
            <>
              <h1>Direcciones</h1>
              <p className="account-page-subtitle">Esta dirección se precarga automáticamente cuando vas a pagar en el carrito.</p>
              <form onSubmit={saveProfile} className="account-page-form">
                <label>Teléfono<Input type="tel" value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value })} placeholder="+56 9 ..." /></label>
                <label>Región<NativeSelect className="admin-select" value={address.region} onChange={(event) => setAddress({ ...address, region: event.target.value, comuna: '' })}>
                  <NativeSelectOption value="">Selecciona tu región</NativeSelectOption>
                  {CHILE_REGIONS.map((region) => <NativeSelectOption key={region} value={region}>{region}</NativeSelectOption>)}
                </NativeSelect></label>
                <label>Comuna{address.region && COMUNAS_BY_REGION[address.region] ? <NativeSelect className="admin-select" value={address.comuna} onChange={(event) => setAddress({ ...address, comuna: event.target.value })}>
                  <NativeSelectOption value="">Selecciona tu comuna</NativeSelectOption>
                  {COMUNAS_BY_REGION[address.region].map((comuna) => <NativeSelectOption key={comuna} value={comuna}>{comuna}</NativeSelectOption>)}
                </NativeSelect> : <Input value={address.comuna} placeholder="Elige primero tu región" disabled={!address.region} onChange={(event) => setAddress({ ...address, comuna: event.target.value })} />}</label>
                <label>Dirección<Input value={address.address} onChange={(event) => setAddress({ ...address, address: event.target.value })} placeholder="Calle, número" /></label>
                <label>Depto / referencia (opcional)<Input value={address.addressExtra} onChange={(event) => setAddress({ ...address, addressExtra: event.target.value })} /></label>
                {message && <p className="account-message">{message}</p>}
                <Button disabled={busy || !isSupabaseConfigured} type="submit" className="primary-button">{busy ? 'Guardando…' : 'Guardar dirección'}</Button>
              </form>
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
                          <li key={`${item.productId}-${index}`}><span>{item.quantity}× {item.name}</span><span>{formatPrice(item.unitPrice * item.quantity)}</span></li>
                        ))}
                      </ul>
                      {order.tracking_number && <p className="account-page-order-tracking">N° de seguimiento: <strong>{order.tracking_number}</strong></p>}
                      <div className="account-page-order-total"><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
