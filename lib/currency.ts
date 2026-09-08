// Formato de precio centralizado: cada tienda define su moneda/locale desde
// Admin → Configuración regional (StoreContent.currency / .locale), en vez de
// tener "CLP"/"es-CL" repetido y hardcodeado en cada archivo.
export function formatPrice(price: number, currency = 'CLP', locale = 'es-CL'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
  } catch {
    // Código de moneda/locale inválido: no rompas la página, muestra un número plano.
    return `${price} ${currency}`;
  }
}
