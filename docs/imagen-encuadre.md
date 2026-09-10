# Encuadre de fotos sin pensar en vertical/horizontal

El problema: alguien sube una foto (vertical, horizontal, cuadrada, cualquier cosa)
y tú necesitas que quede bien dentro de un recuadro de forma fija (una tarjeta,
un hero, una miniatura). Sin obligar a la persona a recortar la imagen aparte.

Este proyecto lo resuelve con **dos piezas** que se pueden usar juntas o por
separado. Para portar a otro proyecto, la **Opción A** sola suele bastar.

---

## Opción A — Encuadre no destructivo con CSS (recomendada para portar)

No se toca la imagen. Se guardan **3 números** y el navegador la encuadra al vuelo.

### Datos que guardas por imagen

| campo | rango | qué hace |
|---|---|---|
| `position_x` | 0–100 | punto horizontal de la foto que queda centrado en el recuadro |
| `position_y` | 0–100 | ídem vertical |
| `zoom` | 1–3 | cuánto se acerca |

(defaults: 50, 50, 1 → centrada, sin zoom)

### Cómo se muestra

El recuadro tiene forma fija (`aspect-ratio` o alto fijo) y `overflow: hidden`.
La `<img>` dentro:

```jsx
<div style={{ aspectRatio: '1 / 1', overflow: 'hidden' }}>
  <img
    src={url}
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',                 // llena el recuadro, recorta lo que sobra
      objectPosition: `${x}% ${y}%`,      // qué parte de la foto se ve
      transformOrigin: `${x}% ${y}%`,     // el zoom acerca hacia ese mismo punto
      transform: `scale(${zoom})`,        // acerca
    }}
  />
</div>
```

- `object-fit: cover` hace el trabajo pesado: cualquier proporción de imagen
  llena el recuadro sin deformarse.
- `object-position` mueve el "recorte" (si la foto es más alta que el recuadro,
  eliges si se ve la parte de arriba, el centro o abajo).
- `transform-origin` igual a `object-position` es el detalle clave: si no,
  "acercar" siempre agranda hacia el centro del recuadro en vez de hacia el
  producto.

Con eso, la **misma foto original** se puede mostrar en una tarjeta cuadrada, un
hero panorámico y una miniatura, cada uno con su encuadre, sin generar copias.

### Editor (opcional pero simple)

Un preview del recuadro real + 3 controles:
- clic/arrastre sobre el preview → setea `position_x` / `position_y` (traduces la
  posición del cursor dentro del recuadro a 0–100).
- slider → `zoom`.
- guardas los 3 números en la base.

Cero procesamiento de imagen. No necesitas `sharp`, Cloudflare Images, imgproxy
ni un backend que recorte.

**Ventajas para vender la idea:**
- No destructivo: puedes re-encuadrar cuando quieras, la original queda intacta.
- Funciona con cualquier proporción de entrada.
- Liviano: 3 columnas en la tabla + unas líneas de estilo al renderizar.
- Un solo archivo se reusa en varios lugares con encuadres distintos.

---

## Opción B — Recorte a cuadrado en el navegador antes de subir

Cuando prefieres **normalizar** todo a un cuadrado limpio al momento de subir
(y que la imagen guardada ya venga encuadrada). Es lo que hace
`components/image-crop-dialog.tsx`.

Idea:
1. Un "viewport" cuadrado de tamaño fijo (p. ej. 280px) con `overflow: hidden`.
2. La imagen dentro, posicionada con `left/top` y escalada con `width/height`.
3. Arrastre (pointer events) mueve `offset`; un slider cambia `zoom`; se
   "clampea" para que la imagen siempre cubra el viewport.
4. Al confirmar, un `<canvas>` de salida (p. ej. 800×800) hace un solo
   `ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, 800, 800)` con la
   región elegida, y `canvas.toBlob(..., 'image/jpeg', 0.9)` te da el archivo
   final para subir.

Matemática del recorte (del código real):

```js
const displayedScale = (base.w * zoom) / img.naturalWidth; // px mostrados / px reales
const srcX = -offset.x / displayedScale;                    // origen del recorte en la imagen real
const srcY = -offset.y / displayedScale;
const srcSize = VIEWPORT / displayedScale;                  // lado del recorte en la imagen real
ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);
```

**Ventajas:** el archivo final es chico y ya cuadrado, deja de importar la
proporción de origen en todo el resto del sistema.
**Contra:** es destructivo (se sube el recorte, no la original).

---

## Para portar

- Solo Opción A: agrega 3 columnas (`position_x`, `position_y` int 0–100,
  `zoom` numeric 1–3, defaults 50/50/1), aplica los estilos de arriba donde
  muestres la imagen, y arma el mini-editor.
- Opción B: copia `components/image-crop-dialog.tsx` (depende solo de un Dialog
  y un Button), llama `onConfirm(blob)` y sube ese blob.
- Las dos juntas: recortas a cuadrado al subir (B) y luego permites re-encuadre
  fino no destructivo dentro de recuadros no cuadrados (A).
