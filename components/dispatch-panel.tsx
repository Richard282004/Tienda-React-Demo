'use client';
import { useState } from 'react';
import type { Order } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import { BLUE_SHIPPING_URL, validTracking } from '@/lib/shipping';
import { ShipmentStatus } from './shipment-status';
export function DispatchPanel({ order, onSaved }: { order: Order; onSaved: () => Promise<void> }) {
  const [tracking, setTracking] = useState(order.tracking_number ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const recipient = [order.customer_name, order.customer_rut, order.customer_phone, order.customer_email, order.address, order.address_extra, order.comuna, order.region].filter(Boolean).join('\n');
  async function save(shipped: boolean) {
    if (!supabase || busy) return;
    if (!validTracking(tracking)) { setMessage('Ingresa un número de seguimiento de 5 a 50 letras, números o guiones.'); return; }
    setBusy(true); setMessage('');
    try {
      const { data: saved, error } = await supabase.from('orders').update({ shipping_carrier: 'blue_express', tracking_number: tracking.trim(), ...(shipped ? {status: 'shipped'} : {}) }).eq('id', order.id).eq('status', order.status).select('id').maybeSingle();
      if (error || !saved) throw new Error('No se pudo guardar. Actualiza el pedido y vuelve a intentarlo.');
      let emailFailed = false;
      if (shipped) {
        const {data} = await supabase.auth.getSession();
        if (data.session) {
          try {
            const response = await fetch('/api/orders/notify', {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${data.session.access_token}`}, body:JSON.stringify({orderId:order.id,status:'shipped'})});
            emailFailed = !response.ok;
          } catch { emailFailed = true; }
        } else emailFailed = true;
      }
      setMessage(emailFailed ? 'Despacho guardado. No pudimos confirmar el aviso por correo.' : shipped ? 'Pedido marcado como enviado. El seguimiento ya está disponible para el cliente.' : 'Seguimiento guardado. Marca como enviado cuando entregues el paquete al transportista.');
      await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  if (order.shipping_payment === 'pickup') return <ShipmentStatus order={order} />;
  return <details className="dispatch-panel"><summary>Preparar despacho · Blue Express</summary>
    <p>{order.shipping_payment === 'collect' ? 'Despacho por pagar: confirma el valor con el cliente antes de enviarlo.' : 'Despacho cobrado en la tienda: genera un envío prepagado.'}</p>
    <ol><li>Copia los datos del destinatario.</li><li>Cotiza y genera la etiqueta en Blue Express con el peso y las medidas del paquete.</li><li>Entrega el paquete y guarda el número de seguimiento aquí.</li></ol>
    <pre>{recipient}</pre>
    <div className="dispatch-actions"><button type="button" onClick={() => { void navigator.clipboard.writeText(recipient).then(() => setMessage('Datos copiados.')).catch(() => setMessage('No pudimos copiar. Selecciona los datos de arriba.')); }}>Copiar datos</button><a href={BLUE_SHIPPING_URL} target="_blank" rel="noopener noreferrer">Abrir Blue Express ↗</a></div>
    <label>N° de seguimiento<input value={tracking} maxLength={50} onChange={(e) => setTracking(e.target.value)} placeholder="Número de la etiqueta de Blue Express" /></label>
    <div className="dispatch-actions"><button type="button" disabled={busy || !['paid','shipped'].includes(order.status)} onClick={() => void save(false)}>Guardar seguimiento</button><button type="button" disabled={busy || order.status !== 'paid'} onClick={() => void save(true)}>Guardar y marcar como enviado</button></div>
    {!['paid','shipped','delivered'].includes(order.status) && <p>El pedido debe tener el pago confirmado y stock reservado antes del despacho.</p>}
    <p role="status">{message}</p><ShipmentStatus order={order} />
  </details>;
}
