# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mujeres jóvenes en Chile que compran llaveros y peluches de crochet hechos a mano, mayormente como regalo personalizado. Llegan sobre todo desde redes sociales; compra a menudo emocional/impulsiva, decidida rápido en el celular.

## Product Purpose

Tienda online (MILUÉ LOOP, renombrada desde LÚMINA) de llaveros/peluches de crochet artesanales. Permite navegar productos por categoría, agregar al carrito, pagar con Mercado Pago, elegir envío (incluida una zona de entrega personal gratis solo en Pudahuel, RM), guardar favoritos, ver historial de pedidos, gestionar direcciones guardadas, y coordinar por chat en tiempo real con la vendedora sobre cada pedido. Panel admin propio para productos, stock, pedidos, envíos, contenido legal/marca y categorías.

## Positioning

Frente a vender solo por Instagram/Mercado Libre: tienda propia con checkout real (Mercado Pago producción), trazabilidad de pedido, reserva de stock con expiración automática, reembolso automatizado al cancelar, y chat directo pedido-por-pedido con la vendedora — no solo DMs sueltos. El producto en sí es 100% artesanal hecho a mano (no reventa).

## Operating Context

- Base de datos/backend: Supabase (Postgres, Auth, Storage, Realtime).
- Pagos: Mercado Pago, credenciales de producción.
- Email transaccional: Brevo.
- Deploy: Cloudflare Workers (vinext).
- Codebase pensado también como plantilla reutilizable para futuros clientes (repo privado `tienda-base` separado); por eso categorías, moneda, locale y zonas de envío están des-hardcodeadas y viven en `site_content` / tabla `shipping_rates`.
- Vendedora usa el panel admin para: productos (con reordenamiento drag-and-drop), stock, pedidos (cancelar con reembolso automático + restock), zonas de envío, contenido legal (términos/privacidad editables), consentimiento de analítica, y chat con clientes por pedido.

## Capabilities and Constraints

- Reserva de stock: 10 minutos, cancelación automática de pedidos pendientes no pagados.
- Cancelación manual por admin: reembolso automático vía API de Mercado Pago + restock automático.
- Direcciones múltiples guardadas por cliente (estilo Adidas: dirección principal + agregar más).
- Zona de envío "entrega personal" gratis, limitada a comuna Pudahuel (RM), sin exigir dirección/comuna en checkout.
- Favoritos persistidos (localStorage) con página propia de productos que gustaron.
- Carrito se vacía tras compra exitosa.
- Legal: términos, privacidad y aviso de retención editables desde admin; falta completar "nombre completo del responsable" en Admin → Legal.
- Pendiente (no producto, sino operación): boleta electrónica/DTE (SII) no implementada; dominio propio no conectado; sin transacción real de tarjeta verificada aún.

## Brand Commitments

- Nombre: MILUÉ LOOP (renombrada desde LÚMINA vía panel admin). No cambiar sin pedido explícito.
- Tono: cercano, artesanal, cálido — no corporativo.
- Idioma principal: español (Chile); toggle ES/EN existente en el sitio.
- Paleta actual: crema + rosa (`--pink: #e98d9e`) + acentos ciruela/plum. Preservar salvo pedido explícito de rediseño.

## Evidence on Hand

Catálogo real de productos y fotos vía admin (Supabase Storage), no placeholders. Sin testimonios/casos de estudio reales aún — no inventar.

## Product Principles

1. El checkout y el dinero son reales (producción Mercado Pago): cualquier cambio en flujo de pago, stock o reembolso debe tratarse como crítico, nunca cosmético.
2. La marca es artesanal y cercana — el diseño amplifica ese lenguaje existente (rosa, crema, tono cálido), no lo reemplaza sin que se pida.
3. El código debe seguir siendo reutilizable como plantilla: evitar volver a hardcodear categorías, moneda, locale o zonas de envío.
4. Mobile-first: la mayoría de las clientes compran desde el celular vía redes sociales.
5. Trazabilidad y confianza: pedidos, stock y reembolsos deben ser siempre verificables por la cliente y la vendedora (historial, chat, estados claros).

## Accessibility & Inclusion

Sin requisito específico confirmado más allá de WCAG AA estándar (ya auditado y con hallazgos corregidos: contraste de botón deshabilitado, tamaño de texto de tagline).
