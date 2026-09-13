'use client';

import { useEffect, useState } from 'react';
import { fillLegalPlaceholders, parseLegalBlocks } from '@/lib/legal-content';
import { defaultStoreContent, type StoreContent } from '@/lib/store-data';
import { supabase } from '@/lib/supabase';
import './privacidad.css';

export default function PrivacidadPage() {
  const [content, setContent] = useState<StoreContent>(defaultStoreContent);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from('site_content').select('value').eq('key', 'store').maybeSingle().then(({ data }) => {
      if (active && data?.value) setContent({ ...defaultStoreContent, ...(data.value as Partial<StoreContent>) });
    });
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
