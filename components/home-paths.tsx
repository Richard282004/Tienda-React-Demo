'use client';

import { useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ResolvedHomeBlock } from '@/lib/home-content';

// Portada "Dos caminos": dos bloques con foto real, título, texto y botón.
// Los textos van en HTML (no dentro de la foto) para que sean editables,
// accesibles y se adapten a cualquier ancho. El diseño cambia por el ancho del
// contenedor (container queries), así la vista previa del administrador se ve
// igual que la tienda en celular y en computador.
export function HomePaths({ blocks, onSelectCategory, preview }: {
  blocks: ResolvedHomeBlock[];
  onSelectCategory?: (category: string) => void;
  // En la vista previa del administrador se fuerza la foto de celular o de
  // computador y los enlaces no navegan.
  preview?: 'mobile' | 'desktop';
}) {
  const [failed, setFailed] = useState<Record<string, true>>({});
  if (!blocks.length) return null;
  return (
    <div className="home-paths" data-count={blocks.length}>
      <div className="home-paths-grid">
        {blocks.map((block, index) => {
          const desktopSrc = block.image && !failed[block.image] ? block.image : '';
          const mobileSrc = block.mobileImage && !failed[block.mobileImage] ? block.mobileImage : desktopSrc;
          const src = preview === 'mobile' ? mobileSrc : desktopSrc || mobileSrc;
          const style = {
            '--path-x': `${block.framing.x}%`, '--path-y': `${block.framing.y}%`, '--path-zoom': block.framing.zoom,
            '--path-mx': `${block.mobileFraming.x}%`, '--path-my': `${block.mobileFraming.y}%`, '--path-mzoom': block.mobileFraming.zoom,
          } as CSSProperties;
          return (
            <a
              key={block.id}
              className="home-path"
              href={block.href}
              onClick={(event) => {
                if (preview) { event.preventDefault(); return; }
                if (block.category && onSelectCategory) {
                  event.preventDefault();
                  onSelectCategory(block.category);
                }
              }}
            >
              <span className={`home-path-media${src ? '' : ' is-empty'}`} style={style}>
                {src ? (
                  <picture>
                    {!preview && mobileSrc && mobileSrc !== src && <source media="(max-width: 699px)" srcSet={mobileSrc} />}
                    <img
                      src={src}
                      alt={block.imageAlt.trim()}
                      width={800}
                      height={640}
                      decoding="async"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 && !preview ? 'high' : undefined}
                      onError={(event) => {
                        // Solo se descarta la foto que falló: si era la de
                        // celular, se usa la de computador, y si no hay otra,
                        // el bloque queda limpio sin foto (nunca un ícono roto).
                        const url = event.currentTarget.currentSrc === mobileSrc ? mobileSrc : src;
                        setFailed((current) => ({ ...current, [url]: true }));
                      }}
                    />
                  </picture>
                ) : <span className="home-path-mark" aria-hidden="true">✦</span>}
              </span>
              <span className="home-path-body">
                <h2 className="home-path-title">{block.title.trim() || 'Nuestra colección'}</h2>
                {block.description.trim() && <span className="home-path-text">{block.description}</span>}
                <span className="home-path-cta">{block.ctaLabel.trim() || 'Ver más'} <ArrowRight size={16} aria-hidden="true" /></span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
