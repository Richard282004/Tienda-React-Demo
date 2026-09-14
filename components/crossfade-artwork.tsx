'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/lib/store-data';
import { ProductArtwork } from './product-artwork';

// Mantener la última foto cargada debajo evita un destello vacío en redes lentas.
export function CrossfadeArtwork({ product, defaultZoom }: { product: Product; defaultZoom: number }) {
  const [base, setBase] = useState({ product, defaultZoom });
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const url = product.image_url ?? '';
  const changing = (base.product.image_url ?? '') !== url;
  const ready = readyUrl === url || !url;

  useEffect(() => {
    if (!changing || !ready) return;
    const timer = window.setTimeout(() => {
      setBase({ product, defaultZoom });
      setReadyUrl(null);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [changing, ready, product, defaultZoom]);

  return <span className="variant-photo-stack" role="img" aria-label={product.name}>
    <span className="variant-photo-layer" aria-hidden="true">
      <ProductArtwork product={changing ? base.product : product} className="product-photo" defaultZoom={changing ? base.defaultZoom : defaultZoom} />
    </span>
    {changing && <span key={url} style={{ backgroundColor: product.color }} className={`variant-photo-layer variant-photo-incoming${ready || !url ? ' is-ready' : ''}`} aria-hidden="true">
      <ProductArtwork product={product} className="product-photo" defaultZoom={defaultZoom} onReady={() => setReadyUrl(url)} />
    </span>}
  </span>;
}
