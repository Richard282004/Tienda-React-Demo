/// <reference types="vite/client" />

declare namespace Cloudflare {
  interface Env {
    VITE_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    MP_ACCESS_TOKEN?: string;
    BREVO_API_KEY?: string;
    BREVO_FROM_EMAIL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    CRON_SECRET?: string;
    PUSH_VAPID_PUBLIC_KEY?: string;
    PUSH_VAPID_PRIVATE_KEY_JWK?: string;
    PUSH_VAPID_SUBJECT?: string;
    ENVIA_API_TOKEN?: string;
  }
}
