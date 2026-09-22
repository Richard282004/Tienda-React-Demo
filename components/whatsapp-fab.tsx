'use client';

import { useEffect, useRef, useState } from 'react';

const POS_KEY = 'milaloop-whatsapp-pos';
const SIZE = 56;
const MARGIN = 8;

function clampPos(x: number, y: number) {
  const maxX = window.innerWidth - SIZE - MARGIN;
  const maxY = window.innerHeight - SIZE - MARGIN;
  return { x: Math.min(Math.max(MARGIN, x), maxX), y: Math.min(Math.max(MARGIN, y), maxY) };
}

// "Magnético": al soltar, el botón nunca queda flotando a mitad de pantalla
// -- se pega al borde izquierdo o derecho, el que quede más cerca.
function snapToEdge(x: number, y: number) {
  const clamped = clampPos(x, y);
  const maxX = window.innerWidth - SIZE - MARGIN;
  const center = clamped.x + SIZE / 2;
  const snappedX = center < window.innerWidth / 2 ? MARGIN : maxX;
  return { x: snappedX, y: clamped.y };
}

// Botón flotante de WhatsApp que la visitante puede arrastrar: en algunas
// pantallas queda encima de un precio o botón, así que puede correrlo a un
// lugar que no le estorbe. La posición elegida se recuerda en este navegador.
export function WhatsappFab({ number, pathname }: { number: string; pathname?: string }) {
  // La posición se guarda por página: cada una tiene su propio layout, y una
  // posición arrastrada en una (ej: home) puede quedar encima de contenido
  // en otra (ej: el menú de Mi cuenta) si se comparte la misma llave.
  const storageKey = pathname ? `${POS_KEY}:${pathname}` : POS_KEY;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);

  useEffect(() => {
    setPos(null);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as { x: number; y: number } | null;
      // snapToEdge también corrige posiciones guardadas antes de que el botón
      // fuera magnético (podían quedar a mitad de pantalla).
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') setPos(snapToEdge(saved.x, saved.y));
    } catch { /* sin acceso a localStorage */ }
  }, [storageKey]);

  const onPointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, moved: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* algunos navegadores lo rechazan; el arrastre igual funciona */ }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) { drag.moved = true; setDragging(true); }
    if (drag.moved) setPos(clampPos(drag.originX + dx, drag.originY + dy));
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (drag?.moved) {
      justDraggedRef.current = true;
      setDragging(false);
      // Magnético: al soltar, salta al borde más cercano en vez de quedarse
      // donde cayó el dedo/mouse.
      setPos((current) => {
        const snapped = current ? snapToEdge(current.x, current.y) : current;
        if (snapped) { try { localStorage.setItem(storageKey, JSON.stringify(snapped)); } catch { /* no crítico */ } }
        return snapped;
      });
    }
    dragRef.current = null;
  };

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (justDraggedRef.current) {
      event.preventDefault();
      justDraggedRef.current = false;
    }
  };

  return (
    <a
      className={`whatsapp-fab${dragging ? ' is-dragging' : ''}`}
      href={`https://wa.me/${number.replace(/\D/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7C17.18 3.03 14.69 2 12.04 2Zm0 18.12h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.19 8.19 0 0 1-1.26-4.33c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.26.86 5.82 2.41a8.16 8.16 0 0 1 2.41 5.82c0 4.53-3.69 8.2-8.2 8.2Zm4.51-6.15c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.96-.14.16-.29.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.83-.2-.48-.4-.42-.56-.42-.14 0-.31-.02-.47-.02s-.43.06-.66.31c-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
      </svg>
    </a>
  );
}
