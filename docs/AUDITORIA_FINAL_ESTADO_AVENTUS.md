# Auditoría Final de Estado — Aventus Perfumería

**Fecha:** 01/11/2026 (auditoría actual)
**HEAD de Git:** `master @ f1ddeb3` (sin commits nuevos en esta sesión)
**Estado del árbol:** cambios preexistentes preservados; no se ejecutaron operaciones remotas ni commits.

---

## 1. Estado real del proyecto

Aventus es una tienda Next.js 15.5 (App Router) + React 18 + TypeScript + Tailwind 3.4, con:

- Catálogo público, detalle, búsqueda/filtros, favoritos, carrito, checkout, cuenta, pedidos, admin completo.
- Persistencia actual: `localStorage` del navegador (`src/lib/db.ts`), con seed automático.
- Backend Supabase/PostgreSQL preparado pero **no activado** (`NEXT_PUBLIC_DATA_BACKEND` por defecto `localStorage`).
- Pagos: transferencia/efectivo por WhatsApp; Mercado Pago deshabilitado.
- Autenticación de panel: server-side con cookie HMAC httpOnly.
- Suite: 230 unitarias + 6 E2E + lint + tsc + build en verde.

Verificación realizada en esta sesión:

- `npm test` → 19 archivos, 230 tests PASS.
- `npm run lint` → 0 warnings/errors.
- `npx tsc --noEmit` → 0 errores.
- `npm run build` → exit 0.
- `npm run test:e2e` → 6/6 PASS.

---

## 2. Funcionalidades terminadas

- Catálogo, detalle, búsqueda, filtros, orden, paginación.
- Carrito con límite de stock y persistencia.
- Checkout con revalidación de stock/precio y reserva de stock.
- Cancelación de pedido con liberación de stock (idempotente).
- Panel admin protegido server-side, CRUD productos/marcas/categorías/géneros/banners/contenido/configuración/contacto/nosotros.
- Dashboard con KPIs y transiciones de pedidos validadas.
- SEO base: metadata, sitemap, robots, manifest, icon, noindex en rutas privadas.
- Motor centralizado de precios (`src/lib/pricing.ts`), métricas (`src/lib/metrics.ts`), transiciones (`src/lib/orderStatus.ts`), inventario (`src/lib/inventory.ts`).

---

## 3. Funcionalidades parcialmente implementadas

- Configuración de envíos: formularios existen, pero las reglas no se persisten hacia el motor de precios (R-6).
- Recuperación de contraseña: simulada, no envía email.
- Google OAuth: botón con `alert` y TODO.
- Zonas/envíos por dirección: no implementadas.
- Verificación visual/estética: no realizada con navegador de escritorio.
- Migración Supabase: preparada, no activada.

---

## 4. Funcionalidades ausentes

- Pagos online (Mercado Pago) — bloqueado por credenciales.
- Backend persistente compartido (Supabase no activado).
- Email transaccional.
- Imágenes y contenido real de negocio.
- Despliegue publicado.

---

## 5. Errores reproducibles

No se detectaron errores de compilación, lint, tests ni build en el estado actual. Los defectos históricos (stock, transiciones, race del carrito, manejo de errores checkout) figuran corregidos y verificados por E2E.

---

## 6. Riesgos de seguridad

| ID | Severidad | Hallazgo | Evidencia | Acción |
|---|---|---|---|---|
| S-R1 | Alto | Datos viven en `localStorage`: sin autorización server-side para mutaciones | `src/lib/db.ts`, `src/lib/dbDriver.ts` | Activar Supabase con RLS (pendiente autorización) |
| S-R2 | Medio | Rate-limit en memoria (10/min/IP) se reinicia con el proceso | `src/app/api/auth/admin-login/route.ts` | Persistir si hay tráfico real |
| S-R3 | Medio | Sesión admin TTL 8h sin revocación server-side | `src/lib/session.ts` | Rotar credenciales para revocar |
| S-R4 | Bajo | Cuenta demo de cliente (`cliente123`) en código | `src/context/AuthContext.tsx` (histórico) | Eliminar al conectar Supabase Auth |
| S-R5 | Bajo | `postcss` advisories high resolubles solo con Next 16 | `npm audit` | Upgrade a Next 16 como fase dedicada |

---

## 7. Riesgos de pérdida de datos

- Al cambiar de navegador/dispositivo se pierde el catálogo editado, pedidos y configuración (R-1).
- No existe respaldo automático del `localStorage` del navegador.
- Importación/exportación disponible (`src/lib/exportData.ts`) pero manual.

---

## 8. Problemas que impiden una entrega comercial

Para **Scenario A (entregar proyecto a cliente)**: ninguno bloqueante local; faltan instrucciones y configuración externa.

Para **Scenario B (tienda operativa real)**:
- Backend compartido (Supabase) no activado.
- Pagos online no implementados.
- Email transaccional ausente.
- Contenido/imágenes reales no cargados.
- Verificación visual pendiente.

---

## 9. Funcionalidades que pueden posponerse (P3)

- Google OAuth.
- Zonas de envío avanzadas.
- Upgrade a Next 16.
- Verificación visual/estética manual.
- Optimización de performance avanzada.

---

## 10. Plan de finalización ordenado por prioridad

1. **P0 — Bloqueantes:** activar backend real (requiere autorización), implementar Mercado Pago (requiere credenciales), email transaccional.
2. **P1 — Importantes:** configuración de envíos persistente, recuperación de contraseña real, contenido real, verificación visual.
3. **P2 — Mejoras:** rate-limit persistente, revocación de sesiones, sanitización adicional.
4. **P3 — Futuro:** OAuth, zonas, Next 16, performance.

Cada hallazgo incluye archivo/componente, evidencia y acción propuesta cuando corresponde (ver secciones anteriores).
