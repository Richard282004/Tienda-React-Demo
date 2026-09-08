'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ProductArtwork } from '@/components/product-artwork';
import { calculateShipping } from '@/lib/checkout-validation';
import { CHILE_REGIONS, COMUNAS_BY_REGION, type ShippingRate } from '@/lib/orders';
import { type Product } from '@/lib/store-data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import './carrito.css';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

type Shipping = { name: string; email: string; phone: string; region: string; comuna: string; address: string; addressExtra: string };
const emptyShipping: Shipping = { name: '', email: '', phone: '', region: '', comuna: '', address: '', addressExtra: '' };

export default function CarritoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [shipping, setShipping] = useState<Shipping>(emptyShipping);
  const [hasSavedAddress, setHasSavedAddress] = useState(false);
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
      const [{ data: productRows }, { data: rateRows }] = await Promise.all([
        client.from('products').select('id, name, price, color, art, image_url, stock, active').order('sort_order'),
        client.from('shipping_rates').select('region, cost'),
      ]);
      setProducts((productRows ?? []) as Product[]);
      setShippingRates((rateRows ?? []) as ShippingRate[]);
      const { data: userData } = await client.auth.getUser();
      const user = userData.user;
      if (user) {
        setSessionEmail(user.email ?? null);
        const { data: profile } = await client.from('profiles').select('full_name, phone, region, comuna, address, address_extra').eq('id', user.id).maybeSingle();
        if (profile && (profile.address || profile.region)) {
          setHasSavedAddress(true);
          setShipping({
            name: profile.full_name ?? '',
            email: user.email ?? '',
            phone: profile.phone ?? '',
            region: profile.region ?? '',
            comuna: profile.comuna ?? '',
            address: profile.address ?? '',
            addressExtra: profile.address_extra ?? '',
          });
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
  const shippingCost = calculateShipping(total, shippingRates.find((rate) => rate.region === shipping.region)?.cost);
  const shippingComplete = Boolean(
    shipping.name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email.trim()) &&
    shipping.phone.trim() &&
    shipping.region &&
    shipping.comuna.trim() &&
    shipping.address.trim(),
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
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        }),
      });
      const data = (await response.json()) as { initPoint?: string; error?: string };
      if (!response.ok || !data.initPoint) { setCheckoutError(data.error ?? 'No se pudo iniciar el pago.'); return; }
      if (supabase) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          try {
            await supabase.rpc('update_own_profile', {
              p_full_name: shipping.name, p_phone: shipping.phone, p_region: shipping.region,
              p_comuna: shipping.comuna, p_address: shipping.address, p_address_extra: shipping.addressExtra,
            });
          } catch { /* Guardar la dirección es un complemento; el pedido ya se creó igual. */ }
        }
      }
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
              <h3 className="cart-page-form-heading">Datos de envío{sessionEmail && hasSavedAddress ? ' (guardados en tu cuenta)' : ''}</h3>
              <label>Nombre completo<Input required autoComplete="name" maxLength={120} value={shipping.name} onChange={(event) => setShipping({ ...shipping, name: event.target.value })} /><small className="field-required">Campo obligatorio</small></label>
              <label>Correo electrónico<Input required autoComplete="email" type="email" maxLength={254} value={shipping.email} onChange={(event) => setShipping({ ...shipping, email: event.target.value })} /><small className="field-required">Campo obligatorio</small></label>
              <label>Teléfono<Input required type="tel" autoComplete="tel" maxLength={40} value={shipping.phone} onChange={(event) => setShipping({ ...shipping, phone: event.target.value })} placeholder="+56 9 ..." /><small className="field-required">Campo obligatorio</small></label>
              <label>Región<NativeSelect required className="admin-select" value={shipping.region} onChange={(event) => setShipping({ ...shipping, region: event.target.value, comuna: '' })}>
                <NativeSelectOption value="">Selecciona tu región</NativeSelectOption>
                {CHILE_REGIONS.map((region) => <NativeSelectOption key={region} value={region}>{region}</NativeSelectOption>)}
              </NativeSelect><small className="field-required">Campo obligatorio</small></label>
              <label>Comuna{shipping.region && COMUNAS_BY_REGION[shipping.region] ? <NativeSelect required className="admin-select" value={shipping.comuna} onChange={(event) => setShipping({ ...shipping, comuna: event.target.value })}>
                <NativeSelectOption value="">Selecciona tu comuna</NativeSelectOption>
                {COMUNAS_BY_REGION[shipping.region].map((comuna) => <NativeSelectOption key={comuna} value={comuna}>{comuna}</NativeSelectOption>)}
              </NativeSelect> : <Input required maxLength={120} value={shipping.comuna} placeholder="Elige primero tu región" disabled={!shipping.region} onChange={(event) => setShipping({ ...shipping, comuna: event.target.value })} />}<small className="field-required">Campo obligatorio</small></label>
              <label>Dirección<Input required autoComplete="address-line1" maxLength={250} value={shipping.address} onChange={(event) => setShipping({ ...shipping, address: event.target.value })} placeholder="Calle, número" /><small className="field-required">Campo obligatorio</small></label>
              <label>Depto / referencia (opcional)<Input autoComplete="address-line2" maxLength={250} value={shipping.addressExtra} onChange={(event) => setShipping({ ...shipping, addressExtra: event.target.value })} /></label>
              {checkoutError && <p className="account-message">{checkoutError}</p>}
              {!isSupabaseConfigured && <p className="account-message">El pago no está disponible por el momento.</p>}
              <Button disabled={checkoutBusy || !shippingComplete || shippingCost === null || cartProducts.length === 0} type="submit" className="primary-button cart-page-pay">{checkoutBusy ? 'Redirigiendo a Mercado Pago…' : 'Ir a pagar'} <ArrowRight size={16} /></Button>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}
