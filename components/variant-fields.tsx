'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { variantValidation, type VariantValues } from '@/lib/product-variants';

export function VariantFields({ initial, onSave, creating = false }: { initial: VariantValues; onSave: (values: VariantValues) => Promise<boolean>; creating?: boolean }) {
  const [color, setColor] = useState(initial.color ?? '');
  const [size, setSize] = useState(initial.size ?? '');
  const [price, setPrice] = useState(String(initial.price));
  const [stock, setStock] = useState(String(initial.stock ?? 0));
  const [unlimited, setUnlimited] = useState(initial.stock === null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const save = async () => {
    if (busy) return;
    const values = { color: color.trim() || null, size: size.trim() || null, price: price.trim() ? Number(price) : NaN, stock: unlimited ? null : stock.trim() ? Number(stock) : NaN };
    const error = variantValidation(values);
    if (error) { setFeedback(error); return; }
    setBusy(true);
    setFeedback('');
    try {
      if (await onSave(values)) {
        setFeedback(creating ? 'Opción creada.' : 'Cambios guardados.');
        if (creating) { setColor(''); setSize(''); setStock('0'); setUnlimited(false); }
      } else setFeedback('No se guardó. Revisa el mensaje del producto y vuelve a intentar.');
    } catch { setFeedback('No pudimos guardar. Revisa tu conexión e inténtalo otra vez.'); }
    finally { setBusy(false); }
  };
  return <fieldset className="variant-fields" disabled={busy} onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); void save(); } }}>
    <legend>{creating ? 'Nueva opción' : [initial.color, initial.size].filter(Boolean).join(' · ') || 'Opción sin nombre'}</legend>
    <div className="variant-fields-grid">
      <label>Color <Input value={color} placeholder="Ej: Rosa" onChange={(event) => setColor(event.target.value)} /></label>
      <label>Tamaño <Input value={size} placeholder="Ej: Pequeño o 15 cm" onChange={(event) => setSize(event.target.value)} /></label>
      <label>Precio de esta opción <Input type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <label>Unidades disponibles <Input type="number" min="0" step="1" disabled={unlimited} value={unlimited ? '' : stock} placeholder={unlimited ? 'Sin límite' : '0'} onChange={(event) => setStock(event.target.value)} /></label>
    </div>
    <label className="variant-unlimited"><input type="checkbox" checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} /> No limitar unidades</label>
    <Button type="button" variant="outline" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : creating ? 'Crear opción' : 'Guardar esta opción'}</Button>
    {feedback && <p className="variant-feedback" role="status">{feedback}</p>}
  </fieldset>;
}
