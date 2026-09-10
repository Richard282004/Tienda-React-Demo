// Respaldo de la base vía la API REST de Supabase (sin pg_dump, sin contraseña
// de la base, sin líos de IPv6/pooler). Exporta cada tabla a un JSON.
// Necesita: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const TABLES = [
  'profiles', 'products', 'product_images', 'site_content', 'shipping_rates',
  'orders', 'order_messages', 'discount_codes', 'reviews', 'showcase_items',
  'faqs', 'addresses',
];

const PAGE = 1000;
const outDir = `backup/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`;
await mkdir(outDir, { recursive: true });

let totalRows = 0;
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + PAGE - 1}`,
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) {
      console.error(`  ${table}: HTTP ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  await writeFile(`${outDir}/${table}.json`, JSON.stringify(rows, null, 2));
  totalRows += rows.length;
  console.log(`  ${table}: ${rows.length} filas`);
}

console.log(`Respaldo en ${outDir} — ${totalRows} filas en total`);
