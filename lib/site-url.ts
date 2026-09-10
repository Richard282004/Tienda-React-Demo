// URL pública canónica de la tienda. Cambiar aquí al conectar el dominio
// propio (p. ej. https://miuelloop.cl) para que sitemap, robots, canonical y
// datos estructurados apunten al dominio correcto.
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://tienda-react-demo.richardlagos2.workers.dev';
