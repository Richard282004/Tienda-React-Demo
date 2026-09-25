'use client';

import { useEffect, useRef, useState } from 'react';
import { defaultStoreContent } from '@/lib/store-data';

export const CONSENT_KEY = 'cookie-consent';
export const CONSENT_EVENT = 'cookie-consent-changed';
// Posición del aviso mientras está abierto (o null al cerrarse), para que los
// botones flotantes se aparten en vez de quedar tapados.
export const CONSENT_LAYOUT_EVENT = 'cookie-consent-layout';
export type ConsentLayout = { top: number; bottom: number; left: number; right: number } | null;
let currentLayout: ConsentLayout = null;
// Para botones que se montan después de que el aviso ya se mostró.
export const getConsentLayout = () => currentLayout;
const announce = (layout: ConsentLayout) => {
  currentLayout = layout;
  window.dispatchEvent(new CustomEvent<ConsentLayout>(CONSENT_LAYOUT_EVENT, { detail: layout }));
};

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
  const card = useRef<HTMLDivElement>(null);

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

  // Mientras el aviso está abierto, publica su posición: el botón de WhatsApp
  // (que se puede arrastrar) y la bolsita flotante se corren hacia arriba.
  useEffect(() => {
    const element = card.current;
    if (!visible || !element) return;
    const root = document.documentElement;
    root.dataset.cookieConsent = 'open';
    // offset* ignora la animación de entrada (transform), así se usa la
    // posición final del aviso y no la de su primer cuadro.
    const publish = () => {
      const top = element.offsetTop;
      root.style.setProperty('--cookie-consent-clear', `${Math.max(0, window.innerHeight - top)}px`);
      announce({ top, bottom: top + element.offsetHeight, left: element.offsetLeft, right: element.offsetLeft + element.offsetWidth });
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    window.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      delete root.dataset.cookieConsent;
      root.style.removeProperty('--cookie-consent-clear');
      announce(null);
    };
  }, [visible]);

  if (!visible) return null;

  const decide = (value: 'accepted' | 'rejected') => { setConsent(value); setVisible(false); };

  return (
    <div ref={card} className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
      <h2 id="cookie-consent-title">{title?.trim() || defaultStoreContent.cookieTitle}</h2>
      <p id="cookie-consent-description">{text?.trim() || defaultStoreContent.cookieText} <a href="/privacidad">Más información</a></p>
      <div className="cookie-consent-actions">
        <button type="button" className="cookie-accept" onClick={() => decide('accepted')}>Aceptar</button>
        <button type="button" className="cookie-reject" onClick={() => decide('rejected')}>Rechazar</button>
      </div>
    </div>
  );
}
