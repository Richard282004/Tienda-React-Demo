import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { fetchMercadoPagoPayment } from '@/lib/mercadopago';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const paymentStatusToOrderStatus: Record<string, 'paid' | 'cancelled' | 'pending'> = {
  approved: 'paid',
  rejected: 'cancelled',
  cancelled: 'cancelled',
  refunded: 'cancelled',
  pending: 'pending',
  in_process: 'pending',
};

export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  const mpAccessToken = env.MP_ACCESS_TOKEN as string | undefined;
  if (!supabaseUrl || !serviceRoleKey || !mpAccessToken) return NextResponse.json({ ok: false }, { status: 200 });

  const url = new URL(request.url);
  const paymentId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  const topic = url.searchParams.get('type') ?? url.searchParams.get('topic');
  // Mercado Pago reintenta si no respondemos 200; para cualquier notificación
  // que no sea de pago, confirmamos recepción sin hacer nada más.
  if (topic !== 'payment' || !paymentId) return NextResponse.json({ ok: true });

  try {
    const payment = await fetchMercadoPagoPayment(mpAccessToken, paymentId);
    const orderStatus = paymentStatusToOrderStatus[payment.status] ?? 'pending';
    const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
    await supabase
      .from('orders')
      .update({ status: orderStatus, mp_payment_id: String(payment.id), updated_at: new Date().toISOString() })
      .eq('id', payment.external_reference);
    return NextResponse.json({ ok: true });
  } catch {
    // Devolvemos 200 igual: si fue un error transitorio, Mercado Pago reintenta el webhook solo.
    return NextResponse.json({ ok: false });
  }
}
