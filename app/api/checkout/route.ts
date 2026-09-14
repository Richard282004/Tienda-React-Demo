import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import {
  calculateShipping,
  parseCheckoutPayload,
  type CheckoutPayload,
} from "@/lib/checkout-validation";
import { parseEmailList, sendLowStockAdminEmail, sendNewOrderAdminEmail, sendOrderConfirmationEmail, sendTransferInstructionsEmail } from "@/lib/email";
import { createMercadoPagoPreference } from "@/lib/mercadopago";
import { notifyAdminSubscribers } from "@/lib/web-push";
import { variantLabel } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  // Crear pedido reserva stock y llama a Mercado Pago: máx. 10 intentos por
  // minuto por IP es de sobra para una persona comprando y frena bots.
  const limit = rateLimit(`checkout:${clientIp(request)}`, 10, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

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
    // Si el cliente tiene sesión iniciada, el pedido queda vinculado a su
    // cuenta para que aparezca en "Mis pedidos". Sin token, el pedido igual
    // se crea normalmente (compra como invitado).
    let userId: string | null = null;
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { data: userData } = await supabase.auth.getUser(authHeader.slice(7));
        userId = userData.user?.id ?? null;
      } catch {
        /* Token inválido o expirado: el pedido sigue como compra de invitado. */
      }
    }
    // Libera primero el stock de pedidos abandonados (pending sin pago hace
    // más de 10 min) para que el cálculo de disponibilidad de abajo sea real.
    try {
      await supabase.rpc("expire_stale_orders");
    } catch {
      /* No crítico: si falla, el checkout sigue con el stock disponible actual. */
    }
    const { data: settings } = await supabase.from("site_content").select("value").eq("key", "store").maybeSingle();
    const storeSettings = (settings?.value ?? {}) as { brandName?: string; currency?: string; locale?: string; orderNotifyEmail?: string; lowStockThreshold?: number; transferEnabled?: boolean; transferDetails?: string; transferHoldHours?: number };
    const isTransfer = payload.paymentMethod === "transfer";
    if (isTransfer && !(storeSettings.transferEnabled && storeSettings.transferDetails?.trim())) {
      return NextResponse.json({ error: "El pago por transferencia no está disponible en este momento." }, { status: 400 });
    }
    const brandName = storeSettings.brandName || "Tu tienda";
    const currency = storeSettings.currency || "CLP";
    const locale = storeSettings.locale || "es-CL";
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, active, stock")
      .in(
        "id",
        payload.items.map((item) => item.productId),
      );
    if (productsError)
      return NextResponse.json(
        { error: "No pudimos consultar la colección. Inténtalo de nuevo." },
        { status: 503 },
      );
    const variantIds = payload.items.map((item) => item.variantId).filter((id): id is string => Boolean(id));
    const { data: variants, error: variantsError } = variantIds.length
      ? await supabase.from("product_variants").select("id, product_id, color, size, price, stock, active").in("id", variantIds)
      : { data: [] as { id: string; product_id: string; color: string | null; size: string | null; price: number; stock: number | null; active: boolean }[], error: null };
    if (variantsError)
      return NextResponse.json(
        { error: "No pudimos consultar la colección. Inténtalo de nuevo." },
        { status: 503 },
      );
    const { data: activeOptions, error: optionsError } = await supabase.from("product_variants").select("product_id").in("product_id", payload.items.map((item) => item.productId)).eq("active", true);
    if (optionsError) return NextResponse.json({ error: "No pudimos consultar las opciones." }, { status: 503 });
    if (payload.items.some((item) => !item.variantId && activeOptions?.some((option) => option.product_id === item.productId))) {
      return NextResponse.json({ error: "Elige una opción de cada producto con variantes antes de pagar." }, { status: 409 });
    }
    const orderItems = [];
    for (const item of payload.items) {
      const product = products?.find((product) => product.id === item.productId);
      if (!product || product.active === false) {
        return NextResponse.json(
          { error: "Uno de los productos ya no está disponible. Actualiza tu bolsita." },
          { status: 409 },
        );
      }
      if (item.variantId) {
        const variant = variants?.find((variant) => variant.id === item.variantId && variant.product_id === item.productId);
        if (!variant || variant.active === false || !Number.isSafeInteger(variant.price) || variant.price < 0) {
          return NextResponse.json(
            { error: "Una de las variantes ya no está disponible. Actualiza tu bolsita." },
            { status: 409 },
          );
        }
        if (variant.stock !== null && variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `Solo quedan ${variant.stock} unidades de "${product.name}" (${variantLabel(variant)}). Ajusta tu bolsita.` },
            { status: 409 },
          );
        }
        orderItems.push({
          productId: product.id as string,
          name: product.name as string,
          unitPrice: variant.price,
          quantity: item.quantity,
          variantId: variant.id,
          variantLabel: variantLabel(variant),
        });
        continue;
      }
      if (!Number.isSafeInteger(product.price) || product.price < 0) {
        return NextResponse.json(
          { error: "Uno de los productos ya no está disponible. Actualiza tu bolsita." },
          { status: 409 },
        );
      }
      if (product.stock !== null && product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Solo quedan ${product.stock} unidades de "${product.name}". Ajusta tu bolsita.` },
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
      .select("cost, requires_address")
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
    // Las zonas de retiro/entrega personal (requires_address = false) no
    // exigen comuna ni dirección; el resto de las regiones sí.
    if (shippingRate?.requires_address !== false && (!payload.comuna || !payload.address)) {
      return NextResponse.json({ error: "Ingresa tu comuna y dirección." }, { status: 400 });
    }

    let discountAmount = 0;
    let discountCode: string | null = null;
    if (payload.discountCode) {
      const { data: discount } = await supabase
        .from("discount_codes")
        .select("code, type, value, active, max_uses, used_count, expires_at")
        .eq("code", payload.discountCode)
        .maybeSingle();
      const now = new Date();
      const usable =
        discount &&
        discount.active &&
        (discount.expires_at === null || new Date(discount.expires_at) > now) &&
        (discount.max_uses === null || discount.used_count < discount.max_uses);
      if (!usable) {
        return NextResponse.json({ error: "Ese código de descuento no es válido." }, { status: 400 });
      }
      discountAmount = Math.min(
        subtotal,
        discount!.type === "percent" ? Math.round((subtotal * discount!.value) / 100) : discount!.value,
      );
      discountCode = discount!.code;
    }

    const total = subtotal - discountAmount + shippingCost;
    if (!Number.isSafeInteger(total) || total < 0 || total > 2_147_483_647) {
      return NextResponse.json({ error: "El importe del pedido no es válido." }, { status: 400 });
    }
    // Un descuento del 100% (más envío gratis) puede dejar el total en $0. En
    // ese caso no tiene sentido pasar por Mercado Pago: el pedido se marca
    // pagado directamente.
    const isFreeOrder = total === 0;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        stock_reserved: false, // Exige la migración; el trigger reserva en la misma transacción.
        user_id: userId,
        customer_name: payload.customerName,
        customer_email: payload.customerEmail,
        customer_phone: payload.customerPhone,
        customer_rut: payload.customerRut,
        region: payload.region,
        comuna: payload.comuna,
        address: payload.address,
        address_extra: payload.addressExtra || null,
        items: orderItems,
        subtotal,
        shipping_cost: shippingCost,
        discount_code: discountCode,
        discount_amount: discountAmount,
        total,
        status: isFreeOrder ? "paid" : "pending",
        payment_method: isTransfer ? "transfer" : "mercadopago",
      })
      .select("id")
      .single();
    if (orderError || !order) {
      return NextResponse.json(
        { error: "No pudimos reservar tu pedido. Revisa el stock y vuelve a aplicar tu descuento si utilizaste uno." },
        { status: 503 },
      );
    }
    if (isFreeOrder) {
      await notifyAdminSubscribers(supabase, env as Record<string, string | undefined>, { title: "Nuevo pedido confirmado", body: `Pedido #${order.id.slice(0, 8)}`, url: `/admin?order=${order.id}` });
      const emailApiKey = env.BREVO_API_KEY;
      if (emailApiKey) {
        try {
          await sendOrderConfirmationEmail({ apiKey: emailApiKey, to: payload.customerEmail, orderId: order.id, items: orderItems, total, brandName, currency, locale, fromEmail: env.BREVO_FROM_EMAIL });
          // Pedido gratis (100% descuento): no pasa por el webhook de Mercado
          // Pago, así que el aviso al admin y el de stock bajo van desde aquí.
          const adminEmails = parseEmailList(storeSettings.orderNotifyEmail);
          if (adminEmails.length) {
            await sendNewOrderAdminEmail({
              apiKey: emailApiKey, to: adminEmails, orderId: order.id,
              customerName: payload.customerName, customerEmail: payload.customerEmail, customerPhone: payload.customerPhone,
              region: payload.region, comuna: payload.comuna, address: payload.address, addressExtra: payload.addressExtra || null,
              items: orderItems, total, brandName, fromEmail: env.BREVO_FROM_EMAIL, currency, locale,
            });
            const threshold = typeof storeSettings.lowStockThreshold === "number" ? storeSettings.lowStockThreshold : 5;
            const { data: stockRows } = await supabase.from("products").select("name, stock").in("id", orderItems.map((item) => item.productId));
            const low = (stockRows ?? []).filter((row): row is { name: string; stock: number } => typeof row.stock === "number" && row.stock <= threshold);
            if (low.length) await sendLowStockAdminEmail({ apiKey: emailApiKey, to: adminEmails, products: low, threshold, brandName, fromEmail: env.BREVO_FROM_EMAIL });
          }
        } catch {
          /* El correo es un complemento: si falla, el pedido sigue su curso normal. */
        }
      }
      return NextResponse.json({ orderId: order.id, initPoint: `${new URL(request.url).origin}/pedido/confirmacion?order=${order.id}` });
    }

    if (isTransfer) {
      const siteUrl = new URL(request.url).origin;
      const emailApiKey = env.BREVO_API_KEY;
      if (emailApiKey) {
        try {
          await sendTransferInstructionsEmail({
            apiKey: emailApiKey, to: payload.customerEmail, orderId: order.id,
            items: orderItems, total,
            transferDetails: storeSettings.transferDetails!.trim(),
            holdHours: typeof storeSettings.transferHoldHours === "number" && storeSettings.transferHoldHours > 0 ? storeSettings.transferHoldHours : 48,
            storeUrl: siteUrl, brandName, fromEmail: env.BREVO_FROM_EMAIL, currency, locale,
          });
          const adminEmails = parseEmailList(storeSettings.orderNotifyEmail);
          if (adminEmails.length) {
            await sendNewOrderAdminEmail({
              apiKey: emailApiKey, to: adminEmails, orderId: order.id,
              customerName: payload.customerName, customerEmail: payload.customerEmail, customerPhone: payload.customerPhone,
              region: payload.region, comuna: payload.comuna, address: payload.address, addressExtra: payload.addressExtra || null,
              items: orderItems, total, brandName, fromEmail: env.BREVO_FROM_EMAIL, currency, locale, pendingTransfer: true,
            });
          }
        } catch {
          /* El correo es un complemento: el pedido ya quedó creado. */
        }
      }
      return NextResponse.json({ orderId: order.id, initPoint: `${siteUrl}/pedido/confirmacion?order=${order.id}` });
    }

    try {
      const { preferenceId, initPoint } = await createMercadoPagoPreference({
        accessToken: mpAccessToken,
        orderId: order.id,
        items: orderItems.map((item) => ({
          title: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
        shippingCost,
        discountAmount,
        payerEmail: payload.customerEmail,
        siteUrl: new URL(request.url).origin,
        currency,
      });
      await supabase.from("orders").update({ mp_preference_id: preferenceId }).eq("id", order.id);
      const emailApiKey = env.BREVO_API_KEY;
      if (emailApiKey) {
        try {
          await sendOrderConfirmationEmail({ apiKey: emailApiKey, to: payload.customerEmail, orderId: order.id, items: orderItems, total, brandName, currency, locale, fromEmail: env.BREVO_FROM_EMAIL });
        } catch {
          /* El correo es un complemento: si falla, el pedido sigue su curso normal. */
        }
      }
      return NextResponse.json({ orderId: order.id, initPoint });
    } catch (mpError) {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return NextResponse.json(
        { error: mpError instanceof Error ? mpError.message : "No pudimos preparar el pago. Inténtalo más tarde." },
        { status: 503 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "No pudimos conectar con el servicio de pagos. Inténtalo más tarde." },
      { status: 503 },
    );
  }
}
