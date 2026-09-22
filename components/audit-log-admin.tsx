'use client';

import { useEffect, useState } from 'react';
import { History, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Profile } from '@/lib/orders';
import { supabase } from '@/lib/supabase';

type AuditEntry = {
  id: number;
  actor_id: string | null;
  table_name: string;
  record_id: string | null;
  action: 'insert' | 'update' | 'delete';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  products: 'Productos',
  site_content: 'Textos y contacto',
  shipping_rates: 'Envíos',
  orders: 'Pedidos',
  product_images: 'Fotos de producto',
  product_variants: 'Variantes',
  discount_codes: 'Descuentos',
  showcase_items: 'Vitrina',
  faqs: 'FAQ',
  reviews: 'Reseñas',
  profiles: 'Usuarios (rol)',
};

const ACTION_LABELS: Record<AuditEntry['action'], string> = { insert: 'Creado', update: 'Editado', delete: 'Eliminado' };

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

// Solo los campos que realmente cambiaron entre old_data y new_data — no
// tiene sentido mostrar las 20 columnas de un producto si solo cambió el
// precio.
function changedFields(entry: AuditEntry): { key: string; before: unknown; after: unknown }[] {
  const before = entry.old_data ?? {};
  const after = entry.new_data ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { key: string; before: unknown; after: unknown }[] = [];
  for (const key of keys) {
    if (key === 'updated_at' || key === 'created_at') continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes.push({ key, before: before[key], after: after[key] });
  }
  return changes;
}

// Historial de cambios (Admin → Historial): lee audit_log directo con RLS
// (solo admin puede verla) y revierte vía la función admin_revert_audit_log,
// que también valida is_admin() adentro por si acaso.
export function AuditLogAdmin({ profiles }: { profiles: Profile[] }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (!error) setEntries((data ?? []) as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const revert = async (entry: AuditEntry) => {
    if (!supabase) return;
    if (!window.confirm(`¿Revertir este cambio en ${TABLE_LABELS[entry.table_name] ?? entry.table_name}? Esto vuelve al valor anterior.`)) return;
    setBusyId(entry.id);
    setMessage('');
    const { error } = await supabase.rpc('admin_revert_audit_log', { log_id: entry.id });
    setBusyId(null);
    setMessage(error ? error.message : 'Cambio revertido.');
    if (!error) await load();
  };

  const actorEmail = (actorId: string | null) => (actorId ? profiles.find((profile) => profile.id === actorId)?.email ?? actorId : 'Sistema');

  const visibleEntries = entries.filter((entry) => {
    if (tableFilter && entry.table_name !== tableFilter) return false;
    if (actorFilter.trim() && !actorEmail(entry.actor_id).toLowerCase().includes(actorFilter.trim().toLowerCase())) return false;
    return true;
  });

  const tableOptions = [...new Set(entries.map((entry) => entry.table_name))];

  return (
    <div>
      <div className="admin-section-heading"><div><h2><History size={20} /> Historial de cambios</h2><p>Quién editó qué, cuándo, y qué valor tenía antes. Solo administradoras lo ven.</p></div></div>
      <div className="form-grid">
        <label>Tabla<NativeSelect className="admin-select" value={tableFilter} onChange={(event) => setTableFilter(event.target.value)}>
          <NativeSelectOption value="">Todas</NativeSelectOption>
          {tableOptions.map((table) => <NativeSelectOption key={table} value={table}>{TABLE_LABELS[table] ?? table}</NativeSelectOption>)}
        </NativeSelect></label>
        <label>Buscar por quién<Input value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} placeholder="correo@ejemplo.com" /></label>
      </div>
      {message && <p className="admin-section-note" role="status">{message}</p>}
      {loading ? <p className="admin-section-note">Cargando…</p> : !visibleEntries.length ? <p className="admin-section-note">Sin cambios registrados todavía.</p> : (
        <div className="admin-users-list">
          {visibleEntries.map((entry) => {
            const changes = changedFields(entry);
            const canRevert = entry.action !== 'delete' || entry.old_data !== null;
            return (
              <div className="admin-user-row" key={entry.id} style={{ alignItems: 'start', flexDirection: 'column', gap: 8 }}>
                <div>
                  <strong>{TABLE_LABELS[entry.table_name] ?? entry.table_name} · {ACTION_LABELS[entry.action]}</strong>
                  <span>{actorEmail(entry.actor_id)} · {new Date(entry.created_at).toLocaleString('es-CL')}</span>
                </div>
                {changes.length > 0 && (
                  <ul className="admin-section-note" style={{ margin: 0, paddingLeft: 18 }}>
                    {changes.map(({ key, before, after }) => <li key={key}><strong>{key}</strong>: {formatValue(before)} → {formatValue(after)}</li>)}
                  </ul>
                )}
                <Button size="sm" variant="outline" disabled={busyId === entry.id || !canRevert} onClick={() => void revert(entry)}>
                  <Undo2 size={14} /> {busyId === entry.id ? 'Revirtiendo…' : 'Revertir'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
