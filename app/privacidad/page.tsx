'use client';

import { useEffect, useState } from 'react';
import { fillLegalPlaceholders, parseLegalBlocks } from '@/lib/legal-content';
import { defaultStoreContent, fetchStoreContent, type StoreContent } from '@/lib/store-data';
import { supabase } from '@/lib/supabase';
import './privacidad.css';

export default function PrivacidadPage() {
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);

  useEffect(() => {
    let active = true;
    void fetchStoreContent(supabase).then((settings) => { if (active && settings) setContent(settings); });
    return () => { active = false; };
  }, []);

  const text = fillLegalPlaceholders(content.privacyContent || defaultStoreContent.privacyContent || '', content);
  const blocks = parseLegalBlocks(text);

  return (
    <main className="legal-shell">
      <article className="legal-card">
        <a className="legal-back" href="/">← Volver a la tienda</a>
        <h1>Política de privacidad</h1>
        <p className="legal-updated">Última actualización: {new Date().toLocaleDateString('es-CL')}</p>
        {blocks.map((block, index) =>
          block.type === 'h2' ? (
            <h2 key={index}>{block.text}</h2>
          ) : block.type === 'ul' ? (
            <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
          ) : (
            <p key={index}>{block.text}</p>
          ),
        )}
      </article>
    </main>
  );
}
