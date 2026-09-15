-- Integraciones editables desde Admin (2026-09-14): Mercado Pago y Brevo sin
-- tocar Cloudflare. Fila única ('default'). RLS habilitado sin políticas para
-- anon/authenticated: nadie puede leer ni escribir esta tabla salvo con la
-- service role (rutas de servidor), que ignora RLS por diseño de Supabase.
begin;
create table if not exists public.integration_settings (
  id text primary key default 'default',
  mp_access_token text,
  brevo_api_key text,
  brevo_from_email text,
  updated_at timestamptz not null default now()
);
alter table public.integration_settings enable row level security;
revoke all on public.integration_settings from anon, authenticated;
commit;
