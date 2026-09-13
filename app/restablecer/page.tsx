'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { readCachedStoreContent } from '@/lib/store-data';
import './restablecer.css';

const passwordRules = [
  { test: (value: string) => value.length >= 8, label: 'mínimo 8 caracteres' },
  { test: (value: string) => /[A-Z]/.test(value), label: 'una mayúscula' },
  { test: (value: string) => /[0-9]/.test(value), label: 'un número' },
  { test: (value: string) => /[^A-Za-z0-9]/.test(value), label: 'un símbolo' },
];

export default function RestablecerPage() {
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  useLayoutEffect(() => { setLogoUrl(readCachedStoreContent().logoUrl); }, []);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    // El cliente de Supabase (detectSessionInUrl) canjea el token del enlace
    // por una sesión de recuperación al cargar. Puede tardar un tick.
    const check = async () => {
      const { data } = await supabase!.auth.getSession();
      setHasSession(Boolean(data.session));
      setReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setHasSession(true);
      setReady(true);
    });
    void check();
    return () => sub.subscription.unsubscribe();
  }, []);

  const issues = passwordRules.filter((rule) => !rule.test(password)).map((rule) => rule.label);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    if (issues.length) { setMessage(`La contraseña necesita: ${issues.join(', ')}.`); return; }
    if (password !== confirm) { setMessage('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage('No pudimos guardar la contraseña. El enlace pudo haber expirado; pide otro desde la tienda.'); return; }
    setDone(true);
    window.setTimeout(() => { window.location.href = '/'; }, 2500);
  };

  return (
    <main className="reset-shell">
      <div className="reset-card">
        {logoUrl ? <img className="reset-logo" src={logoUrl} alt="" /> : <span className="reset-mark">✦</span>}
        {!ready ? (
          <p className="reset-note">Verificando el enlace…</p>
        ) : done ? (
          <>
            <h1>Contraseña actualizada</h1>
            <p className="reset-note">Ya puedes usar tu contraseña nueva. Te llevamos a la tienda…</p>
          </>
        ) : !supabase ? (
          <>
            <h1>No disponible</h1>
            <p className="reset-note">El acceso a cuentas no está disponible por el momento.</p>
            <a className="reset-back" href="/">Volver a la tienda</a>
          </>
        ) : !hasSession ? (
          <>
            <h1>Enlace no válido</h1>
            <p className="reset-note">Este enlace expiró o ya se usó. Pide uno nuevo desde “¿Olvidaste tu contraseña?” en la tienda.</p>
            <a className="reset-back" href="/">Volver a la tienda</a>
          </>
        ) : (
          <>
            <h1>Crea una contraseña nueva</h1>
            <form className="reset-form" onSubmit={submit}>
              <label>Nueva contraseña
                <div className="reset-input"><LockKeyhole size={17} /><Input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" /></div>
                <small className="reset-hint">{password ? (issues.length ? `Falta: ${issues.join(', ')}.` : '✓ Contraseña segura') : 'Mínimo 8 caracteres, una mayúscula, un número y un símbolo.'}</small>
              </label>
              <label>Repite la contraseña
                <div className="reset-input"><LockKeyhole size={17} /><Input required type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="••••••••" autoComplete="new-password" /></div>
              </label>
              {message && <p className="reset-message">{message}</p>}
              <Button type="submit" className="primary-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'} <ArrowRight size={16} /></Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
