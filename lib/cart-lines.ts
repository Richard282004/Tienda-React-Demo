import { decodeCartEntry } from './cart.ts';

type Product = { id: string; active?: boolean; stock?: number | null };
type Variant = { id: string; product_id: string; active: boolean; stock: number | null };
export function resolveCartLines<P extends Product, V extends Variant>(cart: string[], products: P[], variants: V[]) {
  const counts = new Map<string, number>();
  cart.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  return [...counts].map(([key, quantity]) => {
    const { productId, variantId } = decodeCartEntry(key);
    const product = products.find((item) => item.id === productId);
    const variant = variantId ? variants.find((item) => item.id === variantId && item.product_id === productId) : undefined;
    const requiresVariant = variants.some((item) => item.product_id === productId && item.active);
    const stock = variant ? variant.stock : product?.stock;
    const error = !product || product.active === false ? 'Este producto ya no está disponible.'
      : variantId && (!variant || !variant.active) ? 'Esta opción ya no está disponible. Elimínala y elige otra.'
      : !variantId && requiresVariant ? 'Este producto ahora tiene opciones. Elimínalo y elige una.'
      : stock != null && quantity > stock ? `Solo quedan ${stock} unidades. Ajusta la cantidad.`
      : quantity > 99 ? 'Puedes comprar hasta 99 unidades de esta opción.' : null;
    return { key, quantity, product, variant, error };
  });
}

export function removePurchasedEntries(cart: string[], purchased: string[]) {
  const remaining = [...cart];
  for (const entry of purchased) {
    const index = remaining.indexOf(entry);
    if (index !== -1) remaining.splice(index, 1);
  }
  return remaining;
}
