// El carrito se guarda en localStorage como un array de strings, uno por
// unidad (la cantidad es cuántas veces se repite el mismo id). Antes cada
// entrada era solo el id del producto; ahora, si se agregó una variante
// (color/talla), la entrada codifica ambos como "productId::variantId" para
// no romper el formato de los carritos ya guardados en el navegador de
// alguien (los productos sin variante siguen siendo el id plano de siempre).
export type CartEntry = { productId: string; variantId?: string };

export function encodeCartEntry(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

export function decodeCartEntry(entry: string): CartEntry {
  const separatorIndex = entry.indexOf('::');
  if (separatorIndex === -1) return { productId: entry };
  return { productId: entry.slice(0, separatorIndex), variantId: entry.slice(separatorIndex + 2) };
}
