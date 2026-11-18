# Plan Final de Lanzamiento — Aventus Perfumería

**Fecha:** 01/11/2026
**Base:** `docs/AUDITORIA_FINAL_ESTADO_AVENTUS.md`, `docs/INFORME_FINAL_INTEGRAL.md`, `docs/TRANSICION_SUPABASE.md`, `docs/MERCADO_PAGO.md`

## A. Obligatorio antes de entregar el proyecto

| Tarea | Estado | Prioridad | Archivos | Dependencias | Criterio de aceptación | Intervención propietario |
|---|---|---|---|---|---|---|
| README e instrucciones de instalación | Implementado | P0 | `README.md`, `.env.example` | Ninguna | Build/test/e2e pasan siguiendo README | No |
| Variables de entorno documentadas | Implementado | P0 | `.env.example` | Ninguna | `.env.local` no versionado | No |
| Procedimiento de despliegue | Implementado | P0 | `docs/INFORME_FINAL_INTEGRAL.md` §13 | Ninguna | Checklist reproducible | No |
| Procedimiento de rollback | Implementado | P0 | `docs/TRANSICION_SUPABASE.md` | Ninguna | Documentado, sin `.down.sql` remoto | No |
| Configuración inicial de admin | Implementado | P0 | `src/app/api/auth/*`, `src/middleware.ts` | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Login real verificado (13/13 + E2E) | Sí (credenciales) |
| Lista de servicios a contratar | Documentado | P1 | `docs/INFORME_FINAL_INTEGRAL.md` §9 | Ninguna | Listado completo | Sí |
| Limitaciones conocidas | Documentado | P1 | `docs/*` | Ninguna | Documentado | No |

## B. Obligatorio antes de aceptar compras reales

| Tarea | Estado | Prioridad | Archivos | Dependencias | Criterio de aceptación | Intervención propietario |
|---|---|---|---|---|---|---|
| Persistencia centralizada (Supabase) | Pendiente de autorización | P0 | `src/lib/db.ts`, `src/lib/dbDriver.ts`, `supabase/migrations/*` | Autorización explícita + `pg_dump` | Activar flag tras aplicar 0002/0003 y negative tests | Sí |
| Autenticación y autorización real | Parcial | P0 | `src/context/AuthContext.tsx` | Supabase Auth | Usuarios reales, no localStorage | Sí (credenciales) |
| Productos/categorías/inventario | Parcial (local) | P0 | `src/lib/db.ts`, `src/lib/inventory.ts` | Supabase | Datos compartidos y consistentes | Sí |
| Pedidos | Implementado local | P0 | `src/lib/db.ts`, `src/lib/orderStatus.ts` | Supabase | Reserva/liberación verificada E2E | Sí |
| Seguridad de base y RLS | Pendiente de autorización | P0 | `supabase/migrations/20261016_0002_rls_policies.sql` | Autorización | RLS activo con políticas | Sí |
| Pagos (Mercado Pago) | No implementado | P0 | `docs/MERCADO_PAGO.md` | Credenciales MP + URL pública | Preferencia server-side + webhook verificado | Sí |
| Pruebas de integración | Parcial | P1 | `src/lib/*test.ts`, `e2e/store.spec.ts` | Supabase real | Tests contra backend real | Sí |
| Respaldo y recuperación | Documentado | P1 | `docs/TRANSICION_SUPABASE.md` | Acceso remoto | Procedimiento validado | Sí |
| Procedimiento de despliegue/reversión | Implementado | P1 | docs | Ninguna | Documentado | No |

## C. Necesario para publicar profesionalmente

| Tarea | Estado | Prioridad | Archivos | Dependencias | Criterio de aceptación | Intervención propietario |
|---|---|---|---|---|---|---|
| SEO metadata/OG/sitemap/robots | Implementado (base) | P1 | `src/app/layout.tsx`, `src/app/sitemap.ts`, layouts | Dominio real | Verificar dominio canónico y OG image | Sí |
| Responsive | Parcial (funcional E2E) | P1 | componentes UI | Ninguna | Sin overflow horizontal en 320–1440 | No |
| Contenido e imágenes reales | Pendiente | P1 | `src/config/site.ts`, `src/data/*` | Material del negocio | Reemplazar mocks/Unsplash | Sí |
| Configuración comercial (envíos) | Parcial | P1 | `src/config/site.ts`, admin/configuración | Decisión comercial | Umbrales reales persistidos | Sí |
| Accesibilidad básica | Parcial | P2 | componentes UI | Ninguna | Teclado, labels, contraste | No |
| Verificación visual | Pendiente | P2 | N/A | Navegador de escritorio | Revisión manual | No |

## D. Mejoras futuras

| Tarea | Estado | Prioridad | Archivos | Dependencias | Criterio de aceptación | Intervención propietario |
|---|---|---|---|---|---|---|
| Google OAuth | No implementado | P3 | `src/app/login/page.tsx`, `src/app/registro/page.tsx` | Credenciales Google | Login social funcional | Sí |
| Email transaccional | No implementado | P3 (P1 si ventas) | N/A | Proveedor SMTP | Envío real de confirmaciones | Sí |
| Zonas de envío | No implementado | P3 | checkout/admin | Decisión comercial | Reglas por zona | Sí |
| Upgrade Next 16 | Evaluado, no ejecutado | P3 | `package.json`, middleware | Fase dedicada | Build/tests/E2E en verde | No |
| Rate-limit persistente | Mejora | P3 | admin-login | Redis/DB | Rate-limit compartido | Sí |
| Revocación de sesiones | Mejora | P3 | `src/lib/session.ts` | Backend | Revocación server-side | No |

## Estados utilizados

- Implementado: existe y verificado por tests/build.
- Probado localmente: ejecutado en entorno local.
- Probado en integración: verificado contra servicio real.
- Pendiente de configuración externa: requiere credenciales/servicios.
- Pendiente de autorización: requiere aprobación explícita.
- No implementado: ausente.

## Veredicto actual

El proyecto está listo para **entrega como proyecto** con instrucciones, pero **no está listo para aceptar compras reales** hasta completar backend persistente, pagos y email. El camino más corto: autorizar Supabase (0002/0003 + negative tests), crear credenciales de prueba de Mercado Pago y cargar contenido real.
