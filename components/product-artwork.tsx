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
