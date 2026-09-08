"use client";

import { useState } from "react";
import type { Product } from "@/lib/store-data";

export function ProductArtwork({ product, className }: { product: Product; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (product.image_url && failedUrl !== product.image_url) {
    return (
      <img
        className={className}
        src={product.image_url}
        alt={product.name}
        loading="lazy"
        decoding="async"
        style={{
          objectPosition: `${product.image_position_x ?? 50}% ${product.image_position_y ?? 50}%`,
          // El origen del zoom debe coincidir con el punto elegido en los
          // sliders; si no, "acercar" siempre agranda hacia el centro del
          // recuadro en vez de hacia el producto.
          transformOrigin: `${product.image_position_x ?? 50}% ${product.image_position_y ?? 50}%`,
          transform: `scale(${product.image_zoom ?? 1})`,
        }}
        onError={() => setFailedUrl(product.image_url ?? null)}
      />
    );
  }
  return (
    <span
      className={className === "product-photo" ? "product-emoji" : undefined}
      role="img"
      aria-label={product.name}
    >
      {product.art || "🧶"}
    </span>
  );
}
