# Migraciones — AVT-DOM-2026-01 (F1)

**REV-009:** ABIERTO. **Fase:** F1 autorizada el 16/10/2026.
**ENTORNO PERMITIDO:** exclusivamente proyecto Supabase de desarrollo o staging
verificado como no productivo. PROHIBIDO en producción.

> **ESTADO (actualizado en P1.3.37):**
> - `0001_schema_core.sql`: **APLICADA y verificada** en el proyecto
>   `xpphnsozqnajfxjqvtci` (P1.3.32–P1.3.33): 14 tablas, RLS activo en 14/14,
>   sin datos.
> - `0002` y `0003`: **NO APLICADAS.** Auditadas en P1.3.34–P1.3.36 y
>   corregidas localmente en P1.3.37 (parche de privilegios añadido a 0002;
>   semilla de `store_settings` eliminada de 0003). Su aplicación remota
>   requiere autorización expresa y un procedimiento transaccional (plan en
>   P1.3.36 §6). Ejecutarlas y documentar sus resultados (pruebas N-*) es
>   condición de aceptación de F1.

## Orden de aplicación

| # | Archivo | Contenido | Depende de |
|---|---------|-----------|------------|
| 1 | `20261016_0001_schema_core.sql` | 14 tablas, índices, checks de integridad e importes en centavos | — |
| 2 | `20261016_0002_rls_policies.sql` | RLS habilitado en todas las tablas; políticas default-deny; parche de privilegios mínimo (`GRANT`/`REVOKE`, P1.3.37) | 0001 |
| 3 | `20261016_0003_functions_roles.sql` | `is_admin`, triggers anti-cambio-de-rol y append-only, `admin_promote_user` (sin seed de `store_settings`: eliminada en P1.3.37; tabla inicia vacía) | 0001, 0002 |

## Reversión

Cada migración tiene su par `*.down.sql`, ejecutable en orden inverso
(0003 → 0002 → 0001). La reversión destruye datos; en entornos con datos
reales aplicar la estrategia `_new` + migración de P1.3.7 §11.

> **⚠ Asimetría de seguridad (documentada en P1.3.37 §4 — NO modificada):**
> el parche de privilegios de `0002` no está reflejado en
> `0002.down.sql`. Ejecutar ese down tras aplicar el parche dejaría las
> tablas con RLS **deshabilitado** y los `GRANT`/`REVOKE` **intactos**, lo
> que otorgaría a `anon`/`authenticated` acceso directo a tablas sin
> filtrado (un estado peor que el original previo a F1). Tratamiento
> propuesto para una reversión futura (NO implementado, requiere
> autorización): revertir primero los privilegios (bloque `REVOKE`
> equivalente a los `GRANT` concedidos, o restaurar el ACL por defecto
> `Dxtm`) y solo después ejecutar los `DROP POLICY`/`ALTER TABLE ... NO
> FORCE RLS`; nunca deshabilitar RLS con privilegios de aplicación
> presentes. Los `.down.sql` no se modificaron en P1.3.37 (fuera del
> alcance autorizado: inspección únicamente).

## Invariantes de seguridad (a verificar con las pruebas N-*)

1. Todas las tablas con RLS activo; sin política = acceso denegado.
2. Sin políticas de INSERT/UPDATE/DELETE de cliente sobre `orders`,
   `order_items`, `idempotency_keys`, `payment_events`, `audit_log`.
3. Funciones `SECURITY DEFINER` (`is_admin`, `admin_promote_user`):
   `OWNER TO service_role` (aplicado por la migración con verificación de
   existencia del rol) y `SET search_path = ''`. Funciones trigger
   (`set_updated_at`, `prevent_role_change`, `audit_log_append_only`):
   `SECURITY INVOKER` (corrección D-1/D-3 de P1.3.23).
4. `admin_promote_user`: EXECUTE solo `service_role`.
5. Ningún `GRANT` a `authenticated`/`anon` que permita escribir pedidos,
   claves de idempotencia, eventos de pago o auditoría.
6. Trigger `prevent_role_change` (invoker) impide cambiar `profiles.role`
   salvo cuando la operación corre como `service_role`
   (es decir, vía `admin_promote_user`).
7. Privilegios de aplicación default-deny (parche P1.3.37 en `0002`):
   `GRANT` mínimos y revisados caso por caso, con `UPDATE` column-level en
   `profiles` (sin `role`) y `INSERT`/`UPDATE` column-level en `addresses`
   (sin `id` ni `created_at`); sin `ALTER DEFAULT PRIVILEGES`; cualquier
   tabla nueva requerirá revisión de privilegios antes de conceder nada.
8. `store_settings` es legible públicamente (política `using (true)`): NUNCA
   almacenará en `value` credenciales, tokens, claves de API ni datos
   personales; solo configuración de envío/tienda no sensible.

## Fuera del alcance de F1 (fases posteriores con autorización)

- RPC `create_order_atomic` y liberación/restock de stock (F3).
- Semilla del catálogo de 20 productos (F2/F3 según plan).
- Trigger de creación de perfiles en `auth.users` (decisión pendiente,
  recomendación técnica en P1.3.36 §E.5).
- Configuración real de envío en `store_settings` (umbral, tarifa, zonas y
  transportistas: Correo Argentino / Andreani / OCA por evaluar) cargada
  desde administración cuando exista ese flujo.
- Cualquier integración de Mercado Pago (F4, postergada por decisión R3).
