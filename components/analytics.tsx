'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Carga Google Analytics y/o Meta Pixel solo si la administradora configuró
// los IDs en Admin → Textos y contacto → Analítica. Sin IDs, no se inyecta
// ningún script de terceros.
export function Analytics() {
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase
      .from('site_content')
      .select('value')
      .eq('key', 'store')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const value = data?.value as { gaId?: string; metaPixelId?: string } | undefined;
        if (value?.gaId) loadGoogleAnalytics(value.gaId);
        if (value?.metaPixelId) loadMetaPixel(value.metaPixelId);
      });
    return () => { cancelled = true; };
  }, []);

  return null;
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
