export type VariantValues = { color: string | null; size: string | null; price: number; stock: number | null };
const optionKey = (value: string | null) => (value ?? '').trim().toLocaleLowerCase('es');
export function sameVariantOptions(a: Pick<VariantValues, 'color' | 'size'>, b: Pick<VariantValues, 'color' | 'size'>) {
  return optionKey(a.color) === optionKey(b.color) && optionKey(a.size) === optionKey(b.size);
}
export function variantValidation(values: VariantValues): string | null {
  if (!values.color?.trim() && !values.size?.trim()) return 'Escribe un color o un tamaño para identificar esta opción.';
  if (!Number.isFinite(values.price) || values.price < 0) return 'Ingresa un precio válido, igual o mayor que cero.';
  if (values.stock !== null && (!Number.isInteger(values.stock) || values.stock < 0)) return 'El stock debe ser una cantidad entera, igual o mayor que cero.';
  return null;
}
export function variantForColor<T extends VariantValues>(variants: T[], color: string | null, size: string | null): T | undefined {
  const matches = variants.filter((variant) => (variant.color || null) === color);
  const available = (variant: T) => variant.stock === null || variant.stock > 0;
  return matches.find((variant) => (variant.size || null) === size && available(variant))
    ?? matches.find(available)
    ?? matches.find((variant) => (variant.size || null) === size)
    ?? matches[0];
}
