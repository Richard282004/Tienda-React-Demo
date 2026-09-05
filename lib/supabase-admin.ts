import { createClient } from '@supabase/supabase-js';

// Cliente de servidor con la service role key: ignora RLS. Nunca importar
// este archivo desde código de cliente ('use client'); solo desde Route
// Handlers / Server Components que corren en el worker.
export function getSupabaseAdmin(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
