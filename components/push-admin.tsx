'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type Status = 'checking' | 'unsupported' | 'off' | 'on' | 'denied' | 'busy';

// Botón para activar/desactivar los avisos push de "venta nueva" en este
// navegador/dispositivo. Debe ser un clic explícito: iOS Safari solo deja
// pedir permiso de notificaciones como respuesta directa a un gesto de la
// usuaria, no se puede pedir solo al cargar la página.
export function PushAdmin() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const check = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setStatus('unsupported'); return; }
      if (Notification.permission === 'denied') { setStatus('denied'); return; }
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        setStatus(existing ? 'on' : 'off');
      } catch {
        setStatus('off');
      }
    };
    void check();
  }, []);

  const activate = async () => {
    if (!supabase) return;
    setStatus('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus(permission === 'denied' ? 'denied' : 'off'); return; }
      const keyRes = await fetch('/api/push/vapid-public-key');
      if (!keyRes.ok) { setStatus('off'); return; }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setStatus('off'); return; }
      const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setStatus('on');
    } catch {
      setStatus('off');
    }
  };

  const deactivate = async () => {
    if (!supabase) return;
    setStatus('busy');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ endpoint }),
          });
        }
      }
      setStatus('off');
    } catch {
      setStatus('on');
    }
  };

  if (status === 'unsupported') return null;
  if (status === 'denied') {
    return <span className="push-admin-hint">Notificaciones bloqueadas: actívalas desde los ajustes de este navegador.</span>;
  }
  if (status === 'on') {
    return <Button variant="outline" onClick={() => void deactivate()}><BellOff size={16} /> Avisos activados</Button>;
  }
  return (
    <Button variant="outline" disabled={status === 'busy' || status === 'checking'} onClick={() => void activate()}>
      <Bell size={16} /> Avisarme ventas nuevas
    </Button>
  );
}
