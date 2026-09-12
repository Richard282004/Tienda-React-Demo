"use client";

import { useEffect, useState } from "react";
import { Check, Clock, X } from "lucide-react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Order } from "@/lib/orders";
import { orderStatusLabel } from "@/lib/orders";
import { defaultStoreContent, type StoreContent } from "@/lib/store-data";
import { formatPrice as formatCurrency } from "@/lib/currency";
import "./confirmacion.css";

export default function ConfirmacionPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);

  const completed = !!order && ["paid", "shipped", "delivered"].includes(order.status);
  const awaitingTransfer = !!order && order.status === "pending" && order.payment_method === "transfer";

  useEffect(() => {
    if (!supabase) return;
    void supabase.from("site_content").select("value").eq("key", "store").maybeSingle().then(({ data }) => {
      if (data?.value) setContent({ ...defaultStoreContent, ...(data.value as Partial<StoreContent>) });
    });
  }, []);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order");
    if (!orderId || !supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    const client = supabase;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const refresh = async () => {
      try {
        const { data } = await client.rpc("get_order_public", { order_id: orderId });
        const row = Array.isArray(data) ? data[0] : null;
        if (active) {
          setOrder((row as Order) ?? null);
          setLoading(false);
        }
        if (active && (!row || row.status === "pending") && ++attempts < 10)
          timer = setTimeout(() => void refresh(), 4000);
      } catch {
        if (active) setLoading(false);
      }
    };
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="confirmation-shell">
      <section className="confirmation-card">
        {loading ? (
          <p>Buscando tu pedido…</p>
        ) : !order ? (
          <>
            <div className="confirmation-icon warn">
              <Clock size={26} />
            </div>
            <h1>No encontramos ese pedido</h1>
            <p>Si acabas de pagar, espera unos segundos y recarga esta página.</p>
          </>
        ) : (
          <>
            <div
              className={`confirmation-icon ${completed ? "ok" : order.status === "cancelled" ? "bad" : "warn"}`}
            >
              {completed ? (
                <Check size={26} />
              ) : order.status === "cancelled" ? (
                <X size={26} />
              ) : (
                <Clock size={26} />
              )}
            </div>
            <h1>
              {completed
                ? "¡Gracias por tu compra!"
                : order.status === "cancelled"
                  ? "El pago no se completó"
                  : awaitingTransfer
                    ? "Falta tu transferencia"
                    : "Tu pago está en proceso"}
            </h1>
            <p className="confirmation-status">
              Estado: <strong>{orderStatusLabel[order.status]}</strong>
            </p>
            <div className="confirmation-summary">
              <div>
                <span>Pedido</span>
                <strong>{order.id.slice(0, 8)}</strong>
              </div>
              <div>
                <span>Envío a</span>
                <strong>
                  {order.comuna}, {order.region}
                </strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatPrice(order.total)}</strong>
              </div>
            </div>
            <ul className="confirmation-items">
              {order.items.map((item, index) => (
                <li key={`${item.productId}-${index}`}>
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            {awaitingTransfer && content.transferDetails?.trim() && (
              <div className="confirmation-transfer">
                <p className="confirmation-transfer-title">Transfiere {formatPrice(order.total)} a:</p>
                <pre className="confirmation-transfer-details">{content.transferDetails.trim()}</pre>
                <p className="confirmation-transfer-glosa">
                  Pon <strong>{order.id.slice(0, 8)}</strong> como mensaje/glosa de la transferencia, así identificamos tu pago al tiro.
                </p>
                <p className="confirmation-transfer-note">
                  Después de transferir, envíanos el comprobante por WhatsApp
                  {content.whatsapp ? (
                    <> (<a href={`https://wa.me/${content.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">escribir</a>)</>
                  ) : null}{" "}
                  o respondiendo el correo de tu pedido. Reservamos tu pedido mientras confirmamos el pago.
                </p>
              </div>
            )}
          </>
        )}
        {!isSupabaseConfigured && (
          <p className="confirmation-status">
            La consulta de pedidos no está disponible por el momento.
          </p>
        )}
        <a className="confirmation-back" href="/">
          Volver a la tienda
        </a>
      </section>
    </main>
  );
}
