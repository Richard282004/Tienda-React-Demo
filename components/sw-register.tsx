'use client';

import { useEffect } from 'react';

// Registra el service worker (public/sw.js) apenas carga cualquier página.
// Hace falta que esté activo ANTES de suscribirse a push, y para que
// Safari en iOS considere el sitio "instalable" como PWA.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
