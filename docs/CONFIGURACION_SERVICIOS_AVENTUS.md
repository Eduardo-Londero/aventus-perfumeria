# Configuración de Servicios Externos — Aventus Perfumería

## Supabase (persistencia compartida)
- **Función:** base de datos centralizada, autenticación, autorización (RLS).
- **Configuración:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_DATA_BACKEND=supabase`.
- **Dónde:** `.env.local` y proveedor de despliegue.
- **Pruebas:** aplicar `0002/0003` + `negative_tests.sql` en transacción con `ROLLBACK` previo; verificar RLS; ejecutar `npm run test:e2e`.
- **Qué no funciona mientras esté pendiente:** datos compartidos entre dispositivos, pedidos centralizados, aislamiento por roles.

## Mercado Pago (pagos online)
- **Función:** procesamiento de pagos y webhooks.
- **Configuración:** `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, URL pública para webhook.
- **Dónde:** `.env.local` y panel de Mercado Pago.
- **Pruebas:** preferencia creada en servidor, webhook con firma verificada, idempotencia, estados pending/approved/rejected.
- **Qué no funciona mientras esté pendiente:** cobro online; solo transferencia/efectivo por WhatsApp.

## Servicio de correo
- **Función:** confirmación de pedidos, recuperación de contraseña.
- **Configuración:** proveedor SMTP/API + credenciales.
- **Dónde:** variables de entorno y código de notificaciones.
- **Pruebas:** envío real de correo de prueba.
- **Qué no funciona mientras esté pendiente:** recuperación de contraseña y notificaciones por email.

## Google OAuth (opcional)
- **Función:** login social.
- **Configuración:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Dónde:** `.env.local` y consola de Google.
- **Pruebas:** flujo de login social completo.
- **Qué no funciona mientras esté pendiente:** botón de Google con `alert`/TODO.

## Dominio y despliegue
- **Función:** publicación y HTTPS.
- **Configuración:** dominio, DNS, variables en el host.
- **Dónde:** proveedor de hosting.
- **Pruebas:** smoke test post-deploy (rutas públicas 200, `/admin` sin cookie 307, login real 200).
- **Qué no funciona mientras esté pendiente:** acceso público estable.

## Políticas de envío
- **Función:** costos y reglas de entrega.
- **Configuración:** `src/config/site.ts` (`shipping`) y/o `store_settings`.
- **Dónde:** código/configuración.
- **Pruebas:** checkout recalcula envío según método elegido.
- **Qué no funciona mientras esté pendiente:** tarifas definitivas (hoy provisorias).

## Contenido e imágenes definitivos
- **Función:** presentación comercial real.
- **Configuración:** `src/data/*`, `src/config/site.ts`, panel admin.
- **Dónde:** código y panel.
- **Pruebas:** revisión visual y SEO.
- **Qué no funciona mientras esté pendiente:** identidad real de la marca.
