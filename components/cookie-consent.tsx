'use client';

import { useEffect, useState } from 'react';
import { defaultStoreContent } from '@/lib/store-data';

export const CONSENT_KEY = 'cookie-consent';
export const CONSENT_EVENT = 'cookie-consent-changed';

function setConsent(value: 'accepted' | 'rejected') {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* almacenamiento no disponible: el aviso simplemente no se recordará */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

// Solo se muestra si la tienda tiene Google Analytics y/o Meta Pixel
// configurados (Admin → Textos y contacto → Analítica) y la visitante todavía
// no decidió. Sin analítica activada, no hay nada que pedir. Los IDs y los
// textos (Admin → Página principal → Aviso de cookies) los trae Analytics, así
// este componente no repite la misma consulta a site_content.
export function CookieConsent({ hasAnalytics, title, text }: { hasAnalytics: boolean; title?: string; text?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasAnalytics) return;
    let decided: string | null = null;
    try {
      decided = localStorage.getItem(CONSENT_KEY);
    } catch {
      /* sin acceso a almacenamiento: mostramos el aviso igual */
    }
    if (!decided) setVisible(true);
  }, [hasAnalytics]);

  // Mientras el aviso está abierto, los botones flotantes (WhatsApp, bolsita)
  // se ocultan en celular para que no queden tapados ni tapen los botones.
  useEffect(() => {
    if (!visible) return;
    document.documentElement.dataset.cookieConsent = 'open';
    return () => { delete document.documentElement.dataset.cookieConsent; };
  }, [visible]);

  if (!visible) return null;

  const decide = (value: 'accepted' | 'rejected') => { setConsent(value); setVisible(false); };

  return (
    <div className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
      <h2 id="cookie-consent-title">{title?.trim() || defaultStoreContent.cookieTitle}</h2>
      <p id="cookie-consent-description">{text?.trim() || defaultStoreContent.cookieText} <a href="/privacidad">Más información</a></p>
      <div className="cookie-consent-actions">
        <button type="button" className="cookie-accept" onClick={() => decide('accepted')}>Aceptar</button>
        <button type="button" className="cookie-reject" onClick={() => decide('rejected')}>Rechazar</button>
      </div>
    </div>
  );
}
