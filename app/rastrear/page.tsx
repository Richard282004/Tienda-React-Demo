'use client';

import { ShipmentStatus } from '@/components/shipment-status';
import { useState } from 'react';
import { Search, Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Order } from '@/lib/orders';
import { orderStatusLabel } from '@/lib/orders';
import { defaultStoreContent, type StoreContent } from '@/lib/store-data';
import { formatPrice as formatCurrency } from '@/lib/currency';
import './rastrear.css';

export default function RastrearPage() {
  const [email, setEmail] = useState('');
  const [shortId, setShortId] = useState('');
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [content] = useState<StoreContent>(defaultStoreContent);
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);

  const completed = !!order && ['paid', 'shipped', 'delivered'].includes(order.status);

  const search = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setSearched(false);
    const { data } = await supabase.rpc('get_order_by_short_id_and_email', {
      short_id: shortId.trim(),
      p_email: email.trim(),
    });
    const rows = (Array.isArray(data) ? data : []) as Order[];
    setOrder(rows[0] ?? null);
    setSearched(true);
    setBusy(false);
  };

  return (
    <main className="confirmation-shell">
      <section className="confirmation-card">
        <h1>Rastrear mi pedido</h1>
        <p className="confirmation-status">Ingresa tu correo y el número de pedido (lo tienes en el correo o WhatsApp de confirmación).</p>
        {!isSupabaseConfigured ? (
          <p className="confirmation-status">La consulta de pedidos no está disponible por el momento.</p>
        ) : (
          <>
            <form className="rastrear-form" onSubmit={search}>
              <label>Correo electrónico<Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
              <label>N° de pedido<Input required maxLength={8} value={shortId} onChange={(event) => setShortId(event.target.value)} placeholder="ej: a1b2c3d4" /></label>
              <Button className="primary-button" type="submit" disabled={busy}>{busy ? 'Buscando…' : 'Buscar pedido'} <Search size={16} /></Button>
            </form>
            {searched && !order && (
              <p className="rastrear-empty">No encontramos un pedido con esos datos. Revisa que el correo y el número sean los mismos que usaste al comprar.</p>
            )}
            {order && (
              <div className="rastrear-result">
                <div className={`confirmation-icon ${completed ? 'ok' : order.status === 'cancelled' ? 'bad' : 'warn'}`}>
                  {completed ? <Check size={26} /> : order.status === 'cancelled' ? <X size={26} /> : <Clock size={26} />}
                </div>
                <p className="confirmation-status">Estado: <strong>{orderStatusLabel[order.status]}</strong></p>
                <div className="confirmation-summary">
                  <div><span>Pedido</span><strong>{order.id.slice(0, 8)}</strong></div>
                  <div><span>Envío a</span><strong>{order.comuna}, {order.region}</strong></div>
                  <div><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
                  <ShipmentStatus order={order} />
                </div>
                <ul className="confirmation-items">
                  {order.items.map((item, index) => (
                    <li key={`${item.productId}-${index}`}><span>{item.quantity}× {item.name}{item.variantLabel ? ` (${item.variantLabel})` : ''}</span><span>{formatPrice(item.unitPrice * item.quantity)}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <a className="confirmation-back" href="/">Volver a la tienda</a>
      </section>
    </main>
  );
}
