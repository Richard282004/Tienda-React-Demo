'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

type Status = { mercadopagoConfigured: boolean; brevoApiKeyConfigured: boolean; brevoFromEmail: string };

// Pantalla para pegar las claves propias de quien compra o hereda la tienda
// (Mercado Pago, Brevo) sin tener que tocar Cloudflare. Los valores guardados
// nunca se vuelven a mostrar (se piden de nuevo si se quieren cambiar);
// solo se indica si ya hay algo configurado.
export function IntegrationsAdmin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [brevoFromEmail, setBrevoFromEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const response = await fetch('/api/admin/integrations', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const result = (await response.json()) as Status;
    setStatus(result);
    setBrevoFromEmail(result.brevoFromEmail);
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sesión vencida, vuelve a entrar.');
      const response = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mpAccessToken, brevoApiKey, brevoFromEmail }),
      });
      if (!response.ok) throw new Error('No se pudo guardar.');
      setMpAccessToken('');
      setBrevoApiKey('');
      setMessage('Guardado.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="admin-collapse">
      <summary>Integraciones (Mercado Pago, Brevo)</summary>
      <p className="admin-section-note">
        Pega aquí tus propias claves si estás configurando esta tienda por primera vez (por ejemplo, tras comprarla).
        No hace falta tocar Cloudflare. Un campo vacío no cambia lo ya guardado.
      </p>
      <div className="form-grid">
        <label>
          Access token de Mercado Pago
          <Input type="password" value={mpAccessToken} onChange={(event) => setMpAccessToken(event.target.value)} placeholder={status?.mercadopagoConfigured ? 'Ya configurado — deja vacío para no cambiarlo' : 'APP_USR-...'} />
          <small className="password-hint">Mercado Pago → Tu negocio → Configuración → Credenciales → Credenciales de producción.</small>
        </label>
        <label>
          API key de Brevo
          <Input type="password" value={brevoApiKey} onChange={(event) => setBrevoApiKey(event.target.value)} placeholder={status?.brevoApiKeyConfigured ? 'Ya configurada — deja vacío para no cambiarla' : 'xkeysib-...'} />
          <small className="password-hint">Brevo → tu perfil → SMTP y API → Claves API.</small>
        </label>
        <label>
          Correo remitente de Brevo
          <Input type="email" value={brevoFromEmail} onChange={(event) => setBrevoFromEmail(event.target.value)} placeholder="Mi Tienda <correo@verificado.com>" />
          <small className="password-hint">Debe estar verificado en Brevo → Remitentes, si no los correos se rechazan.</small>
        </label>
      </div>
      <Button variant="outline" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar integraciones'}</Button>
      {message && <p className="admin-section-note" role="status">{message}</p>}
    </details>
  );
}
