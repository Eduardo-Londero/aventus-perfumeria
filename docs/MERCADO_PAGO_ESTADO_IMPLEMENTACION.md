# Mercado Pago — estado de implementación y pasos para terminarlo

Fecha de revisión: 2026-11-14

## 1. Resumen ejecutivo

La integración de **Mercado Pago (Checkout Pro)** ya tiene **código real implementado** en el repositorio (no es solo diseño). Lo que falta para que funcione end-to-end es **configuración de credenciales y validación en un entorno público**, no más código de negocio.

Archivos ya implementados:
- `src/lib/mercadopago.ts` — cliente MP, mapeo de estados, validación de firma, creación de preferencia, consulta de pago.
- `src/app/api/mercadopago/preferences/route.ts` — crea la preferencia server-side reconstruyendo ítems desde la DB.
- `src/app/api/webhooks/mercadopago/route.ts` — recibe IPN, valida firma, consulta pago real, actualiza pedido, libera stock, idempotencia.
- `src/app/checkout/page.tsx` — opción "Mercado Pago" y redirección a `init_point`.
- `src/app/checkout/resultado/page.tsx` — retorno informativo.

## 2. Lo que ya está bien resuelto (no tocar)

- Secretos solo en servidor (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`).
- Preferencia se crea reconstruyendo ítems desde la DB (no se confía en el navegador).
- Webhook valida `x-signature` antes de procesar (si hay secret configurado).
- Fuente de verdad = API de MP (`getPayment`), no el payload del webhook.
- Idempotencia por `payment_id` en `idempotency_keys`.
- Mapeo de estados MP → dominio (`mapMPStatus`) con liberación de stock en rechazo/cancelación/reembolso.
- Retorno del navegador es solo informativo (no marca pagado).

## 3. Variables de entorno requeridas (`.env.local` / Vercel)

| Variable | Dónde se usa | Estado actual |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | `src/lib/mercadopago.ts` (`getAccessToken`) | Ausente → bloquea todo. |
| `MERCADOPAGO_PUBLIC_KEY` | (frontend, si se usara Checkout API) | Ausente. Para Checkout Pro no es estrictamente necesaria, pero útil para el SDK de frontend. |
| `MERCADOPAGO_WEBHOOK_SECRET` | `validateWebhookSignature` | Ausente → el webhook acepta cualquier request (modo inseguro). |
| `NEXT_PUBLIC_SITE_URL` | `back_urls` y `notification_url` | Debe ser la URL pública HTTPS (no localhost en producción). |

> Nota: los nombres son `MERCADOPAGO_*` (con guion bajo entre MERCADO y PAGO), que coinciden con `.env.example`. La documentación antigua usaba `MP_*`: ignorarla, usar los nombres de `.env.example`.

## 4. Pasos concretos para terminar la implementación

### Paso A — Crear credenciales de prueba en Mercado Pago
1. Ir a https://www.mercadopago.com.ar/developers → "Tu aplicación" → "Credenciales de prueba".
2. Copiar **Access Token de prueba** (`TEST-...`) y **Public Key de prueba** (`TEST-...`).
3. Crear una suscripción de webhook en el panel → URL `https://<dominio>/api/webhooks/mercadopago` → eventos "Pagos" → copiar el **Webhook Secret**.

### Paso B — Configurar entorno
En `.env.local` (dev) y en Vercel (prod):
```
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MERCADOPAGO_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MERCADOPAGO_WEBHOOK_SECRET=tu-webhook-secret
NEXT_PUBLIC_SITE_URL=https://tu-dominio.com
```
- En dev, para recibir webhooks, usar un túnel (ngrok/cloudflared) y registrar esa URL HTTPS en MP.
- `NEXT_PUBLIC_SITE_URL` debe ser HTTPS en producción (MP exige HTTPS para `notification_url`).

### Paso C — Exponer el sitio para webhooks (dev)
```bash
ngrok http 3000
# registrar https://<id>.ngrok.io/api/webhooks/mercadopago en MP
```

### Paso D — Prueba end-to-end
1. Levantar la app en modo supabase (`NEXT_PUBLIC_DATA_BACKEND=supabase`) con credenciales Supabase y MP de prueba.
2. Login como cliente → agregar producto → checkout → elegir "Mercado Pago" → "PAGAR CON MERCADO PAGO".
3. Debe redirigir a `init_point` de MP (sandbox).
4. Pagar con tarjeta de prueba de MP (ver documentación de tarjetas de prueba de MP).
5. Verificar que MP envía webhook → el pedido pasa a `confirmado` (paid) y el stock se descuenta definitivamente.
6. Probar rechazo/cancelación → pedido `cancelado` y stock liberado.

### Paso E — Mejoras de código recomendadas (no bloqueantes)
1. **Payer email**: en `preferences/route.ts`, el `payerEmail` se deja `undefined`. Pasar el email del pedido (`order.ship_recipient_email` o del cliente) para pre-llenar el checkout de MP.
2. **Verificar firma obligatoria**: hoy si `MERCADOPAGO_WEBHOOK_SECRET` no está definido, el webhook procesa sin validar firma. En producción debe ser obligatorio (fail closed): rechazar con 401 si falta el secret.
3. **Idempotencia robusta**: `markProcessed` inserta con `user_id` fijo UUID cero. Verificar que la tabla `idempotency_keys` permita ese valor (o usar el `user_id` real del pedido).
4. **Resultado page**: revisar `src/app/checkout/resultado/page.tsx` para que muestre estado real consultando el pedido (no solo query params).
5. **Stock**: confirmar que la creación del pedido ya reserva stock (`stockReserved`) y que el webhook de `approved` no lo vuelva a descontar (evitar doble descuento). Revisar `release_order_stock` RPC y `orderAtomic`.

## 5. Checklist de "terminado"

- [ ] Credenciales de prueba cargadas en `.env.local`.
- [ ] `NEXT_PUBLIC_SITE_URL` apunta a URL pública HTTPS (o túnel en dev).
- [ ] Creación de preferencia funciona (devuelve `init_point`).
- [ ] Redirección a MP sandbox funciona.
- [ ] Pago aprobado con tarjeta de prueba → webhook recibido → pedido `confirmado`.
- [ ] Pago rechazado → pedido `cancelado` + stock liberado.
- [ ] Firma de webhook validada (rechaza requests sin firma válida).
- [ ] Prueba con credenciales de producción antes de lanzar.

## 6. Riesgos / bloqueos actuales

- Sin `MERCADOPAGO_ACCESS_TOKEN`, `createMPClient()` lanza y el endpoint devuelve 500.
- Sin `MERCADOPAGO_WEBHOOK_SECRET`, el webhook acepta cualquier request (riesgo de seguridad) — corregir en Paso E.2 antes de producción.
- El webhook no valida que el `payment.external_reference` corresponda a un pedido cuyo `payment_method = mercado_pago` antes de actualizar (validación parcial). Reforzar.
- El `notification_url` usa `NEXT_PUBLIC_SITE_URL`; si es localhost en prod, MP no podrá entregar webhooks.
