---
name: MILUÉ LOOP
description: Boutique de crochet artesanal en tonos crema y rosa, cálida y hecha a mano.
colors:
  cream: "#fffcf8"
  ink: "#382a32"
  muted: "#75646e"
  blush-pink: "#efbac6"
  rose: "#a74060"
  plum: "#70344f"
  honey-yellow: "#f4d88c"
  border-sand: "#e9ddd9"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(58px, 5.7vw, 82px)"
    fontWeight: 400
    lineHeight: 1.03
    letterSpacing: "-.055em"
  headline:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(34px, 3.6vw, 50px)"
    fontWeight: 400
    lineHeight: 1.13
  title:
    fontFamily: "Georgia, serif"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: ".14em"
rounded:
  pill: "999px"
  lg: "22px"
  md: "16px"
  sm: "12px"
spacing:
  sm: "12px"
  md: "24px"
  lg: "40px"
  xl: "80px"
components:
  button-primary:
    backgroundColor: "{colors.plum}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "14px 25px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
  button-add:
    backgroundColor: "#f8eff3"
    textColor: "#793854"
    rounded: "{rounded.sm}"
    padding: "10px 5px"
  button-add-hover:
    backgroundColor: "{colors.plum}"
    textColor: "#ffffff"
  card-product:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px"
---

# Design System: MILUÉ LOOP

## Overview

**Creative North Star: "El Atelier Cálido"**

MILUÉ LOOP se lee como una boutique artesanal chilena, no como una tienda de plantilla genérica. Todo el sistema se apoya en dos gestos: color cálido en capas suaves (crema de fondo, rosa/ciruela como acento, nunca gris ni azul corporativo) y curvas generosas (pill buttons, esquinas de 16-24px, el blob de 46% del hero-image) que evocan lo hecho a mano. La serif Georgia en títulos aporta el aire "boutique editorial"; la sans Geist en cuerpo y etiquetas mantiene todo legible y contemporáneo sin volverse frío.

El sistema rechaza explícitamente: azul/gris corporativo, esquinas rectas duras, sombras pesadas decorativas, y cualquier ícono/emoji genérico de stock donde ya existe foto real de producto.

**Key Characteristics:**
- Paleta crema + rosa + ciruela, nunca fría.
- Serif Georgia para todo título; sans Geist para cuerpo/label.
- Radios generosos: pill en botones y tabs, 16-24px en tarjetas, blob 46% en la imagen hero.
- Profundidad por capas de color, no por sombra dura.
- Motion sutil con `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, feedback `:active { scale(0.94-0.97) }`.

## Colors

Paleta cálida de boutique: crema como base, rosa como acento emocional, ciruela como ancla oscura de contraste (reemplaza al negro).

### Primary
- **Ciruela (Plum)** (`#70344f`): color de acción principal — fondo de `.primary-button`, texto de precio, acentos de marca en footer/story-card. Es el "negro" del sistema: nunca usar negro puro.
- **Rosa (Rose)** (`#a74060`): acento emocional — enlaces activos, subrayados de nav, `--ring` de foco, corazón de favoritos activo, degradado del cart-fab.

### Secondary
- **Rosa pálido (Blush)** (`#efbac6`): fondos suaves — marca circular (`.brand-mark`), glow radial del hero, chips decorativos.

### Neutral
- **Crema (Cream)** (`#fffcf8`): fondo base de todo el sitio.
- **Tinta (Ink)** (`#382a32`): texto principal, "negro" cálido del sistema (nunca `#000`).
- **Muted** (`#75646e`): texto secundario, descripciones, metadatos.
- **Borde arena (Border Sand)** (`#e9ddd9`): todos los `border-color` de divisores, inputs, tarjetas.

### Accent (uso puntual)
- **Miel (Honey Yellow)** (`#f4d88c`): sticker/badge decorativo del hero, icono de notificación — uso raro y festivo, nunca como color de acción.

### Named Rules
**La Regla del Negro Cálido.** Nunca usar negro puro (`#000`) ni gris frío. `--ink` (`#382a32`) y `--plum` (`#70344f`) son los únicos "oscuros" del sistema.

## Typography

**Display/Headline/Title Font:** Georgia, serif
**Body/Label Font:** var(--font-geist-sans), Arial, sans-serif

**Character:** La serif Georgia da voz editorial/boutique a cada título (`h1`, `h2`, nombres de producto, "story-card"); la sans Geist mantiene el cuerpo legible y funcional. Nunca mezclar: los títulos siempre son serif, el resto siempre es sans.

### Hierarchy
- **Display** (400, `clamp(58px, 5.7vw, 82px)`, line-height 1.03, letter-spacing -.055em): `h1` del hero únicamente.
- **Headline** (400, `clamp(34px, 3.6vw, 50px)`, line-height 1.13): `h2` de sección (colecciones, story, trabajos recientes).
- **Title** (400, 25px, line-height 1.2): nombre de producto en `.product-info h3`.
- **Body** (400, 16px, line-height 1.6-1.8): párrafos, descripciones.
- **Label** (700, 12-14px, letter-spacing .1-.16em, uppercase en kickers): `.eyebrow`, `.section-kicker`, badges de categoría/disponibilidad.

### Named Rules
**La Regla Serif-Solo-Título.** Georgia serif aparece únicamente en títulos y nombres de producto/marca. Nunca en botones, inputs, ni texto de cuerpo.

## Layout

Contenedor centrado `.page-width` (máximo 1240px, márgenes fluidos `calc((100vw - 1240px)/2)` en desktop ancho). Ritmo generoso entre secciones (`padding-block` 85-95px en desktop, colapsando a 50-56px en mobile). Grid de producto: 3 columnas desktop → 2 tablet → 1 en <370px. El hero es 2 columnas (`1fr 1fr`) que colapsan a 1 columna bajo 900px. Mobile-first real: casi todo el sitio se prueba y ajusta explícitamente en breakpoints 980/900/800/640/560/420/370/350px porque la mayoría de las clientas compran desde el celular.

## Elevation & Depth

Sistema deliberadamente plano: sin sombras decorativas en reposo. La profundidad viene de capas de color (fondos `rgba(255,255,255,.2-.3)` superpuestos, degradados suaves) y de tono, no de `box-shadow` duro. Las pocas sombras que existen son ambientales y solo aparecen como respuesta a estado (hover de `.product-card`, `.cart-fab`, badges).

### Shadow Vocabulary
- **Ambient hover** (`box-shadow: 0 14px 36px rgba(56,42,50,.04)`): hover de `.product-card` — casi imperceptible, solo insinúa elevación.
- **Floating action** (`box-shadow: 0 12px 28px rgba(167,64,96,.45)`): `.cart-fab`, `.whatsapp-fab` — estos sí llevan sombra de color con fuerza, porque son elementos flotantes que deben leerse por encima de todo lo demás.
- **Modal deep** (`box-shadow: 0 30px 75px rgba(53,31,44,.23)`): diálogos (`.account-dialog`) — la sombra más fuerte del sistema, reservada solo a overlays modales.

### Named Rules
**La Regla del Plano en Reposo.** Ninguna tarjeta ni botón lleva sombra visible en reposo. La sombra es siempre una respuesta a hover, foco o estado flotante — nunca decoración por defecto.

## Shapes

Curvas generosas en todo: `999px` (pill) en botones, tabs y badges; `16-24px` en tarjetas, diálogos y paneles; el `.hero-image-wrap` rompe el patrón con un radio orgánico `46% 46% 18px 18px` (blob), la única forma no-rectangular no-circular del sistema, reservada al hero como firma visual. Círculos perfectos para iconos (`.brand-mark`, `.heart-icon`, `.icon-button`).

### Named Rules
**La Regla del Blob Único.** El radio orgánico `46% 46% 18px 18px` pertenece solo a la imagen del hero. No se replica en otras imágenes o tarjetas — sería ruido si se repitiera.

## Components

### Buttons
- **Shape:** pill (`border-radius: 999px`), altura mínima 44px táctil.
- **Primary (`.primary-button`):** fondo ciruela (`#70344f`), texto blanco, hover → tinta (`#382a32`); `:active { transform: scale(0.97) }`.
- **Add-to-cart (`.add-button`):** variante suave, fondo `#f8eff3` con texto `#793854`, radio 12px (no pill) para diferenciarse de la acción principal; hover invierte a ciruela sólido.
- **Ghost/Text (`.text-link`):** subrayado simple, sin fondo, usado para CTAs secundarios ("Ver historia").

### Chips / Tabs
- **Category tabs (`.category-tabs`):** grupo segmentado con fondo `#f7f1ed`, tab activo en blanco con sombra ambiental mínima — nunca color sólido de acento en el tab activo.
- **Availability badge:** punto de color + texto, sin fondo sólido — información, no decoración.

### Cards / Containers
- **Product card:** borde sutil (`var(--border)`), radio 22px, fondo blanco sobre crema; hover eleva 3px + sombra ambiental + zoom 1.035 en foto.
- **Story card:** fondo ciruela oscuro (`#653b52`) con texto blanco — única tarjeta de fondo oscuro del sistema, para el bloque narrativo "Sobre nosotros".

### Inputs / Fields
- **Style:** borde `#decfc9`/`var(--border)`, fondo blanco, radio 11-14px, altura mínima 46px.
- **Focus:** `outline: 3px solid var(--rose)`, offset 4px — visible y de alto contraste, no un glow sutil.

### Navigation
- **Style:** sans, 14px, subrayado rosa animado (`scaleX`) en hover, nunca color de fondo en desktop. Mobile colapsa a menú vertical con `min-height: 44px` por ítem táctil.

### Cart FAB / WhatsApp FAB (signature)
Botones flotantes circulares 50-56px con degradado de marca (`linear-gradient(155deg, var(--rose), var(--plum))` para el carrito) o color de marca externa (WhatsApp verde) — los únicos elementos con sombra de color fuerte y animación de entrada (`cart-fab-in`, spring `cubic-bezier(.34,1.56,.64,1)`).

## Do's and Don'ts

### Do:
- **Do** usar Georgia serif solo en títulos y nombres de producto; sans Geist en todo lo demás.
- **Do** mantener el sistema plano en reposo; sombra solo como respuesta a hover/foco/flotante.
- **Do** usar `--ink` (`#382a32`) o `--plum` (`#70344f`) como "oscuro"; nunca negro puro.
- **Do** usar pill (`999px`) en botones/tabs y 16-24px en tarjetas/diálogos.
- **Do** reservar el radio orgánico `46% 46% 18px 18px` solo para `.hero-image`.
- **Do** usar `var(--ease-out)` (`cubic-bezier(0.23, 1, 0.32, 1)`) para transiciones de estado, y `:active { transform: scale(0.94-0.97) }` como feedback táctil.

### Don't:
- **Don't** introducir azul, gris frío ni negro puro — rompe la calidez artesanal de la marca.
- **Don't** agregar sombras decorativas en reposo a tarjetas o botones nuevos.
- **Don't** mezclar serif en botones/inputs o sans en títulos.
- **Don't** repetir el blob orgánico del hero en otro componente.
