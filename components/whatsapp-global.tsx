'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WhatsappFab } from '@/components/whatsapp-fab';
import { supabase } from '@/lib/supabase';

// Antes solo aparecía en la home. Se monta acá para que se vea en toda la
// tienda (carrito, producto, favoritos, etc.), menos en /admin.
export function WhatsappGlobal() {
  const pathname = usePathname();
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from('site_content').select('value').eq('key', 'store').maybeSingle().then(({ data }) => {
      if (!active) return;
      const value = data?.value as { whatsapp?: string } | undefined;
      setNumber(value?.whatsapp || null);
    });
    return () => { active = false; };
  }, []);

  if (!number || pathname?.startsWith('/admin')) return null;
  return <WhatsappFab number={number} />;
}
