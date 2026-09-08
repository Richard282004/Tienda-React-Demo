'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const VIEWPORT = 280;
const OUTPUT = 800;

type Props = {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
};

// Recorte cuadrado obligatorio antes de subir cualquier foto: así la imagen
// que se guarda ya viene bien encuadrada y se ve igual de bien en la tarjeta
// grande, la miniatura del carrito y la galería, sin depender de ajustar
// sliders de zoom por separado en cada lugar.
export function ImageCropDialog({ file, onCancel, onConfirm }: Props) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [base, setBase] = useState({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setBase({ w: 0, h: 0 });
    if (file) objectUrlRef.current = URL.createObjectURL(file);
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [file]);

  const clamp = (nextOffset: { x: number; y: number }, currentZoom: number, currentBase: { w: number; h: number }) => {
    const w = currentBase.w * currentZoom;
    const h = currentBase.h * currentZoom;
    const minX = Math.min(0, VIEWPORT - w);
    const minY = Math.min(0, VIEWPORT - h);
    return { x: Math.min(0, Math.max(minX, nextOffset.x)), y: Math.min(0, Math.max(minY, nextOffset.y)) };
  };

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const cover = Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight);
    const w = img.naturalWidth * cover;
    const h = img.naturalHeight * cover;
    setBase({ w, h });
    setOffset({ x: (VIEWPORT - w) / 2, y: (VIEWPORT - h) / 2 });
  };

  const onZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    setOffset((current) => clamp(current, nextZoom, base));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    try { (event.target as HTMLElement).setPointerCapture(event.pointerId); } catch { /* algunos navegadores pueden rechazarlo; el arrastre igual funciona */ }
    dragRef.current = { startX: event.clientX, startY: event.clientY, startOffset: offset };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setOffset(clamp({ x: dragRef.current.startOffset.x + dx, y: dragRef.current.startOffset.y + dy }, zoom, base));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !base.w) return;
    const displayedScale = (base.w * zoom) / img.naturalWidth;
    const srcX = -offset.x / displayedScale;
    const srcY = -offset.y / displayedScale;
    const srcSize = VIEWPORT / displayedScale;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.9);
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="crop-dialog">
        <DialogHeader><DialogTitle>Encuadra tu foto</DialogTitle><DialogDescription>Arrastra para mover y usa el control para acercar. Así se verá igual de bien en toda la tienda.</DialogDescription></DialogHeader>
        <div
          className="crop-viewport"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {objectUrlRef.current && (
            <img
              ref={imgRef}
              src={objectUrlRef.current}
              alt="Recortar"
              draggable={false}
              onLoad={onImgLoad}
              style={{ width: base.w * zoom, height: base.h * zoom, left: offset.x, top: offset.y }}
            />
          )}
        </div>
        <label className="crop-zoom">Acercar<input type="range" min={1} max={3} step={0.02} value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))} /></label>
        <div className="crop-actions">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={confirm}>Usar esta foto</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
