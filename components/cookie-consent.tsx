'use client';

import { useEffect, useState } from 'react';

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
// no decidió. Sin analítica activada, no hay nada que pedir. Los IDs los trae
// Analytics (ya los pidió para cargar los scripts), así este componente no
// repite la misma consulta a site_content.
export function CookieConsent({ hasAnalytics }: { hasAnalytics: boolean }) {
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

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-label="Aviso de cookies">
      <p>Usamos análisis (Google Analytics y/o Meta Pixel) para entender las visitas. Solo se activan si aceptas.</p>
      <div className="cookie-consent-actions">
        <button
          type="button"
          className="cookie-reject"
          onClick={() => { setConsent('rejected'); setVisible(false); }}
        >
          Rechazar
        </button>
        <button
          type="button"
          className="cookie-accept"
          onClick={() => { setConsent('accepted'); setVisible(false); }}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
