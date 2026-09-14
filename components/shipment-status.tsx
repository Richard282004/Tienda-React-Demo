'use client';
import { useState } from 'react';
import type { Order } from '@/lib/orders';
import { BLUE_TRACKING_URL, COLLECT_NOTICE } from '@/lib/shipping';
export function ShipmentStatus({ order }: { order: Pick<Order, 'shipping_payment' | 'shipping_carrier' | 'tracking_number'> }) {
  const [copied, setCopied] = useState(false);
  return <div className="shipment-status">
    {order.shipping_payment === 'collect' && <p>{COLLECT_NOTICE}</p>}
    {order.shipping_payment === 'pickup' && <p>Retiro / entrega personal. Coordinaremos el lugar y horario contigo.</p>}
    {order.tracking_number && <><p>{order.shipping_carrier === 'blue_express' ? 'Blue Express · ' : ''}N° de seguimiento: <strong>{order.tracking_number}</strong></p>
      {order.shipping_carrier === 'blue_express' && <><button type="button" onClick={() => { void navigator.clipboard.writeText(order.tracking_number!).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Copiado' : 'Copiar número'}</button>{' '}<a href={BLUE_TRACKING_URL} target="_blank" rel="noopener noreferrer">Seguir mi envío en Blue Express ↗</a><small>Ingresa ese número en el seguimiento de Blue Express.</small></>}
    </>}
  </div>;
}
