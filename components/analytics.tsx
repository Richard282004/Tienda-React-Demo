'use client';

import { useEffect, useState } from 'react';
import { CONSENT_EVENT, CONSENT_KEY, CookieConsent } from '@/components/cookie-consent';
import { fetchStoreContent } from '@/lib/store-data';
import { supabase } from '@/lib/supabase';

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

// Carga Google Analytics y/o Meta Pixel solo si la administradora configuró
// los IDs en Admin → Textos y contacto → Analítica, Y la visitante aceptó el
// aviso de cookies (components/cookie-consent.tsx). Sin IDs o sin
// consentimiento, no se inyecta ningún script de terceros.
export function Analytics() {
  const [hasAnalytics, setHasAnalytics] = useState(false);
  const [consentCopy, setConsentCopy] = useState<{ title?: string; text?: string }>({});

  useEffect(() => {
    let cancelled = false;
    let ids: { gaId?: string; metaPixelId?: string } = {};
    const tryLoad = () => {
      if (!hasConsent()) return;
      if (ids.gaId) loadGoogleAnalytics(ids.gaId);
      if (ids.metaPixelId) loadMetaPixel(ids.metaPixelId);
    };
    void fetchStoreContent(supabase).then((settings) => {
      if (cancelled) return;
      ids = settings ?? {};
      setHasAnalytics(Boolean(ids.gaId || ids.metaPixelId));
      setConsentCopy({ title: settings?.cookieTitle, text: settings?.cookieText });
      applyFavicon(settings?.faviconUrl);
      tryLoad();
    });
    const onConsentChange = () => tryLoad();
    window.addEventListener(CONSENT_EVENT, onConsentChange);
    return () => { cancelled = true; window.removeEventListener(CONSENT_EVENT, onConsentChange); };
  }, []);

  return <CookieConsent hasAnalytics={hasAnalytics} title={consentCopy.title} text={consentCopy.text} />;
}

// El ícono de la pestaña se define en el <head> del servidor, pero si la
// tienda ya está cargada (o el navegador cacheó el anterior) se reemplaza aquí.
function applyFavicon(url?: string) {
  if (!url) return;
  const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (existing?.href === url) return;
  const link = existing ?? document.createElement('link');
  link.rel = 'icon';
  link.href = url;
  if (!existing) document.head.appendChild(link);
}

function loadGoogleAnalytics(id: string) {
  if (document.getElementById('ga-script')) return;
  const script = document.createElement('script');
  script.id = 'ga-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  const w = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) { w.dataLayer!.push(args); };
  w.gtag('js', new Date());
  w.gtag('config', id);
}

type Fbq = { (...args: unknown[]): void; queue: unknown[][]; loaded: boolean; version: string };

function loadMetaPixel(id: string) {
  if (document.getElementById('meta-pixel-script')) return;
  const w = window as typeof window & { fbq?: Fbq; _fbq?: Fbq };
  if (!w.fbq) {
    const queue: unknown[][] = [];
    const fbq = ((...args: unknown[]) => { queue.push(args); }) as Fbq;
    fbq.queue = queue;
    fbq.loaded = true;
    fbq.version = '2.0';
    w.fbq = fbq;
    w._fbq = fbq;
  }
  const script = document.createElement('script');
  script.id = 'meta-pixel-script';
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
  w.fbq!('init', id);
  w.fbq!('track', 'PageView');
}
