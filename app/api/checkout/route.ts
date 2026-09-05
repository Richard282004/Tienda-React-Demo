import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import {
  calculateShipping,
  parseCheckoutPayload,
  type CheckoutPayload,
} from "@/lib/checkout-validation";
import { createMercadoPagoPreference } from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const mpAccessToken = env.MP_ACCESS_TOKEN;
  if (!supabaseUrl || !serviceRoleKey || !mpAccessToken) {
    return NextResponse.json(
      { error: "El pago no está disponible por el momento. Inténtalo más tarde." },
      { status: 503 },
    );
  }
  let payload: CheckoutPayload;
  try {
    const body = await request.text();
    if (body.length > 20_000)
      return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413 });
    payload = parseCheckoutPayload(JSON.parse(body));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SyntaxError
            ? "Solicitud inválida."
            : error instanceof Error
              ? error.message
              : "Revisa los datos de envío.",
      },
      { status: 400 },
    );
  }
  try {
    const supabase = getSupabaseAdmin(supabaseUrl, serviceRoleKey);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, active")
      .in(
        "id",
        payload.items.map((item) => item.productId),
      );
    if (productsError)
      return NextResponse.json(
        { error: "No pudimos consultar la colección. Inténtalo de nuevo." },
        { status: 503 },
      );
    const orderItems = [];
    for (const item of payload.items) {
      const product = products?.find((product) => product.id === item.productId);
      if (
        !product ||
        product.active === false ||
        !Number.isSafeInteger(product.price) ||
        product.price < 0
      ) {
        return NextResponse.json(
          { error: "Uno de los productos ya no está disponible. Actualiza tu bolsita." },
          { status: 409 },
        );
      }
      orderItems.push({
        productId: product.id as string,
        name: product.name as string,
        unitPrice: product.price as number,
        quantity: item.quantity,
      });
    }
    const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const { data: shippingRate, error: shippingError } = await supabase
      .from("shipping_rates")
      .select("cost")
      .eq("region", payload.region)
      .maybeSingle();
    if (shippingError)
      return NextResponse.json(
        { error: "No pudimos calcular el envío. Inténtalo de nuevo." },
        { status: 503 },
      );
    const shippingCost = calculateShipping(subtotal, shippingRate?.cost);
    if (shippingCost === null)
      return NextResponse.json(
        { error: "El envío a esa región no está disponible." },
        { status: 422 },
      );
    const total = subtotal + shippingCost;
    if (!Number.isSafeInteger(total) || total <= 0 || total > 2_147_483_647) {
      return NextResponse.json({ error: "El importe del pedido no es válido." }, { status: 400 });
    }
    const { data: order, error: orderError } = await supabase
      .from("orders")
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
        status: "pending",
      })
      .select("id")
      .single();
    if (orderError || !order)
      return NextResponse.json(
        { error: "No pudimos preparar tu pedido. Inténtalo de nuevo." },
        { status: 503 },
      );
    const { preferenceId, initPoint } = await createMercadoPagoPreference({
      accessToken: mpAccessToken,
      orderId: order.id,
      items: orderItems.map((item) => ({
        title: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      shippingCost,
      payerEmail: payload.customerEmail,
      siteUrl: new URL(request.url).origin,
    });
    const { error: preferenceError } = await supabase
      .from("orders")
      .update({ mp_preference_id: preferenceId })
      .eq("id", order.id);
    if (preferenceError)
      return NextResponse.json(
        { error: "No pudimos preparar el pago. Inténtalo más tarde." },
        { status: 503 },
      );
    return NextResponse.json({ orderId: order.id, initPoint });
  } catch {
    return NextResponse.json(
      { error: "No pudimos conectar con el servicio de pagos. Inténtalo más tarde." },
      { status: 503 },
    );
  }
}
