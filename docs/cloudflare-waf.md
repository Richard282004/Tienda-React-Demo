# Reglas de seguridad en Cloudflare (WAF)

Esto se configura en el panel de Cloudflare **después de conectar el dominio propio**
a la tienda. No es código; son reglas del panel. Cloudflare → tu dominio.

## 1. WAF administrado (gratis, 1 clic)

**Security → WAF → Managed rules** → activa el **Cloudflare Free Managed Ruleset**.
Bloquea patrones conocidos de ataque (SQLi, XSS, path traversal) sin configurar nada.

## 2. Rate limiting por ruta

**Security → WAF → Rate limiting rules**. En plan Free tienes 1 regla; úsala en lo más caro:

| Campo | Valor |
|---|---|
| If incoming requests match | `URI Path` `contains` `/api/checkout` |
| When rate exceeds | `8` requests per `1 minute` por `IP` |
| Then | `Block` durante `1 minute` |

(El Worker ya tiene un límite interno de respaldo; esta regla lo corta antes de tocar el Worker.)

## 3. Reglas de firewall (Security → WAF → Custom rules)

**a. Proteger el panel admin — solo tu IP**
```
(http.request.uri.path contains "/admin") and (ip.src ne TU.IP.PUBLICA.AQUI)
```
Acción: **Block** (o **Managed Challenge** si tu IP cambia seguido).
Tu IP pública: búscala en https://ifconfig.me — si es dinámica, usa Managed Challenge.

**b. Bloquear el webhook a todo lo que no sea Mercado Pago**
Mercado Pago publica sus rangos de IP. Regla:
```
(http.request.uri.path eq "/api/mercadopago/webhook") and (not ip.src in {IP_RANGES_MP})
```
Acción: **Block**. (Alternativa más simple: dejarlo y confiar en que el Worker valida
el pago contra la API de MP antes de actuar — ya lo hace.)

**c. Bloquear métodos raros en la API**
```
(starts_with(http.request.uri.path, "/api/") and http.request.method in {"PUT" "DELETE" "PATCH" "TRACE"})
```
Acción: **Block**.

**d. Challenge a bots obvios**
```
((http.user_agent contains "python-requests") or (http.user_agent contains "curl/") or (http.user_agent eq ""))
and not (http.user_agent in {"MilueLoop-Monitor" "MilueLoop-Cron"})
```
Acción: **Managed Challenge**. Los workflows de GitHub Actions ya mandan esos
User-Agent propios, por eso la excepción.

## 4. Bot Fight Mode

**Security → Bots → Bot Fight Mode**: ON. Gratis, frena scrapers y ataques automatizados.

## 5. Always Use HTTPS

**SSL/TLS → Edge Certificates → Always Use HTTPS**: ON.

## 6. Opcional: BotID / Turnstile en el checkout

Si empiezas a ver pedidos basura, agrega un **Turnstile** (CAPTCHA invisible de Cloudflare,
gratis) en el formulario de pago. Requiere un pequeño cambio de código — avísame cuando pase.
