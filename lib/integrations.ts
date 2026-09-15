import type { getSupabaseAdmin } from './supabase-admin';

// Claves de Mercado Pago y Brevo: primero se busca lo guardado en Admin →
// Integraciones (tabla integration_settings, solo legible con service role),
// y si no hay nada ahí se usa el Secret de Cloudflare de siempre. Así una
// tienda recién configurada por su dueño desde Admin no necesita tocar
// Cloudflare, y las tiendas ya desplegadas con Secrets siguen funcionando
// igual sin cambiar nada.
export type IntegrationSecrets = {
  mpAccessToken?: string;
  brevoApiKey?: string;
  brevoFromEmail?: string;
};

export async function getIntegrationSecrets(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  env: Record<string, string | undefined>,
): Promise<IntegrationSecrets> {
  const { data } = await supabase
    .from('integration_settings')
    .select('mp_access_token, brevo_api_key, brevo_from_email')
    .eq('id', 'default')
    .maybeSingle();
  return {
    mpAccessToken: data?.mp_access_token || env.MP_ACCESS_TOKEN,
    brevoApiKey: data?.brevo_api_key || env.BREVO_API_KEY,
    brevoFromEmail: data?.brevo_from_email || env.BREVO_FROM_EMAIL,
  };
}
