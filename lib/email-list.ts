// "correo1@x.cl, correo2@y.cl" o uno por línea -> lista limpia de direcciones.
// En archivo propio (sin imports) para poder testearlo con `node --test`.
export function parseEmailList(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}
