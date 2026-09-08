/// <reference types="vite/client" />

declare namespace Cloudflare {
  interface Env {
    VITE_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    MP_ACCESS_TOKEN?: string;
  }
}
