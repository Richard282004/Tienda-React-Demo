'use client';

import { useEffect, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Order } from '@/lib/orders';
import { orderStatusLabel } from '@/lib/orders';
import './confirmacion.css';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

export default function ConfirmacionPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('order');
    if (!orderId || !supabase) { setLoading(false); return; }
    let active = true;
    void supabase.rpc('get_order_public', { order_id: orderId }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : null;
      if (active) { setOrder((row as Order) ?? null); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="confirmation-shell">
      <section className="confirmation-card">
        {loading ? <p>Buscando tu pedido…</p> : !order ? (
          <>
            <div className="confirmation-icon warn"><Clock size={26} /></div>
            <h1>No encontramos ese pedido</h1>
            <p>Si acabas de pagar, espera unos segundos y recarga esta página.</p>
          </>
        ) : (
          <>
            <div className={`confirmation-icon ${order.status === 'paid' ? 'ok' : order.status === 'cancelled' ? 'bad' : 'warn'}`}>
              {order.status === 'paid' ? <Check size={26} /> : order.status === 'cancelled' ? <X size={26} /> : <Clock size={26} />}
            </div>
            <h1>{order.status === 'paid' ? '¡Gracias por tu compra!' : order.status === 'cancelled' ? 'El pago no se completó' : 'Tu pago está en proceso'}</h1>
            <p className="confirmation-status">Estado: <strong>{orderStatusLabel[order.status]}</strong></p>
            <div className="confirmation-summary">
              <div><span>Pedido</span><strong>{order.id.slice(0, 8)}</strong></div>
              <div><span>Envío a</span><strong>{order.comuna}, {order.region}</strong></div>
              <div><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
            </div>
            <ul className="confirmation-items">
              {order.items.map((item, index) => <li key={`${item.productId}-${index}`}><span>{item.quantity}× {item.name}</span><span>{formatPrice(item.unitPrice * item.quantity)}</span></li>)}
            </ul>
          </>
        )}
        {!isSupabaseConfigured && <p className="confirmation-status">Falta conectar Supabase.</p>}
        <a className="confirmation-back" href="/">Volver a la tienda</a>
      </section>
    </main>
  );
}
