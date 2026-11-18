# Mercado Pago — estado, credenciales requeridas y diseño de integración

> **Estado (verificado 2026-10-18):** la integración real **NO está implementada
> ni probada**, porque **no existen credenciales** en el entorno. No se agregó
> código especulativo de Mercado Pago, según el criterio de esta fase.

---

## 1. Qué se verificó y qué falta

Verificación sobre `.env.local` (presencia de claves, sin imprimir valores):

| Variable | Estado |
|---|---|
| `MP_ACCESS_TOKEN` | **ausente** |
| `MP_PUBLIC_KEY` | **ausente** |
| `MP_WEBHOOK_SECRET` | **ausente** |

Conclusión: no es posible crear preferencias reales, validar pagos ni verificar
firmas de webhooks. Todo lo que dependa de Mercado Pago queda **bloqueado por
credenciales**, no por código.

### Para desbloquear se necesita (cuenta de Mercado Pago)

1. **Access Token de prueba** (`MP_ACCESS_TOKEN`) desde
   Tu cuenta → Desarrolladores → Credenciales de prueba.
2. **Public Key de prueba** (`MP_PUBLIC_KEY`) — misma pantalla.
3. **Webhook Secret** (`MP_WEBHOOK_SECRET`) — al crear una *webhook subscription*
   en el panel de desarrolladores (se usa para validar la cabecera
   `x-signature`).
4. **URL pública** para recibir webhooks (dominio con HTTPS o túnel tipo ngrok
   en desarrollo) y registrarla en la suscripción de webhooks de
   `https://<dominio>/api/webhooks/mercadopago`.
5. Definir en el panel si se usa **Checkout Pro** (redirección a Mercado Pago)
   o **Checkout API** (tarjeta en sitio). Recomendado para este proyecto:
   **Checkout Pro** menos exposición de datos de tarjeta.

> Solo con 1 y 2 es posible probar la creación de preferencias; con 3 y 4 es
> posible validar pagos entrantes de verdad.

## 2. Diseño previsto (cuando haya credenciales)

Piezas ya contempladas por la base de datos remota (verificada 2026-10-18):
tablas `payment_events` (eventos crudos, reintentables) e `idempotency_keys`
(claves de idempotencia) existen desde la migración `0001`.

1. **Creación de preferencia (server-side)**
   `POST /api/mercadopago/preferences`
   - Reconstruye el carrito **en el servidor** desde el catálogo (precios,
     stock y total se recalculan aquí; nunca se confía el importe enviado por
     el navegador).
   - Crea la preferencia con `MP_ACCESS_TOKEN` y devuelve `init_point`.
   - Registra la orden en estado `no-concretado` con su reserva de stock
     (ya implementada en `dbOrders.create`).
2. **Webhook**
   `POST /api/webhooks/mercadopago`
   - Valida `x-signature` (HMAC-SHA256 con `MP_WEBHOOK_SECRET` sobre el
     `data.id` + manifest) **antes** de leer el cuerpo.
   - Consulta el pago en la API con el Access Token (fuente de verdad = MP,
     no el webhook).
   - Idempotencia con `idempotency_keys`: el mismo `payment_id` no puede
     aplicarse dos veces.
   - Inserta el evento crudo en `payment_events`; en `approved` → transición
     `confirmado`; en `rejected`/`cancelled` → liberación de stock por la
     máquina de estados existente.
3. **Retorno del navegador (back_url)**
   - Es **solo informativo**: redirige a `/checkout/estado?order=AV-XXXX`.
   - **Jamás** marca un pedido como pagado por sí solo (criterio fijo de esta
     fase): sin webhook ni consulta a la API, el pedido queda `no-concretado`.
4. **Seguridad**
   - Secretos solo en servidor (`route.ts`), nunca `NEXT_PUBLIC_*`.
   - Todas las respuestas del webhook responden 200 rápido y procesan
     de forma asíncrona/consistente para soportar reintentos de MP.
   - Sin importes arbitrarios desde el cliente; sin estados “pagado” escritos
     desde el frontend.

## 3. Qué se puede hacer hoy (sin credenciales)

- ✅ Diseño, contratos de API, tablas de soporte (`payment_events`,
  `idempotency_keys`) y máquina de estados de pedidos (ya implementada y
  probada).
- ✅ Pruebas unitarias de la lógica de importes (ya cubiertas en
  `src/lib/pricing.test.ts`).
- ❌ Cualquier prueba real de pago (crear preferencia, webhook, firma).

## 4. Siguiente acción concreta

**Crear credenciales de prueba de Mercado Pago y cargar
`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` y `MP_WEBHOOK_SECRET` en `.env.local`**
(más una URL pública para webhooks). Hasta entonces este bloque sigue
documentado como pendiente de credenciales.
