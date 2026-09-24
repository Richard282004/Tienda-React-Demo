'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, ImagePlus, Monitor, Save, Smartphone, Trash2, X } from 'lucide-react';

import { HomePaths } from '@/components/home-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  HOME_PAGES, describeTarget, getHomeBlocks, isSafeImageUrl, resolveHomeBlocks, resolveHomeCategories, safeExternalUrl,
  type HomeBlock, type HomeTargetKind,
} from '@/lib/home-content';
import { defaultStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { supabase } from '@/lib/supabase';

// Campos que edita esta sección (para saber si hay cambios sin guardar).
const HOME_FIELDS = ['homeBlocks', 'homeCategories', 'homeFeaturedIds', 'collectionKicker', 'collectionTitle', 'collectionHighlight', 'cookieTitle', 'cookieText', 'devCreditEnabled', 'devCreditText', 'devCreditName', 'devCreditUrl'] as const;
const pickHome = (content: StoreContent) => JSON.stringify(HOME_FIELDS.map((field) => content[field] ?? null));

// Las fotos se achican antes de subir: la portada nunca las muestra a más de
// ~1200px de ancho, y así cargan rápido en celular.
function resizePhoto(file: File, maxDimension: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error('sin canvas')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob falló'))), 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no se pudo leer la imagen')); };
    img.src = url;
  });
}

// Muestra un contenido a su ancho real (390px celular / 1180px computador)
// reducido para que quepa en el panel, sin deformarlo.
function ScaledPreview({ width, children }: { width: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const update = () => {
      if (!outer.current || !inner.current) return;
      const next = Math.min(1, outer.current.clientWidth / width);
      setScale(next);
      setHeight(inner.current.offsetHeight * next);
    };
    update();
    const observer = new ResizeObserver(update);
    if (outer.current) observer.observe(outer.current);
    if (inner.current) observer.observe(inner.current);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div ref={outer} className="home-admin-preview-frame" style={{ height }}>
      <div ref={inner} className="home-admin-preview-canvas" style={{ width, transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

type Props = {
  content: StoreContent;
  setContent: (updater: (current: StoreContent) => StoreContent) => void;
  savedContent: StoreContent;
  products: Product[];
  onSave: () => Promise<string | null>;
};

export function HomePageAdmin({ content, setContent, savedContent, products, onSave }: Props) {
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [featuredPick, setFeaturedPick] = useState('');

  const categories = content.categories;
  const blocks = useMemo(() => getHomeBlocks(content.homeBlocks, categories), [content.homeBlocks, categories]);
  const resolved = useMemo(() => resolveHomeBlocks(blocks, categories, products), [blocks, categories, products]);
  const visibleCategories = useMemo(() => resolveHomeCategories(content.homeCategories, categories), [content.homeCategories, categories]);
  const featuredIds = (content.homeFeaturedIds ?? []).filter((id) => products.some((product) => product.id === id));
  const dirty = pickHome(content) !== pickHome(savedContent);
  const creditUrlInvalid = Boolean(content.devCreditUrl?.trim()) && !safeExternalUrl(content.devCreditUrl);

  // Aviso del navegador si se intenta salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch: Partial<StoreContent>) => { setStatus(null); setContent((current) => ({ ...current, ...patch })); };
  const updateBlock = (index: number, patch: Partial<HomeBlock>) => {
    setStatus(null);
    setContent((current) => {
      const list = getHomeBlocks(current.homeBlocks, current.categories);
      return { ...current, homeBlocks: list.map((block, i) => (i === index ? { ...block, ...patch } : block)) };
    });
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    const list = [...blocks];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    update({ homeBlocks: list });
  };

  const uploadPhoto = async (index: number, field: 'imageUrl' | 'mobileImageUrl', file: File | undefined) => {
    if (!file) return;
    if (!supabase) { setStatus({ kind: 'error', text: 'No hay conexión con la base de datos.' }); return; }
    if (!file.type.startsWith('image/')) { setStatus({ kind: 'error', text: 'El archivo debe ser una foto (JPG, PNG o WEBP).' }); return; }
    if (file.size > 12_000_000) { setStatus({ kind: 'error', text: 'La foto es muy pesada (máximo 12 MB).' }); return; }
    const key = `${index}-${field}`;
    setUploading(key); setStatus(null);
    try {
      const blob = await resizePhoto(file, field === 'imageUrl' ? 1600 : 1000);
      const path = `home-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('products').upload(path, blob, { cacheControl: '31536000', contentType: 'image/jpeg' });
      if (error) throw error;
      const url = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
      updateBlock(index, field === 'imageUrl'
        ? { imageUrl: url, imageX: 50, imageY: 50, imageZoom: 1 }
        : { mobileImageUrl: url, mobileImageX: 50, mobileImageY: 50, mobileImageZoom: 1 });
      setStatus({ kind: 'ok', text: 'Foto cargada. Revisa la vista previa y toca "Guardar cambios" para publicarla.' });
    } catch {
      setStatus({ kind: 'error', text: 'No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.' });
    } finally {
      setUploading(null);
    }
  };

  const toggleCategory = (name: string, visible: boolean) => {
    const next = visible ? [...visibleCategories, name] : visibleCategories.filter((item) => item !== name);
    update({ homeCategories: next });
  };
  const moveCategory = (name: string, direction: -1 | 1) => {
    const list = [...visibleCategories];
    const index = list.indexOf(name);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    update({ homeCategories: list });
  };
  const hiddenCategories = categories.filter((name) => !visibleCategories.includes(name));

  const moveFeatured = (id: string, direction: -1 | 1) => {
    const list = [...featuredIds];
    const index = list.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    update({ homeFeaturedIds: list });
  };

  const save = async () => {
    if (creditUrlInvalid) { setStatus({ kind: 'error', text: 'La dirección del crédito debe empezar con https:// (o déjala vacía).' }); return; }
    setSaving(true); setStatus(null);
    const error = await onSave();
    setSaving(false);
    setStatus(error
      ? { kind: 'error', text: `No se pudo guardar: ${error}` }
      : { kind: 'ok', text: `Cambios guardados y publicados en la tienda (${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}).` });
  };

  const productLabel = (product: Product) => `${product.name}${product.active === false ? ' (oculto)' : ''}`;
  const previewThumbs = new Map<string, string>();
  for (const product of products) if (product.active !== false && !previewThumbs.has(product.type) && isSafeImageUrl(product.image_url)) previewThumbs.set(product.type, product.image_url);

  const photoEditor = (block: HomeBlock, index: number, kind: 'desktop' | 'mobile') => {
    const isDesktop = kind === 'desktop';
    const resolvedBlock = resolved.find((item) => item.id === block.id);
    const ownUrl = isDesktop ? block.imageUrl : block.mobileImageUrl;
    const shownUrl = isDesktop ? resolvedBlock?.image : resolvedBlock?.mobileImage;
    const framing = isDesktop ? resolvedBlock?.framing : resolvedBlock?.mobileFraming;
    // El encuadre solo se puede ajustar sobre una foto propia del bloque.
    const canFrame = Boolean(isDesktop ? isSafeImageUrl(block.imageUrl) : isSafeImageUrl(block.mobileImageUrl) || isSafeImageUrl(block.imageUrl));
    const xKey = isDesktop ? 'imageX' : 'mobileImageX';
    const yKey = isDesktop ? 'imageY' : 'mobileImageY';
    const zKey = isDesktop ? 'imageZoom' : 'mobileImageZoom';
    const field = isDesktop ? 'imageUrl' : 'mobileImageUrl';
    const busy = uploading === `${index}-${field}`;
    const frameStyle = {
      objectPosition: `${framing?.x ?? 50}% ${framing?.y ?? 50}%`,
      transformOrigin: `${framing?.x ?? 50}% ${framing?.y ?? 50}%`,
      transform: `scale(${framing?.zoom ?? 1})`,
    } as CSSProperties;
    return (
      <div className="home-admin-photo">
        <div className="home-admin-photo-head">
          <strong>{isDesktop ? <><Monitor size={15} /> Foto principal (computador y celular)</> : <><Smartphone size={15} /> Foto para celular (opcional)</>}</strong>
          <small>{isDesktop
            ? 'Usa una foto real de tus productos. Si no subes una, se usa la foto de un producto del destino.'
            : 'Solo si en celular quieres otra foto. Si la dejas vacía, se usa la principal con el encuadre de abajo.'}</small>
        </div>
        <div className={`home-admin-photo-frame ${isDesktop ? 'is-desktop' : 'is-mobile'}`}>
          {shownUrl ? <img src={shownUrl} alt="" style={frameStyle} /> : <span>Sin foto: el bloque se verá con un fondo suave.</span>}
        </div>
        {!ownUrl && shownUrl && isDesktop && <p className="home-admin-hint">Ahora se muestra la foto de un producto del destino.</p>}
        <div className="home-admin-photo-actions">
          <label className={`home-admin-upload${busy ? ' is-busy' : ''}`}>
            <ImagePlus size={16} /> {busy ? 'Subiendo…' : ownUrl ? 'Reemplazar foto' : 'Subir foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(event) => { void uploadPhoto(index, field, event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          {ownUrl && <button type="button" className="home-admin-remove" onClick={() => updateBlock(index, { [field]: '' })}><Trash2 size={15} /> Eliminar foto</button>}
        </div>
        {canFrame && (
          <fieldset className="home-admin-framing">
            <legend>Encuadre {isDesktop ? 'en computador' : 'en celular'}</legend>
            <label>Horizontal <span>{Math.round(framing?.x ?? 50)}%</span><input type="range" min={0} max={100} value={framing?.x ?? 50} onChange={(event) => updateBlock(index, { [xKey]: Number(event.target.value) })} /></label>
            <label>Vertical <span>{Math.round(framing?.y ?? 50)}%</span><input type="range" min={0} max={100} value={framing?.y ?? 50} onChange={(event) => updateBlock(index, { [yKey]: Number(event.target.value) })} /></label>
            <label>Acercar <span>{(framing?.zoom ?? 1).toFixed(2)}×</span><input type="range" min={1} max={2.5} step={0.05} value={framing?.zoom ?? 1} onChange={(event) => updateBlock(index, { [zKey]: Number(event.target.value) })} /></label>
            <button type="button" className="home-admin-link" onClick={() => updateBlock(index, { [xKey]: 50, [yKey]: 50, [zKey]: 1 })}>Centrar de nuevo</button>
          </fieldset>
        )}
      </div>
    );
  };

  return (
    <div className="content-editor home-admin">
      <div className="admin-section-heading">
        <div><h2>Página principal</h2><p>Lo primero que ven tus clientas: los dos bloques de portada, las categorías y los productos destacados.</p></div>
        <Button type="button" disabled={saving || !dirty} onClick={() => void save()}><Save size={17} /> {saving ? 'Guardando…' : 'Guardar cambios'}</Button>
      </div>

      <div className="home-admin-status" role="status" aria-live="polite">
        {status ? (
          <p className={status.kind === 'ok' ? 'is-ok' : 'is-error'}>{status.kind === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />} {status.text}</p>
        ) : dirty ? <p className="is-pending">Tienes cambios sin guardar. Revisa la vista previa y toca "Guardar cambios".</p> : null}
      </div>

      <section className="home-admin-card" aria-labelledby="home-preview-title">
        <div className="home-admin-card-head">
          <h3 id="home-preview-title">Vista previa</h3>
          <div className="home-admin-toggle" role="group" aria-label="Tamaño de la vista previa">
            <button type="button" aria-pressed={previewMode === 'mobile'} onClick={() => setPreviewMode('mobile')}><Smartphone size={16} /> Celular</button>
            <button type="button" aria-pressed={previewMode === 'desktop'} onClick={() => setPreviewMode('desktop')}><Monitor size={16} /> Computador</button>
          </div>
        </div>
        <ScaledPreview width={previewMode === 'mobile' ? 390 : 1180}>
          <div className="home-admin-preview-page">
            {resolved.length ? <HomePaths blocks={resolved} preview={previewMode} /> : <p className="home-admin-preview-empty">Los dos bloques están ocultos: la portada empieza directo en las categorías.</p>}
            <div className="home-admin-preview-catalog">
              {visibleCategories.length > 0 && (
                <div className="home-categories" aria-hidden="true">
                  {['Todo', ...visibleCategories].map((name, index) => {
                    const thumb = name === 'Todo' ? null : previewThumbs.get(name);
                    return <span key={name} className={`home-admin-chip${index === 0 ? ' active' : ''}`}>{thumb ? <img src={thumb} alt="" /> : <span className="home-category-mark">{name === 'Todo' ? '✦' : name.slice(0, 1)}</span>}<span>{name}</span></span>;
                  })}
                </div>
              )}
              <p className="section-kicker">{content.collectionKicker}</p>
              <h2>{content.collectionTitle} {content.collectionHighlight && <em>{content.collectionHighlight}</em>}</h2>
            </div>
          </div>
        </ScaledPreview>
      </section>

      {blocks.map((block, index) => {
        const target = describeTarget(block.target, categories, products);
        return (
          <details className="admin-collapse" key={block.id} open={index === 0}>
            <summary>
              <span className="home-admin-summary">Bloque {index + 1}: {block.title.trim() || 'sin título'} {!block.enabled && <em>Oculto</em>}</span>
            </summary>
            <div className="home-admin-block-bar">
              <label className="home-admin-switch"><input type="checkbox" checked={block.enabled} onChange={(event) => updateBlock(index, { enabled: event.target.checked })} /> Mostrar este bloque en la portada</label>
              <div className="home-admin-order">
                <button type="button" disabled={index === 0} onClick={() => moveBlock(index, -1)} aria-label={`Mover bloque ${index + 1} antes`}><ChevronUp size={18} /> Antes</button>
                <button type="button" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} aria-label={`Mover bloque ${index + 1} después`}><ChevronDown size={18} /> Después</button>
              </div>
            </div>

            <div className="form-grid">
              <label>Título<Input value={block.title} maxLength={60} onChange={(event) => updateBlock(index, { title: event.target.value })} placeholder="Ej: Llaveros" /></label>
              <label>Texto del botón<Input value={block.ctaLabel} maxLength={32} onChange={(event) => updateBlock(index, { ctaLabel: event.target.value })} placeholder="Ej: Ver llaveros" /></label>
              <label className="full">Descripción (opcional)<Textarea rows={2} maxLength={140} value={block.description} onChange={(event) => updateBlock(index, { description: event.target.value })} placeholder="Una frase corta que invite a entrar." /><small className="home-admin-hint">{block.description.length}/140 caracteres. Mejor corta: en celular se ve junto a la foto.</small></label>
            </div>

            <fieldset className="home-admin-target">
              <legend>¿A dónde lleva este bloque?</legend>
              <div className="form-grid">
                <label>Tipo de destino
                  <NativeSelect className="admin-select" value={block.target.kind} onChange={(event) => {
                    const kind = event.target.value as HomeTargetKind;
                    const value = kind === 'category' ? categories[0] ?? '' : kind === 'product' ? products.find((product) => product.active !== false)?.id ?? '' : '#tienda';
                    updateBlock(index, { target: { kind, value } });
                  }}>
                    <NativeSelectOption value="category">Una categoría</NativeSelectOption>
                    <NativeSelectOption value="product">Un producto</NativeSelectOption>
                    <NativeSelectOption value="page">Una página de la tienda</NativeSelectOption>
                  </NativeSelect>
                </label>
                <label>{block.target.kind === 'category' ? 'Categoría' : block.target.kind === 'product' ? 'Producto' : 'Página'}
                  <NativeSelect className="admin-select" value={block.target.value} onChange={(event) => updateBlock(index, { target: { kind: block.target.kind, value: event.target.value } })}>
                    {target.missing && <NativeSelectOption value={block.target.value}>— Ya no disponible —</NativeSelectOption>}
                    {block.target.kind === 'category' && categories.map((name) => <NativeSelectOption key={name} value={name}>{name}</NativeSelectOption>)}
                    {block.target.kind === 'product' && products.map((product) => <NativeSelectOption key={product.id} value={product.id}>{productLabel(product)}</NativeSelectOption>)}
                    {block.target.kind === 'page' && HOME_PAGES.map((page) => <NativeSelectOption key={page.value} value={page.value}>{page.label}</NativeSelectOption>)}
                  </NativeSelect>
                </label>
              </div>
              {target.missing && <p className="home-admin-warning"><AlertTriangle size={15} /> El destino elegido ya no está disponible. Mientras tanto, el bloque lleva al catálogo completo.</p>}
            </fieldset>

            <div className="home-admin-photos">
              {photoEditor(block, index, 'desktop')}
              {photoEditor(block, index, 'mobile')}
            </div>
            <label className="home-admin-alt">Descripción de la foto para lectores de pantalla (opcional)
              <Input value={block.imageAlt} maxLength={140} onChange={(event) => updateBlock(index, { imageAlt: event.target.value })} placeholder="Ej: Llaveros de conejito tejidos en tonos rosados" />
              <small className="home-admin-hint">Describe lo que se ve. Ayuda a personas ciegas y a Google.</small>
            </label>
          </details>
        );
      })}

      <details className="admin-collapse">
        <summary>Categorías en la portada</summary>
        <p className="admin-section-note">Elige qué categorías aparecen como accesos rápidos sobre los productos y en qué orden. "Todo" siempre aparece primero. Para crear o renombrar categorías, ve a Textos y contacto → Categorías.</p>
        <ul className="home-admin-list">
          {visibleCategories.map((name, index) => (
            <li key={name}>
              <label className="home-admin-switch"><input type="checkbox" checked onChange={() => toggleCategory(name, false)} /> {name}</label>
              <div className="home-admin-order">
                <button type="button" disabled={index === 0} onClick={() => moveCategory(name, -1)} aria-label={`Subir ${name}`}><ChevronUp size={18} /></button>
                <button type="button" disabled={index === visibleCategories.length - 1} onClick={() => moveCategory(name, 1)} aria-label={`Bajar ${name}`}><ChevronDown size={18} /></button>
              </div>
            </li>
          ))}
          {hiddenCategories.map((name) => (
            <li key={name} className="is-hidden">
              <label className="home-admin-switch"><input type="checkbox" checked={false} onChange={() => toggleCategory(name, true)} /> {name} <em>Oculta</em></label>
            </li>
          ))}
        </ul>
        {!categories.length && <p className="admin-section-note">Aún no hay categorías.</p>}
      </details>

      <details className="admin-collapse">
        <summary>Sección de productos</summary>
        <div className="form-grid">
          <label>Texto pequeño superior<Input value={content.collectionKicker} onChange={(event) => update({ collectionKicker: event.target.value })} /></label>
          <label>Título<Input value={content.collectionTitle} onChange={(event) => update({ collectionTitle: event.target.value })} /></label>
          <label className="full">Palabra destacada (en rosado)<Input value={content.collectionHighlight} onChange={(event) => update({ collectionHighlight: event.target.value })} /></label>
        </div>
        <h4 className="home-admin-subtitle">Productos destacados</h4>
        <p className="admin-section-note">Aparecen primero en "Todo", en este orden. El precio, la foto y el stock se toman siempre del producto. Si uno se agota o se oculta, deja de destacarse solo.</p>
        {featuredIds.length > 0 && (
          <ul className="home-admin-list">
            {featuredIds.map((id, index) => {
              const product = products.find((item) => item.id === id)!;
              return (
                <li key={id}>
                  <span className="home-admin-product">{isSafeImageUrl(product.image_url) ? <img src={product.image_url} alt="" /> : <span aria-hidden="true">{product.art || '🧶'}</span>}{productLabel(product)}</span>
                  <div className="home-admin-order">
                    <button type="button" disabled={index === 0} onClick={() => moveFeatured(id, -1)} aria-label={`Subir ${product.name}`}><ChevronUp size={18} /></button>
                    <button type="button" disabled={index === featuredIds.length - 1} onClick={() => moveFeatured(id, 1)} aria-label={`Bajar ${product.name}`}><ChevronDown size={18} /></button>
                    <button type="button" onClick={() => update({ homeFeaturedIds: featuredIds.filter((item) => item !== id) })} aria-label={`Quitar ${product.name} de destacados`}><X size={18} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="home-admin-add">
          <NativeSelect className="admin-select" value={featuredPick} onChange={(event) => setFeaturedPick(event.target.value)} aria-label="Producto a destacar">
            <NativeSelectOption value="">Elige un producto…</NativeSelectOption>
            {products.filter((product) => !featuredIds.includes(product.id)).map((product) => <NativeSelectOption key={product.id} value={product.id}>{productLabel(product)}</NativeSelectOption>)}
          </NativeSelect>
          <Button type="button" variant="outline" disabled={!featuredPick} onClick={() => { update({ homeFeaturedIds: [...featuredIds, featuredPick] }); setFeaturedPick(''); }}>Destacar</Button>
        </div>
      </details>

      <details className="admin-collapse">
        <summary>Aviso de cookies</summary>
        <p className="admin-section-note">Solo aparece si activaste Google Analytics o Meta Pixel (Textos y contacto → Analítica). Los botones "Aceptar", "Rechazar" y el enlace "Más información" a la política de privacidad siempre se muestran.</p>
        <div className="form-grid">
          <label className="full">Título<Input value={content.cookieTitle ?? ''} maxLength={60} placeholder={defaultStoreContent.cookieTitle} onChange={(event) => update({ cookieTitle: event.target.value })} /></label>
          <label className="full">Texto<Textarea rows={3} maxLength={280} value={content.cookieText ?? ''} placeholder={defaultStoreContent.cookieText} onChange={(event) => update({ cookieText: event.target.value })} /><small className="home-admin-hint">Déjalo claro: qué pasa si acepta y que puede comprar igual si rechaza.</small></label>
        </div>
      </details>

      <details className="admin-collapse">
        <summary>Crédito en el pie de página</summary>
        <p className="admin-section-note">Línea discreta al final de la portada y de cada producto. El enlace se abre en una pestaña nueva.</p>
        <div className="form-grid">
          <label className="home-admin-switch full"><input type="checkbox" checked={content.devCreditEnabled !== false} onChange={(event) => update({ devCreditEnabled: event.target.checked })} /> Mostrar el crédito</label>
          <label>Texto<Input value={content.devCreditText ?? ''} placeholder="Desarrollado por" onChange={(event) => update({ devCreditText: event.target.value })} /></label>
          <label>Nombre<Input value={content.devCreditName ?? ''} placeholder="Nombre" onChange={(event) => update({ devCreditName: event.target.value })} /></label>
          <label className="full">Dirección del enlace<Input type="url" inputMode="url" value={content.devCreditUrl ?? ''} placeholder="https://" aria-invalid={creditUrlInvalid} onChange={(event) => update({ devCreditUrl: event.target.value })} />
            {creditUrlInvalid && <small className="home-admin-warning"><AlertTriangle size={14} /> Debe ser una dirección completa que empiece con https://</small>}
          </label>
        </div>
      </details>

      <div className="home-admin-footer">
        <Button type="button" disabled={saving || !dirty} onClick={() => void save()}><Save size={17} /> {saving ? 'Guardando…' : 'Guardar cambios'}</Button>
      </div>
    </div>
  );
}
