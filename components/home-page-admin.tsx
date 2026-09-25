'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, ImagePlus, Monitor, Save, Smartphone, Trash2, X } from 'lucide-react';

import { HomeBanner } from '@/components/home-banner';
import { HomePaths } from '@/components/home-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  HOME_PAGES, HOME_ZOOM_MAX, HOME_ZOOM_MIN, categoryImages, describeTarget, getHomeBlocks, isSafeImageUrl, resolveHomeBlocks, resolveHomeCategories, safeExternalUrl,
  BANNER_FADE_DEFAULTS, getHomeBanner, resolveHomeBanner,
  type HomeBanner as HomeBannerConfig, type HomeBlock, type HomeTarget, type HomeTargetKind, type ResolvedHomeBlock,
} from '@/lib/home-content';
import { HOME_CONTENT_FIELDS, defaultStoreContent, type Product, type StoreContent } from '@/lib/store-data';
import { supabase } from '@/lib/supabase';

// Campos que edita esta sección (para saber si hay cambios sin guardar).
const pickHome = (content: StoreContent) => JSON.stringify(HOME_CONTENT_FIELDS.map((field) => content[field] ?? null));

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
  const banner = useMemo(() => getHomeBanner(content.homeBanner, categories), [content.homeBanner, categories]);
  const resolvedBanner = useMemo(() => resolveHomeBanner(banner, categories, products), [banner, categories, products]);
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
  const updateBanner = (patch: Partial<HomeBannerConfig>) => {
    setStatus(null);
    setContent((current) => ({ ...current, homeBanner: { ...getHomeBanner(current.homeBanner, current.categories), ...patch } }));
  };
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

  // Sube una foto ya achicada al almacenamiento de la tienda y devuelve su
  // dirección pública, o null (con el mensaje de error ya mostrado).
  const uploadImage = async (key: string, file: File | undefined, maxDimension: number): Promise<string | null> => {
    if (!file) return null;
    if (!supabase) { setStatus({ kind: 'error', text: 'No hay conexión con la base de datos.' }); return null; }
    if (!file.type.startsWith('image/')) { setStatus({ kind: 'error', text: 'El archivo debe ser una foto (JPG, PNG o WEBP).' }); return null; }
    if (file.size > 12_000_000) { setStatus({ kind: 'error', text: 'La foto es muy pesada (máximo 12 MB).' }); return null; }
    setUploading(key); setStatus(null);
    try {
      const blob = await resizePhoto(file, maxDimension);
      const path = `home-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('products').upload(path, blob, { cacheControl: '31536000', contentType: 'image/jpeg' });
      if (error) throw error;
      setStatus({ kind: 'ok', text: 'Foto cargada. Revisa la vista previa y toca "Guardar cambios" para publicarla.' });
      return supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
    } catch {
      setStatus({ kind: 'error', text: 'No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.' });
      return null;
    } finally {
      setUploading(null);
    }
  };

  const uploadPhoto = async (key: string, field: 'imageUrl' | 'mobileImageUrl', file: File | undefined, apply: (patch: Partial<HomeBlock>) => void) => {
    const url = await uploadImage(`${key}-${field}`, file, field === 'imageUrl' ? 1600 : 1000);
    if (!url) return;
    apply(field === 'imageUrl'
      ? { imageUrl: url, imageX: 50, imageY: 50, imageZoom: 1 }
      : { mobileImageUrl: url, mobileImageX: 50, mobileImageY: 50, mobileImageZoom: 1 });
  };

  const setCategoryImage = (name: string, url: string) => {
    const next = { ...content.homeCategoryImages };
    if (url) next[name] = url; else delete next[name];
    update({ homeCategoryImages: next });
  };
  const uploadCategoryImage = async (name: string, file: File | undefined) => {
    const url = await uploadImage(`category-${name}`, file, 240);
    if (url) setCategoryImage(name, url);
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
  const previewThumbs = categoryImages(categories, content.homeCategoryImages, products);

  // Editor de una foto (principal o de celular) con su encuadre. Sirve para
  // los bloques y para el banner; `fade` muestra encima el difuminado del banner.
  type PhotoEditorOptions = {
    item: HomeBlock;
    resolvedItem: ResolvedHomeBlock | undefined;
    apply: (patch: Partial<HomeBlock>) => void;
    uploadKey: string;
    kind: 'desktop' | 'mobile';
    frameClass: string;
    help: string;
    fade?: { strength: number; size: number; direction: 'right' | 'bottom' };
  };
  const photoEditor = ({ item, resolvedItem, apply, uploadKey, kind, frameClass, help, fade }: PhotoEditorOptions) => {
    const isDesktop = kind === 'desktop';
    const ownUrl = isDesktop ? item.imageUrl : item.mobileImageUrl;
    const shownUrl = isDesktop ? resolvedItem?.image : resolvedItem?.mobileImage;
    const framing = isDesktop ? resolvedItem?.framing : resolvedItem?.mobileFraming;
    // Cualquier foto visible se puede encuadrar, también la tomada de un
    // producto: cada composición necesita su propio ajuste.
    const canFrame = Boolean(shownUrl);
    const xKey = isDesktop ? 'imageX' : 'mobileImageX';
    const yKey = isDesktop ? 'imageY' : 'mobileImageY';
    const zKey = isDesktop ? 'imageZoom' : 'mobileImageZoom';
    const field = isDesktop ? 'imageUrl' : 'mobileImageUrl';
    const busy = uploading === `${uploadKey}-${field}`;
    const frameStyle = {
      objectPosition: `${framing?.x ?? 50}% ${framing?.y ?? 50}%`,
      transformOrigin: `${framing?.x ?? 50}% ${framing?.y ?? 50}%`,
      transform: `scale(${framing?.zoom ?? 1})`,
    } as CSSProperties;
    const fadeStyle = fade && ({
      background: fade.direction === 'right'
        ? `linear-gradient(to right, rgb(251 243 238) 0%, rgb(251 243 238 / ${fade.strength / 100}) ${fade.size * 0.4}%, rgb(251 243 238 / 0) ${fade.size}%)`
        : `linear-gradient(to bottom, rgb(251 243 238 / 0) ${100 - fade.size * 0.4}%, rgb(251 243 238 / ${fade.strength / 100}) ${100 - fade.size * 0.12}%, rgb(251 243 238) 100%)`,
    } as CSSProperties);
    return (
      <div className="home-admin-photo">
        <div className="home-admin-photo-head">
          <strong>{isDesktop ? <><Monitor size={15} /> Foto principal (computador y celular)</> : <><Smartphone size={15} /> Foto para celular (opcional)</>}</strong>
          <small>{help}</small>
        </div>
        <div className={`home-admin-photo-frame ${frameClass}`}>
          {shownUrl ? <img src={shownUrl} alt="" style={frameStyle} /> : <span>Sin foto: se verá con un fondo suave.</span>}
          {shownUrl && fadeStyle && <i className="home-admin-photo-fade" style={fadeStyle} aria-hidden="true" />}
        </div>
        {!ownUrl && shownUrl && <p className="home-admin-hint">{isDesktop ? 'Foto tomada de un producto del destino. Puedes encuadrarla o subir otra.' : 'Usando la foto principal.'}</p>}
        <div className="home-admin-photo-actions">
          <label className={`home-admin-upload${busy ? ' is-busy' : ''}`}>
            <ImagePlus size={16} /> {busy ? 'Subiendo…' : ownUrl ? 'Reemplazar foto' : 'Subir foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(event) => { void uploadPhoto(uploadKey, field, event.target.files?.[0], apply); event.target.value = ''; }} />
          </label>
          {ownUrl && <button type="button" className="home-admin-remove" onClick={() => apply({ [field]: '' })}><Trash2 size={15} /> Eliminar foto</button>}
        </div>
        {canFrame && (
          <fieldset className="home-admin-framing">
            <legend>Encuadre {isDesktop ? 'en computador' : 'en celular'}</legend>
            <label>Horizontal <span>{Math.round(framing?.x ?? 50)}%</span><input type="range" min={0} max={100} value={framing?.x ?? 50} onChange={(event) => apply({ [xKey]: Number(event.target.value) })} /></label>
            <label>Vertical <span>{Math.round(framing?.y ?? 50)}%</span><input type="range" min={0} max={100} value={framing?.y ?? 50} onChange={(event) => apply({ [yKey]: Number(event.target.value) })} /></label>
            <label>Tamaño (alejar ← → acercar) <span>{Math.round((framing?.zoom ?? 1) * 100)}%</span><input type="range" min={HOME_ZOOM_MIN} max={HOME_ZOOM_MAX} step={0.05} value={framing?.zoom ?? 1} onChange={(event) => apply({ [zKey]: Number(event.target.value) })} /></label>
            <small className="home-admin-hint">Mueve hasta que el producto se vea completo en el recuadro. Alejar deja un borde suave alrededor.</small>
            <button type="button" className="home-admin-link" onClick={() => apply({ [xKey]: 50, [yKey]: 50, [zKey]: 1 })}>Centrar de nuevo</button>
          </fieldset>
        )}
      </div>
    );
  };

  // Selector de destino (categoría, producto o página existente).
  const targetPicker = (target: HomeTarget, onChange: (next: HomeTarget) => void, legend: string, missingNote: string) => {
    const described = describeTarget(target, categories, products);
    return (
      <fieldset className="home-admin-target">
        <legend>{legend}</legend>
        <div className="form-grid">
          <label>Tipo de destino
            <NativeSelect className="admin-select" value={target.kind} onChange={(event) => {
              const kind = event.target.value as HomeTargetKind;
              const value = kind === 'category' ? categories[0] ?? '' : kind === 'product' ? products.find((product) => product.active !== false)?.id ?? '' : '#tienda';
              onChange({ kind, value });
            }}>
              <NativeSelectOption value="category">Una categoría</NativeSelectOption>
              <NativeSelectOption value="product">Un producto</NativeSelectOption>
              <NativeSelectOption value="page">Una página de la tienda</NativeSelectOption>
            </NativeSelect>
          </label>
          <label>{target.kind === 'category' ? 'Categoría' : target.kind === 'product' ? 'Producto' : 'Página'}
            <NativeSelect className="admin-select" value={target.value} onChange={(event) => onChange({ kind: target.kind, value: event.target.value })}>
              {described.missing && <NativeSelectOption value={target.value}>— Ya no disponible —</NativeSelectOption>}
              {target.kind === 'category' && categories.map((name) => <NativeSelectOption key={name} value={name}>{name}</NativeSelectOption>)}
              {target.kind === 'product' && products.map((product) => <NativeSelectOption key={product.id} value={product.id}>{productLabel(product)}</NativeSelectOption>)}
              {target.kind === 'page' && HOME_PAGES.map((page) => <NativeSelectOption key={page.value} value={page.value}>{page.label}</NativeSelectOption>)}
            </NativeSelect>
          </label>
        </div>
        {described.missing && <p className="home-admin-warning"><AlertTriangle size={15} /> {missingNote}</p>}
      </fieldset>
    );
  };

  const categoryPhoto = (name: string) => {
    const own = content.homeCategoryImages?.[name];
    const shown = previewThumbs.get(name);
    const busy = uploading === `category-${name}`;
    return (
      <div className="home-admin-category-photo">
        <span className="home-admin-category-thumb">{shown ? <img src={shown} alt="" /> : <span aria-hidden="true">{name.slice(0, 1)}</span>}</span>
        <label className={`home-admin-upload is-small${busy ? ' is-busy' : ''}`}>
          <ImagePlus size={15} /> {busy ? 'Subiendo…' : own ? 'Cambiar' : 'Elegir foto'}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} aria-label={`Foto de la categoría ${name}`} onChange={(event) => { void uploadCategoryImage(name, event.target.files?.[0]); event.target.value = ''; }} />
        </label>
        {own && <button type="button" className="home-admin-remove is-small" onClick={() => setCategoryImage(name, '')} aria-label={`Quitar la foto de ${name}`}><Trash2 size={15} /></button>}
      </div>
    );
  };

  return (
    <div className="content-editor home-admin">
      <div className="admin-section-heading">
        <div><h2>Página principal</h2><p>Lo primero que ven tus clientas: el banner (o los dos bloques), las categorías y los productos destacados.</p></div>
        <Button type="button" disabled={saving || !dirty} onClick={() => void save()}><Save size={17} /> {saving ? 'Guardando…' : 'Guardar cambios'}</Button>
      </div>

      <ol className="home-admin-steps">
        <li>Edita el banner (o los dos bloques, si lo ocultas): textos, destino y fotos.</li>
        <li>Mueve el encuadre hasta que el producto se vea completo, en <b>Celular</b> y en <b>Computador</b>.</li>
        <li>Toca <b>Guardar cambios</b>. Se publica al instante.</li>
      </ol>

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
            {banner.enabled
              ? <HomeBanner banner={resolvedBanner} preview={previewMode} />
              : resolved.length ? <HomePaths blocks={resolved} preview={previewMode} /> : <p className="home-admin-preview-empty">El banner y los dos bloques están ocultos: la portada empieza directo en las categorías.</p>}
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

      <details className="admin-collapse" open>
        <summary><span className="home-admin-summary">Banner principal {!banner.enabled && <em>Oculto</em>}</span></summary>
        <p className="admin-section-note">Una colección destacada: texto y botón a la izquierda, foto a la derecha (en celular, la foto arriba). Mientras esté activo, reemplaza a los dos bloques de abajo; ellos conservan su configuración.</p>
        <label className="home-admin-switch"><input type="checkbox" checked={banner.enabled} onChange={(event) => updateBanner({ enabled: event.target.checked })} /> Mostrar el banner en la portada</label>
        <div className="form-grid">
          <label>Título<Input value={banner.title} maxLength={70} onChange={(event) => updateBanner({ title: event.target.value })} placeholder="Ej: Flores que no se marchitan" /></label>
          <label>Texto del botón<Input value={banner.ctaLabel} maxLength={32} onChange={(event) => updateBanner({ ctaLabel: event.target.value })} placeholder="Ej: Ver flores" /></label>
          <label className="full">Descripción (opcional)<Textarea rows={2} maxLength={160} value={banner.description} onChange={(event) => updateBanner({ description: event.target.value })} placeholder="Una o dos frases sobre la colección." /><small className="home-admin-hint">{banner.description.length}/160 caracteres.</small></label>
        </div>
        {targetPicker(banner.target, (next) => updateBanner({ target: next }), '¿A dónde lleva el botón?', 'El destino elegido ya no está disponible. Mientras tanto, el botón lleva al catálogo completo.')}
        <div className="home-admin-photos">
          {photoEditor({ item: banner, resolvedItem: resolvedBanner, apply: updateBanner, uploadKey: 'banner', kind: 'desktop', frameClass: 'is-desktop', fade: { strength: resolvedBanner.fadeStrength, size: resolvedBanner.fadeSize, direction: 'right' }, help: 'Se ve a la derecha en computador y arriba en celular (formato 4:3). Si no subes una, se usa la foto de un producto del destino.' })}
          {photoEditor({ item: banner, resolvedItem: resolvedBanner, apply: updateBanner, uploadKey: 'banner', kind: 'mobile', frameClass: 'is-desktop', fade: { strength: resolvedBanner.fadeStrength, size: resolvedBanner.fadeSize, direction: 'bottom' }, help: 'Opcional. Si la dejas vacía, en celular se usa la foto principal con este encuadre.' })}
        </div>
        <fieldset className="home-admin-framing home-admin-fade">
          <legend>Difuminado hacia el fondo</legend>
          <label>Intensidad <span>{resolvedBanner.fadeStrength}%</span><input type="range" min={0} max={100} value={resolvedBanner.fadeStrength} onChange={(event) => updateBanner({ fadeStrength: Number(event.target.value) })} /></label>
          <label>Extensión <span>{resolvedBanner.fadeSize}%</span><input type="range" min={10} max={70} value={resolvedBanner.fadeSize} onChange={(event) => updateBanner({ fadeSize: Number(event.target.value) })} /></label>
          <small className="home-admin-hint">Suaviza el borde de la foto hacia el fondo crema, sin desenfocar el producto. Si tapa el producto, baja la extensión o mueve el encuadre.</small>
          <button type="button" className="home-admin-link" onClick={() => updateBanner({ ...BANNER_FADE_DEFAULTS })}>Volver a los valores iniciales</button>
        </fieldset>
        <label className="home-admin-alt">Descripción de la foto para lectores de pantalla (opcional)
          <Input value={banner.imageAlt} maxLength={140} onChange={(event) => updateBanner({ imageAlt: event.target.value })} placeholder="Ej: Ramo de girasoles tejidos a crochet" />
        </label>
      </details>

      {blocks.map((block, index) => {
        return (
          <details className="admin-collapse" key={block.id} open={index === 0}>
            <summary>
              <span className="home-admin-summary">Bloque {index + 1}: {block.title.trim() || 'sin título'} {banner.enabled ? <em>En pausa: el banner está activo</em> : !block.enabled && <em>Oculto</em>}</span>
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

            {targetPicker(block.target, (next) => updateBlock(index, { target: next }), '¿A dónde lleva este bloque?', 'El destino elegido ya no está disponible. Mientras tanto, el bloque lleva al catálogo completo.')}

            <div className="home-admin-photos">
              {photoEditor({ item: block, resolvedItem: resolved.find((item) => item.id === block.id), apply: (patch) => updateBlock(index, patch), uploadKey: `block-${index}`, kind: 'desktop', frameClass: 'is-desktop', help: 'Se ve arriba del bloque en computador (formato 4:3) y al lado del texto en celular. Si no subes una, se usa la foto de un producto del destino.' })}
              {photoEditor({ item: block, resolvedItem: resolved.find((item) => item.id === block.id), apply: (patch) => updateBlock(index, patch), uploadKey: `block-${index}`, kind: 'mobile', frameClass: 'is-mobile', help: 'Opcional. Si la dejas vacía, en celular se usa la foto principal con este encuadre (formato casi cuadrado).' })}
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
        <p className="admin-section-note">Elige qué categorías aparecen como accesos rápidos sobre los productos, su foto y su orden. "Todo" siempre aparece primero. Sin foto elegida se usa la de un producto de la categoría. Para crear o renombrar categorías, ve a Textos y contacto → Categorías.</p>
        <ul className="home-admin-list">
          {visibleCategories.map((name, index) => (
            <li key={name}>
              <label className="home-admin-switch"><input type="checkbox" checked onChange={() => toggleCategory(name, false)} /> {name}</label>
              {categoryPhoto(name)}
              <div className="home-admin-order">
                <button type="button" disabled={index === 0} onClick={() => moveCategory(name, -1)} aria-label={`Subir ${name}`}><ChevronUp size={18} /></button>
                <button type="button" disabled={index === visibleCategories.length - 1} onClick={() => moveCategory(name, 1)} aria-label={`Bajar ${name}`}><ChevronDown size={18} /></button>
              </div>
            </li>
          ))}
          {hiddenCategories.map((name) => (
            <li key={name} className="is-hidden">
              <label className="home-admin-switch"><input type="checkbox" checked={false} onChange={() => toggleCategory(name, true)} /> {name} <em>Oculta</em></label>
              {categoryPhoto(name)}
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
        <p className="admin-section-note">Aparecen primero en "Todo", en este orden. El precio, la foto y el stock se toman siempre del producto. Si uno se agota pasa al final; si lo ocultas, no se muestra.</p>
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
