'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Product } from '@/lib/store-data';
import type { CatalogVariant } from '@/lib/product-variants';

export type PreviewVariant = CatalogVariant & { id: string; color: string | null; size: string | null; image_url: string | null };

export function CatalogVariantPreview({ product, variants, children }: {
  product: Product;
  variants: PreviewVariant[];
  children: (preview: { artwork: Product; variant: PreviewVariant | undefined; href: string; controls: ReactNode }) => ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const root = useRef<HTMLElement>(null);
  const variant = variants[index % Math.max(1, variants.length)];
  const label = variant ? [variant.color, variant.size].filter(Boolean).join(' · ') || 'Opción estándar' : '';

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    if (root.current) observer.observe(root.current);
    return () => { preference.removeEventListener('change', update); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (variants.length < 2 || paused || hovered || focused || !visible || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % variants.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [variants.length, paused, hovered, focused, visible, reducedMotion]);

  const choose = (next: number) => {
    setPaused(true);
    setIndex(next);
  };
  const artwork = variant ? { ...product, name: `${product.name} · ${label}`, image_url: variant.image_url || product.image_url,
    ...(variant.image_url ? { image_zoom: 1, image_position_x: 50, image_position_y: 50 } : {}) } : product;
  const href = `/producto/${product.id}${variant ? `?variante=${encodeURIComponent(variant.id)}` : ''}`;
  const controls = variant ? <div className="catalog-variant-picker">
    {variants.length > 1 && <div className="catalog-variant-thumbnails" role="group" aria-label={`Variantes de ${product.name}`}>
      {variants.map((option, optionIndex) => {
        const optionLabel = [option.color, option.size].filter(Boolean).join(' · ') || 'Opción estándar';
        return <button key={option.id} type="button" className="catalog-variant-thumbnail"
          aria-label={`Ver ${optionLabel}`} aria-pressed={option.id === variant.id} title={optionLabel}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') choose(optionIndex); }}
          onClick={() => choose(optionIndex)}>
          {option.image_url ? <img src={option.image_url} alt="" loading="lazy" width={48} height={48} /> : <span>{optionLabel}</span>}
        </button>;
      })}
    </div>}
    <div className="catalog-variant-caption"><span>{label}</span>{!variant.image_url && <small>Foto principal de referencia</small>}</div>
    {variants.length > 1 && <div className="catalog-variant-controls">
      <span>{index % variants.length + 1} / {variants.length}</span>
      {!reducedMotion && <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Reanudar cambio automático' : 'Pausar cambio automático'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>}
    </div>}
  </div> : null;

  return <article ref={root} className="product-card" id={`producto-${product.id}`}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {children({ artwork, variant, href, controls })}
  </article>;
}
