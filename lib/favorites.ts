import type { supabase as supabaseClient } from './supabase';

type Client = typeof supabaseClient;

const STORAGE_KEY = 'lumina-favorites';

export function readLocalFavorites(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeLocalFavorites(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* sin acceso a localStorage */
  }
}

// Al cargar: si hay sesión, trae los favoritos guardados en Supabase y les
// suma cualquier favorito marcado localmente antes de iniciar sesión (o en
// otro dispositivo sin conexión), subiéndolos para que queden sincronizados.
export async function initFavorites(client: Client): Promise<string[]> {
  const local = readLocalFavorites();
  if (!client) return local;
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return local;
  const { data: rows } = await client.from('favorites').select('product_id').eq('user_id', userId);
  const remote = (rows ?? []).map((row) => row.product_id as string);
  const merged = [...new Set([...remote, ...local])];
  const missingRemote = local.filter((id) => !remote.includes(id));
  if (missingRemote.length) {
    void client.from('favorites').upsert(missingRemote.map((product_id) => ({ user_id: userId, product_id })), { onConflict: 'user_id,product_id' });
  }
  writeLocalFavorites(merged);
  return merged;
}

// Best-effort: la lista local ya cambió (UI optimista), esto solo intenta
// reflejarlo en Supabase para que quede disponible en otros dispositivos.
export function syncFavoriteToggle(client: Client, productId: string, liked: boolean) {
  if (!client) return;
  void (async () => {
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    if (liked) await client.from('favorites').upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id' });
    else await client.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
  })();
}
