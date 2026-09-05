import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { createMercadoPagoPreference } from '@/lib/mercadopago';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type CheckoutPayload = {
  items: { productId: string; quantity: number }[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  region: string;
  comuna: string;
  address: string;
  addressExtra?: string;
};

export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  const mpAccessToken = env.MP_ACCESS_TOKEN as string | undefined;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Falta configurar Supabase en el servidor.' }, { status: 500 });
  if (!mpAccessToken) return NextResponse.json({ error: 'Falta configurar Mercado Pago en el servidor.' }, { status: 500 });

  let payload: CheckoutPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (!payload.items?.length) return NextResponse.json({ error: 'El carrito está vacío.' }, { status: 400 });
  if (!payload.customerName || !payload.customerEmail || !payload.customerPhone || !payload.region || !payload.comuna || !payload.address) {
    return NextResponse.json({ error: 'Completa todos los datos de envío.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);

  // Los precios y disponibilidad se validan siempre en el servidor; nunca se
  // confía en lo que mande el cliente.
  const productIds = payload.items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, active')
    .in('id', productIds);
  if (productsError) return NextResponse.json({ error: productsError.message }, { status: 500 });

  const orderItems = payload.items.map((cartItem) => {
    const product = products?.find((item) => item.id === cartItem.productId);
    if (!product || product.active === false) throw new Error(`Producto no disponible: ${cartItem.productId}`);
    return { productId: product.id, name: product.name as string, unitPrice: product.price as number, quantity: cartItem.quantity };
  });
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const { data: shippingRate } = await supabase.from('shipping_rates').select('cost').eq('region', payload.region).maybeSingle();
  const shippingCost = shippingRate?.cost ?? 0;
  const total = subtotal + shippingCost;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      customer_phone: payload.customerPhone,
      region: payload.region,
      comuna: payload.comuna,
      address: payload.address,
      address_extra: payload.addressExtra || null,
      items: orderItems,
      subtotal,
      shipping_cost: shippingCost,
      total,
      status: 'pending',
    })
    .select('id')
    .single();
  if (orderError || !order) return NextResponse.json({ error: orderError?.message ?? 'No se pudo crear el pedido.' }, { status: 500 });

  try {
    const siteUrl = new URL(request.url).origin;
    const { preferenceId, initPoint } = await createMercadoPagoPreference({
      accessToken: mpAccessToken,
      orderId: order.id,
      items: orderItems.map((item) => ({ title: item.name, quantity: item.quantity, unit_price: item.unitPrice })),
      shippingCost,
      payerEmail: payload.customerEmail,
      siteUrl,
    });
    await supabase.from('orders').update({ mp_preference_id: preferenceId }).eq('id', order.id);
    return NextResponse.json({ orderId: order.id, initPoint });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error creando el pago.' }, { status: 500 });
  }
}
