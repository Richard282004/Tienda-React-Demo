'use client';

import { useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ResolvedHomeBanner } from '@/lib/home-content';

// Banner principal B1 · "Una colección". Texto y botón a la izquierda, foto
// protagonista a la derecha (arriba en celular). La transición hacia el fondo
// crema es una capa de degradado aparte (.home-banner-fade), así se conserva
// al cambiar la foto desde el administrador y el producto nunca se desenfoca.
// Usa container queries: la vista previa del administrador se ve igual.
export function HomeBanner({ banner, onSelectCategory, preview }: {
  banner: ResolvedHomeBanner;
  onSelectCategory?: (category: string) => void;
  preview?: 'mobile' | 'desktop';
}) {
  const [failed, setFailed] = useState<Record<string, true>>({});
  const desktopSrc = banner.image && !failed[banner.image] ? banner.image : '';
  const mobileSrc = banner.mobileImage && !failed[banner.mobileImage] ? banner.mobileImage : desktopSrc;
  const src = preview === 'mobile' ? mobileSrc : desktopSrc || mobileSrc;
  const style = {
    '--path-x': `${banner.framing.x}%`, '--path-y': `${banner.framing.y}%`, '--path-zoom': banner.framing.zoom,
    '--path-mx': `${banner.mobileFraming.x}%`, '--path-my': `${banner.mobileFraming.y}%`, '--path-mzoom': banner.mobileFraming.zoom,
    '--fade-strength': banner.fadeStrength / 100,
    '--fade-size': `${banner.fadeSize}%`,
  } as CSSProperties;
  return (
    <div className="home-banner-wrap">
      <div className={`home-banner${src ? '' : ' is-empty'}`} style={style}>
        <div className="home-banner-media">
          {src ? (
            <picture>
              {!preview && mobileSrc && mobileSrc !== src && <source media="(max-width: 699px)" srcSet={mobileSrc} />}
              <img
                src={src}
                alt={banner.imageAlt.trim()}
                width={800}
                height={800}
                decoding="async"
                fetchPriority={preview ? undefined : 'high'}
                onError={(event) => {
                  const url = event.currentTarget.currentSrc === mobileSrc ? mobileSrc : src;
                  setFailed((current) => ({ ...current, [url]: true }));
                }}
              />
            </picture>
          ) : <span className="home-path-mark" aria-hidden="true">✦</span>}
          <span className="home-banner-fade" aria-hidden="true" />
        </div>
        <div className="home-banner-body">
          <h2 className="home-banner-title">{banner.title.trim() || 'Nuestra colección'}</h2>
          {banner.description.trim() && <p className="home-banner-text">{banner.description}</p>}
          <a
            className="home-banner-cta"
            href={banner.href}
            onClick={(event) => {
              if (preview) { event.preventDefault(); return; }
              if (banner.category && onSelectCategory) {
                event.preventDefault();
                onSelectCategory(banner.category);
              }
            }}
          >
            {banner.ctaLabel.trim() || 'Ver más'} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
