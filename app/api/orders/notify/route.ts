import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { parseEmailList, sendLowStockAdminEmail, sendNewOrderAdminEmail, sendOrderStatusEmail } from "@/lib/email";
import { formatPrice } from "@/lib/currency";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyAdminSubscribers } from "@/lib/web-push";

type OrderItem = { productId: string; name: string; quantity: number };

export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  const emailApiKey = env.BREVO_API_KEY as string | undefined;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ ok: false }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  let body: { orderId?: string; status?: string; trackingNumber?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!body.orderId || !body.status) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });

  const { data: order } = await supabase.from("orders").select("customer_name, customer_email, customer_phone, region, comuna, address, address_extra, items, total, status, tracking_number, shipping_payment, shipping_carrier").eq("id", body.orderId).maybeSingle();
  if (order && order.status !== body.status) return NextResponse.json({ error: "El estado cambió. Actualiza el pedido." }, { status: 409 });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  try {
    const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
    const store = settings?.value as { brandName?: string; orderNotifyEmail?: string; lowStockThreshold?: number; currency?: string; locale?: string; faviconUrl?: string } | undefined;
    const brandName = store?.brandName || "Tu tienda";
    const fromEmail = env.BREVO_FROM_EMAIL as string | undefined;


    // Al confirmar un pago (típicamente una transferencia aprobada a mano),
    // revisa el stock igual que haría el webhook de Mercado Pago.
    if (body.status === "paid") {
      const items = (order.items ?? []) as OrderItem[];
      const productLabel = items.length > 1 ? `${items[0]?.name ?? "Producto"} y ${items.length - 1} más` : items[0]?.name ?? "Producto";
      await notifyAdminSubscribers(supabase, env as Record<string, string | undefined>, {
        title: `Nueva venta · ${formatPrice(order.total, store?.currency, store?.locale)}`,
        body: `Pedido #${body.orderId.slice(0, 8)} · ${productLabel}`,
        url: `/admin?order=${body.orderId}`,
        icon: store?.faviconUrl,
      });
      const adminEmails = parseEmailList(store?.orderNotifyEmail);
      if (emailApiKey && adminEmails.length) {
        await sendNewOrderAdminEmail({
          apiKey: emailApiKey, to: adminEmails, orderId: body.orderId,
          customerName: order.customer_name, customerEmail: order.customer_email, customerPhone: order.customer_phone,
          region: order.region, comuna: order.comuna, address: order.address, addressExtra: order.address_extra,
          items: order.items, total: order.total, shippingPayment: order.shipping_payment, brandName, fromEmail,
          currency: store?.currency, locale: store?.locale,
        });
      }
      const productIds = [...new Set(((order.items ?? []) as OrderItem[]).map((item) => item.productId).filter(Boolean))];
      if (emailApiKey && adminEmails.length && productIds.length) {
        const threshold = typeof store?.lowStockThreshold === "number" ? store.lowStockThreshold : 5;
        const { data: stockRows } = await supabase.from("products").select("name, stock").in("id", productIds);
        const low = (stockRows ?? []).filter((row): row is { name: string; stock: number } => typeof row.stock === "number" && row.stock <= threshold);
        if (low.length) await sendLowStockAdminEmail({ apiKey: emailApiKey, to: adminEmails, products: low, threshold, brandName, fromEmail });
      }
    }
    if (emailApiKey) await sendOrderStatusEmail({ apiKey: emailApiKey, to: order.customer_email, orderId: body.orderId, status: body.status, trackingNumber: order.tracking_number, shippingPayment: order.shipping_payment, shippingCarrier: order.shipping_carrier, brandName, fromEmail });
  } catch {
    return NextResponse.json({error:"El estado se guardó, pero no pudimos enviar el aviso."}, {status:502});
  }
  return NextResponse.json({ ok: true });
}
