// JSON.stringify no escapa "<", así que un texto con "</script>" (nombre de
// producto, pregunta de FAQ, etc.) podría cortar la etiqueta e inyectar HTML.
// El contenido acá es siempre editado por Admin, pero se escapa igual como
// defensa en profundidad — < es válido dentro de un string JSON e
// inofensivo para el parser de JSON-LD.
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
