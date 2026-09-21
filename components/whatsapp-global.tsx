'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WhatsappFab } from '@/components/whatsapp-fab';
import { fetchStoreContent } from '@/lib/store-data';
import { supabase } from '@/lib/supabase';

// Antes solo aparecía en la home. Se monta acá para que se vea en toda la
// tienda (carrito, producto, favoritos, etc.), menos en /admin.
export function WhatsappGlobal() {
  const pathname = usePathname();
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchStoreContent(supabase).then((settings) => {
      if (active) setNumber(settings?.whatsapp || null);
    });
    return () => { active = false; };
  }, []);

  if (!number || pathname?.startsWith('/admin')) return null;
  return <WhatsappFab number={number} pathname={pathname ?? undefined} />;
}
