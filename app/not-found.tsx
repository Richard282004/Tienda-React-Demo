async function fetchLogoUrl(): Promise<string | null> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !key) return null;
  try {
    const res = await fetch(`${base}/rest/v1/site_content?select=value&key=eq.store&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { value?: { logoUrl?: string } }[];
    return rows[0]?.value?.logoUrl || null;
  } catch {
    return null;
  }
}

export default async function NotFound() {
  const logoUrl = await fetchLogoUrl();
  return (
    <main className="not-found-shell">
      <div className="not-found-card">
        {logoUrl ? <img className="not-found-logo" src={logoUrl} alt="" /> : <span className="not-found-mark">✦</span>}
        <h1>404</h1>
        <p>No encontramos esta página. Puede que el hilo se haya perdido en el camino.</p>
        <a href="/">Volver a la tienda</a>
      </div>
    </main>
  );
}
