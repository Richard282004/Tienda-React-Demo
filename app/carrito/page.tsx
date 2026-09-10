'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ProductArtwork } from '@/components/product-artwork';
import { calculateShipping } from '@/lib/checkout-validation';
import { type Address, type ShippingRate } from '@/lib/orders';
import { defaultStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { formatPrice as formatCurrency } from '@/lib/currency';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import './carrito.css';

type Shipping = { name: string; email: string; phone: string; region: string; comuna: string; address: string; addressExtra: string };
const emptyShipping: Shipping = { name: '', email: '', phone: '', region: '', comuna: '', address: '', addressExtra: '' };

export default function CarritoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);
  const formatPrice = (price: number) => formatCurrency(price, content.currency, content.locale);
  const [cart, setCart] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [shipping, setShipping] = useState<Shipping>(emptyShipping);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [discountChecking, setDiscountChecking] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lumina-bag') ?? '[]');
      if (Array.isArray(saved)) setCart(saved.filter((id): id is string => typeof id === 'string').slice(0, 300));
    } catch { /* El almacenamiento privado puede no estar disponible. */ }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem('lumina-bag', JSON.stringify(cart)); } catch { /* La compra sigue funcionando sin persistencia local. */ }
  }, [cart, storageReady]);

  useEffect(() => {
    const client = supabase;
    const load = async () => {
      if (!client) { setLoading(false); return; }
      const [{ data: productRows }, { data: rateRows }, { data: settings }] = await Promise.all([
        client.from('products').select('id, name, price, color, art, image_url, stock, active').order('sort_order'),
        client.from('shipping_rates').select('region, cost, requires_address, warning'),
        client.from('site_content').select('value').eq('key', 'store').maybeSingle(),
      ]);
      setProducts((productRows ?? []) as Product[]);
      setShippingRates((rateRows ?? []) as ShippingRate[]);
      if (settings?.value) setContent({ ...defaultStoreContent, ...(settings.value as Partial<StoreContent>) });
      const { data: userData } = await client.auth.getUser();
      const user = userData.user;
      if (user) {
        setSessionEmail(user.email ?? null);
        const [{ data: profile }, { data: addressRows }] = await Promise.all([
          client.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
          client.from('addresses').select('*').eq('user_id', user.id).order('created_at'),
        ]);
        const list = (addressRows ?? []) as Address[];
        setSavedAddresses(list);
        const last = list[list.length - 1];
        if (last) {
          setSelectedAddressId(last.id);
          setShipping({ name: last.full_name, email: user.email ?? '', phone: last.phone, region: last.region, comuna: last.comuna, address: last.address, addressExtra: last.address_extra ?? '' });
        } else {
          setShipping((current) => ({ ...current, name: profile?.full_name ?? '', email: user.email ?? '' }));
        }
      }
      setLoading(false);
    };
    void load();
  }, []);

  const cartProducts = cart.map((id) => products.find((product) => product.id === id)).filter(Boolean) as Product[];
  const groupedCart = useMemo(() => {
    const counts = new Map<string, number>();
    cart.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    return [...counts.entries()]
      .map(([id, quantity]) => ({ product: products.find((product) => product.id === id), quantity }))
      .filter((group): group is { product: Product; quantity: number } => !!group.product);
  }, [cart, products]);
  const total = cartProducts.reduce((sum, product) => sum + product.price, 0);
  const selectedRate = shippingRates.find((rate) => rate.region === shipping.region);
  const requiresAddress = selectedRate?.requires_address ?? true;
  const shippingCost = calculateShipping(total, selectedRate?.cost);
  const shippingZones = useMemo(() => shippingRates.filter((rate) => rate.requires_address ?? true), [shippingRates]);
  const pickupZones = useMemo(() => shippingRates.filter((rate) => !(rate.requires_address ?? true)), [shippingRates]);
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const transferAvailable = Boolean(content.transferEnabled && content.transferDetails?.trim());
  const [paymentMethod, setPaymentMethod] = useState<'mercadopago' | 'transfer'>('mercadopago');
  useEffect(() => { if (!transferAvailable) setPaymentMethod('mercadopago'); }, [transferAvailable]);
  useEffect(() => {
    if (shipping.region && pickupZones.some((rate) => rate.region === shipping.region)) setDeliveryMethod('pickup');
  }, [shipping.region, pickupZones]);
  const chooseDeliveryMethod = (method: 'shipping' | 'pickup') => {
    setDeliveryMethod(method);
    if (method === 'pickup' && pickupZones.length === 1) {
      setShipping((current) => ({ ...current, region: pickupZones[0].region }));
    } else {
      setShipping((current) => ({ ...current, region: '' }));
    }
  };
  const shippingComplete = Boolean(
    shipping.name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email.trim()) &&
    shipping.phone.trim() &&
    shipping.region &&
    (!requiresAddress || (shipping.comuna.trim() && shipping.address.trim())),
  );
  const discountAmount = appliedDiscount ? Math.min(total, appliedDiscount.amount) : 0;
  const grandTotal = total - discountAmount + (shippingCost ?? 0);

  const incrementCartItem = (id: string) => {
    const product = products.find((item) => item.id === id);
    const inCart = cart.filter((item) => item === id).length;
    if (product?.stock != null && inCart >= product.stock) return;
    setCart((current) => [...current, id]);
  };
  const decrementCartItem = (id: string) => {
    setCart((current) => { const at = current.indexOf(id); if (at === -1) return current; return current.filter((_, i) => i !== at); });
  };
  const removeFromCart = (id: string) => setCart((current) => current.filter((item) => item !== id));

  const applyDiscountCode = async () => {
    if (!supabase || !discountInput.trim()) return;
    setDiscountChecking(true);
    setCheckoutError('');
    const { data } = await supabase.rpc('preview_discount_code', { p_code: discountInput.trim(), p_subtotal: total });
    const row = Array.isArray(data) ? data[0] : null;
    setDiscountChecking(false);
    if (!row?.valid) { setAppliedDiscount(null); setCheckoutError(row?.message ?? 'Código no válido.'); return; }
    setAppliedDiscount({ code: discountInput.trim().toUpperCase(), amount: row.discount_amount });
  };

  const handleCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cartProducts.length || !shippingComplete || shippingCost === null) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    const counts = new Map<string, number>();
    cart.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    try {
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData.session?.access_token;
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          items: [...counts.entries()].map(([productId, quantity]) => ({ productId, quantity })),
          customerName: shipping.name,
          customerEmail: shipping.email,
          customerPhone: shipping.phone,
          region: shipping.region,
          comuna: shipping.comuna,
          address: shipping.address,
          addressExtra: shipping.addressExtra,
          discountCode: appliedDiscount?.code,
          paymentMethod,
        }),
      });
      const data = (await response.json()) as { initPoint?: string; error?: string };
      if (!response.ok || !data.initPoint) { setCheckoutError(data.error ?? 'No se pudo iniciar el pago.'); return; }
      if (supabase && !savedAddresses.length) {
        // Primera compra con cuenta: guarda esta dirección para la próxima vez.
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          try {
            await supabase.from('addresses').insert({
              user_id: userData.user.id, full_name: shipping.name, phone: shipping.phone,
              region: shipping.region, comuna: shipping.comuna, address: shipping.address, address_extra: shipping.addressExtra || null,
            });
          } catch { /* Guardar la dirección es un complemento; el pedido ya se creó igual. */ }
        }
      }
      // El pedido ya quedó creado (con el stock reservado); la bolsita de
      // compra ya cumplió su función, así que se vacía antes de salir a pagar.
      try { localStorage.setItem('lumina-bag', JSON.stringify([])); } catch { /* no crítico */ }
      window.location.href = data.initPoint;
    } catch {
      setCheckoutError('No se pudo conectar con el servidor de pagos.');
    } finally {
      setCheckoutBusy(false);
    }
  };

  return (
    <main className="cart-page-shell">
      <header className="cart-page-header">
        <a href="/" className="cart-page-back"><ArrowLeft size={16} /> Volver a la tienda</a>
      </header>

      {loading ? <p className="cart-page-loading">Cargando tu bolsita…</p> : cartProducts.length === 0 ? (
        <div className="cart-page-empty">
          <span aria-hidden="true">♡</span>
          <p>Tu bolsita está esperando algo bonito.</p>
          <Button className="primary-button" onClick={() => { window.location.href = '/#tienda'; }}>Explorar tienda</Button>
        </div>
      ) : (
        <div className="cart-page-grid">
          <section className="cart-page-items">
            <div className="cart-page-items-heading">
              <h1>Tu carrito <small>({cartProducts.length} producto{cartProducts.length === 1 ? '' : 's'})</small></h1>
              <button type="button" className="clear-cart" onClick={() => setCart([])}><Trash2 size={13} /> Vaciar carrito</button>
            </div>
            {groupedCart.map(({ product, quantity }) => (
              <div className="cart-page-item" key={product.id}>
                <div className="cart-thumb" style={{ backgroundColor: product.color }}><ProductArtwork product={product} /></div>
                <div className="cart-page-item-info">
                  <h3>{product.name}</h3>
                  <p>{formatPrice(product.price)}</p>
                </div>
                <div className="cart-qty">
                  <button aria-label={`Quitar una unidad de ${product.name}`} onClick={() => decrementCartItem(product.id)}><Minus size={14} /></button>
                  <span>{quantity}</span>
                  <button aria-label={`Agregar una unidad de ${product.name}`} disabled={product.stock != null && quantity >= product.stock} onClick={() => incrementCartItem(product.id)}><Plus size={14} /></button>
                </div>
                <strong className="cart-page-item-total">{formatPrice(product.price * quantity)}</strong>
                <button type="button" className="cart-page-item-remove" aria-label={`Quitar ${product.name} del carrito`} onClick={() => removeFromCart(product.id)}><Trash2 size={15} /></button>
              </div>
            ))}
          </section>

          <aside className="cart-page-summary">
            <h2>Resumen del pedido</h2>
            <div className="cart-page-summary-row"><span>{cartProducts.length} producto{cartProducts.length === 1 ? '' : 's'}</span><strong>{formatPrice(total)}</strong></div>
            {discountAmount > 0 && <div className="cart-page-summary-row"><span>Descuento</span><strong>-{formatPrice(discountAmount)}</strong></div>}
            <div className="cart-page-summary-row"><span>Envío{shipping.region ? '' : ' (elige región)'}</span><strong>{shipping.region ? (shippingCost === null ? 'No disponible' : shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost)) : '—'}</strong></div>
            <div className="cart-page-summary-total"><span>Total</span><strong>{shippingCost === null ? 'Por calcular' : formatPrice(grandTotal)}</strong></div>

            <label className="discount-field cart-page-discount">Código de descuento (opcional)
              <div className="discount-input-row">
                <Input value={discountInput} onChange={(event) => { setDiscountInput(event.target.value); setAppliedDiscount(null); }} placeholder="EJ: BIENVENIDA10" />
                <Button type="button" variant="outline" disabled={discountChecking || !discountInput.trim()} onClick={applyDiscountCode}>{discountChecking ? '...' : 'Aplicar'}</Button>
              </div>
              {appliedDiscount && <small className="discount-applied">✓ Código {appliedDiscount.code} aplicado: -{formatPrice(appliedDiscount.amount)}</small>}
            </label>

            <form className="checkout-form cart-page-form" onSubmit={handleCheckout}>
              <h3 className="cart-page-form-heading">Datos de envío{sessionEmail && savedAddresses.length ? ' (guardados en tu cuenta)' : ''}</h3>
              {savedAddresses.length > 1 && (
                <label>Elegir dirección guardada<NativeSelect className="admin-select" value={selectedAddressId} onChange={(event) => {
                  const chosen = savedAddresses.find((item) => item.id === event.target.value);
                  setSelectedAddressId(event.target.value);
                  if (chosen) setShipping((current) => ({ ...current, name: chosen.full_name, phone: chosen.phone, region: chosen.region, comuna: chosen.comuna, address: chosen.address, addressExtra: chosen.address_extra ?? '' }));
                }}>
                  {savedAddresses.map((item, index) => <NativeSelectOption key={item.id} value={item.id}>Dirección {index + 1} — {item.address}</NativeSelectOption>)}
                </NativeSelect></label>
              )}
              <label>Nombre completo<Input required autoComplete="name" maxLength={120} value={shipping.name} onChange={(event) => setShipping({ ...shipping, name: event.target.value })} /><small className="field-required">Campo obligatorio</small></label>
              <label>Correo electrónico<Input required autoComplete="email" type="email" maxLength={254} value={shipping.email} onChange={(event) => setShipping({ ...shipping, email: event.target.value })} /><small className="field-required">Campo obligatorio</small></label>
              <label>Teléfono<Input required type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={shipping.phone} onChange={(event) => setShipping({ ...shipping, phone: event.target.value })} placeholder="+56 9 ..." /><small className="field-required">Campo obligatorio</small></label>
              {pickupZones.length > 0 && (
                <div className="delivery-method-tabs" role="group" aria-label="Método de entrega">
                  <button type="button" className={deliveryMethod === 'shipping' ? 'active' : ''} onClick={() => chooseDeliveryMethod('shipping')}>Envío a domicilio</button>
                  <button type="button" className={deliveryMethod === 'pickup' ? 'active' : ''} onClick={() => chooseDeliveryMethod('pickup')}>Retiro / entrega personal</button>
                </div>
              )}
              {deliveryMethod === 'shipping' || pickupZones.length === 0 ? (
                <label>Región<NativeSelect required className="admin-select" value={shipping.region} onChange={(event) => setShipping({ ...shipping, region: event.target.value })}>
                  <NativeSelectOption value="">Selecciona tu región</NativeSelectOption>
                  {(pickupZones.length > 0 ? shippingZones : shippingRates).map((rate) => <NativeSelectOption key={rate.region} value={rate.region}>{rate.region}</NativeSelectOption>)}
                </NativeSelect><small className="field-required">Campo obligatorio</small></label>
              ) : pickupZones.length > 1 ? (
                <label>Punto de retiro<NativeSelect required className="admin-select" value={shipping.region} onChange={(event) => setShipping({ ...shipping, region: event.target.value })}>
                  <NativeSelectOption value="">Selecciona una opción</NativeSelectOption>
                  {pickupZones.map((rate) => <NativeSelectOption key={rate.region} value={rate.region}>{rate.region}</NativeSelectOption>)}
                </NativeSelect><small className="field-required">Campo obligatorio</small></label>
              ) : null}
              {deliveryMethod === 'pickup' && pickupZones.length > 0 && (
                <p className="cart-page-pickup-note">Entrega personal: no necesitas comuna ni dirección. Coordinamos el punto de entrega directo contigo (por WhatsApp o el chat del pedido).</p>
              )}
              {selectedRate?.warning && <p className="cart-shipping-warning" role="alert">⚠ {selectedRate.warning}</p>}
              {requiresAddress && (
                <>
                  <label>Comuna / ciudad<Input required maxLength={120} value={shipping.comuna} onChange={(event) => setShipping({ ...shipping, comuna: event.target.value })} /><small className="field-required">Campo obligatorio</small></label>
                  <label>Dirección<Input required autoComplete="address-line1" maxLength={250} value={shipping.address} onChange={(event) => setShipping({ ...shipping, address: event.target.value })} placeholder="Calle, número" /><small className="field-required">Campo obligatorio</small></label>
                  <label>Depto / referencia (opcional)<Input autoComplete="address-line2" maxLength={250} value={shipping.addressExtra} onChange={(event) => setShipping({ ...shipping, addressExtra: event.target.value })} /></label>
                </>
              )}
              {transferAvailable && (
                <div className="cart-page-form" style={{ marginTop: 4, paddingTop: 0, borderTop: 0 }}>
                  <p className="cart-page-form-heading">Método de pago</p>
                  <div className="delivery-method-tabs" role="group" aria-label="Método de pago">
                    <button type="button" className={paymentMethod === 'mercadopago' ? 'active' : ''} onClick={() => setPaymentMethod('mercadopago')}>Tarjeta / Mercado Pago</button>
                    <button type="button" className={paymentMethod === 'transfer' ? 'active' : ''} onClick={() => setPaymentMethod('transfer')}>Transferencia bancaria</button>
                  </div>
                  {paymentMethod === 'transfer' && (
                    <p className="cart-page-pickup-note">Al confirmar te mostramos los datos para transferir. El pedido se reserva y se despacha cuando confirmemos el pago (revisamos las transferencias a diario).</p>
                  )}
                </div>
              )}
              {checkoutError && <p className="account-message">{checkoutError}</p>}
              {!isSupabaseConfigured && <p className="account-message">El pago no está disponible por el momento.</p>}
              <Button disabled={checkoutBusy || !shippingComplete || shippingCost === null || cartProducts.length === 0} type="submit" className="primary-button cart-page-pay">{checkoutBusy ? (paymentMethod === 'transfer' ? 'Creando tu pedido…' : 'Redirigiendo a Mercado Pago…') : paymentMethod === 'transfer' ? 'Confirmar pedido' : 'Ir a pagar'} <ArrowRight size={16} /></Button>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}
