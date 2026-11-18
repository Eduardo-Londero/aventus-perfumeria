# Informe Comercial — Aventus Perfumería (Tienda Online)

> Documento listo para presentar a clientes/potenciales compradores. Todos los datos reflejan el estado real del proyecto al 01/11/2026.

## 1. Resumen ejecutivo

**Aventus Perfumería** es un desarrollo web completo de **tienda online para perfumerías**, construido con tecnologías modernas (Next.js 15, React 18, TypeScript, Tailwind CSS). Permite exhibir el catálogo, gestionar carrito y pedidos, administrar productos e inventario y operar un panel de control centralizado, con una base técnica probada (230 pruebas unitarias + 6 E2E, lint y build en verde).

Se comercializa como **desarrollo terminado y adaptable** a cualquier perfumería: el código se personaliza con marca, colores, textos, catálogo, datos de contacto y políticas de envío del negocio.

---

## 2. Problema que resuelve

Una perfumería necesita exhibir sus productos, recibir pedidos y administrar stock y ventas sin depender de redes sociales o mensajes dispersos. Aventus ofrece una **tienda propia, controlada por el negocio**, con administración centralizada de catálogo, pedidos e inventario, y una experiencia de compra clara para el cliente final.

---

## 3. Para quién está pensado

- Perfumerías con catálogo de fragancias por marca, género y categoría.
- Negocios que quieren vender online con retiro en local y/o envío a domicilio.
- Comercios que buscan un panel simple para gestionar productos, stock y pedidos sin depender de terceros.

---

## 4. Funcionalidades para el cliente (tienda pública)

- **Inicio configurable**: secciones, banners y destacados editables desde el panel.
- **Catálogo de perfumes**: búsqueda, filtros (marca, género, categoría, ofertas) y orden.
- **Ficha de producto**: imágenes, precio, disponibilidad/stock y descripción.
- **Carrito**: cantidades con límite por stock, persistencia local entre sesiones.
- **Checkout**: datos del comprador, método de entrega (retiro/envío), cálculo de importes y revalidación de stock/precio.
- **Favoritos**: guardar productos para más tarde.
- **Marcas y ofertas**: páginas dedicadas para explorar por marca y promociones.
- **Páginas institucionales**: nosotros, contacto, FAQ, términos, privacidad, devoluciones y arrepentimiento.
- **Cuenta de cliente**: registro/login, mi cuenta y mis pedidos.
- **Contacto directo**: WhatsApp, teléfono, email, dirección y horarios de las sucursales.
- **SEO base**: metadata, sitemap, robots, manifest e iconos; rutas privadas marcadas como noindex.

---

## 5. Funcionalidades del administrador (panel `/admin`)

Acceso protegido por autenticación server-side (cookie firmada HMAC-SHA256, 8 horas).

- **Dashboard**: KPIs de ventas, ticket promedio, stock bajo y evolución diaria.
- **Productos**: crear/editar/eliminar, precio, stock, imágenes, marca, género, categoría.
- **Categorías y subcategorías**: gestión completa.
- **Marcas**: CRUD de marcas.
- **Géneros**: gestión de géneros (hombre/mujer/unisex, etc.).
- **Banners y secciones de inicio**: configurar el home.
- **Pedidos**: listado, cambio de estado con transiciones controladas, liberación de stock al cancelar.
- **Clientes**: listado de clientes.
- **Configuración general**: datos del negocio.
- **Contacto**: datos de contacto públicos.
- **Nosotros**: contenido institucional.
- **Contenido**: textos e imágenes institucionales.

---

## 6. Reglas de negocio centralizadas (fuente única de verdad)

Para evitar inconsistencias, la lógica está centralizada y probada:

| Módulo | Responsabilidad |
|---|---|
| `src/lib/pricing.ts` | subtotal, envío, total, límite de stock, revalidación de stock/precio |
| `src/lib/metrics.ts` | qué estados cuentan como venta, ticket promedio, stock bajo, evolución diaria |
| `src/lib/orderStatus.ts` | transiciones permitidas de pedidos (máquina de estados) |
| `src/lib/inventory.ts` | reserva y liberación de stock |

Ninguna vista reimplementa estas reglas.

---

## 7. Seguridad

- Acceso a `/admin` **no** depende de controles visuales: validación server-side de `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- Cookie `httpOnly` firmada con HMAC-SHA256, 8 horas de vigencia.
- Middleware server-side verifica firma y expiración antes de servir cualquier ruta `/admin`; sin cookie válida redirige a `/login`.
- **Fail closed**: sin variables configuradas el endpoint responde `503` y el panel queda inaccesible.
- Límite de intentos por IP (10/minuto) en el login.
- Sin credenciales embebidas en el bundle del navegador.
- Rutas privadas (cuenta, pedidos, favoritos) marcadas `noindex`.

---

## 8. Calidad y pruebas

- **TypeScript strict** sin errores.
- **ESLint** sin errores ni advertencias.
- **230 pruebas unitarias** (Vitest): importes/envíos, stock, firma de sesión, KPIs, transiciones de pedidos, mapeos y sincronización.
- **6 pruebas E2E** (Playwright), incluyendo móvil 390×844.
- **Build de producción exitoso** (`npm run build`).
- Suite verificada: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` en verde.

---

## 9. Stack tecnológico

| Área | Tecnología |
|---|---|
| Framework | Next.js 15.5 (App Router) |
| UI | React 18.3 + Tailwind CSS 3.4 |
| Tipos | TypeScript 5 (strict) |
| Pruebas | Vitest + Playwright |
| Lint | ESLint + `next/core-web-vitals` |
| Datos hoy | `localStorage` (`src/lib/db.ts`) con seed automático |
| Datos futuros | Supabase/PostgreSQL (migraciones preparadas) |
| Imágenes | Unsplash (placeholder) + `sharp` |

---

## 10. Personalización por negocio

Totalmente adaptable sin reescribir la app:

- Marca, logo, colores y textos.
- Catálogo, categorías, marcas, géneros y productos.
- Datos de contacto, WhatsApp, redes sociales y dirección (incluye múltiples sucursales).
- Políticas de envío y umbrales de envío gratis.
- Contenido institucional y banners del home.
- Dominio y hosting elegidos por el cliente.
- Servicios externos (Supabase, Mercado Pago, email, OAuth) opcionales.

La configuración central vive en `src/config/site.ts`, pensada para edición simple.

---

## 11. Lo que se puede demostrar hoy

- Catálogo, fichas de producto, búsqueda/filtros.
- Carrito con límites por stock.
- Checkout (retiro en local) con reserva de stock.
- Cancelación de pedido con liberación de stock.
- Panel admin completo (CRUD, pedidos, dashboard).
- Inventario y KPIs.
- Pruebas automatizadas y build exitoso.

---

## 12. Lo que requiere configuración antes de producción (transparencia)

Para ser un negocio operativo real, faltan (no incluidos por defecto, cotizables por separado):

- **Persistencia compartida**: activar Supabase (migraciones preparadas, no aplicadas; requiere autorización).
- **Pagos online**: Mercado Pago (deshabilitado; pendiente de credenciales).
- **Email transaccional**: recuperación de contraseña y notificaciones (simulado hoy).
- **Google OAuth**: botón presente, no implementado.
- **Contenido e imágenes definitivos** del negocio.
- **Despliegue publicado** (dominio + hosting).
- **Verificación visual/estética** manual.

Hoy los pagos se resuelven por **transferencia bancaria y efectivo**, con confirmación por WhatsApp.

---

## 13. Ventajas de una tienda propia

- Identidad de marca propia.
- Control total del catálogo y precios.
- Historial de pedidos administrable.
- Escalabilidad para agregar pagos, backend compartido y notificaciones.
- Base preparada para personalización por cliente.
- Sin dependencia de marketplaces ni comisiones por venta.

---

## 14. Paquete de entrega sugerido

1. Código fuente completo.
2. Panel administrativo.
3. Documentación técnica y de entrega.
4. Pruebas automatizadas.
5. Guía de configuración de servicios.
6. Lista de tareas para producción.
7. `.env.example` con variables requeridas.
8. Checklist de entrega.
9. Capacitación básica del panel (opcional).

**No incluido por defecto**: costos de hosting, dominio, Supabase, Mercado Pago o email; contenido, imágenes y datos del negocio; diseño gráfico original (logo, fotografía profesional); soporte ilimitado post-entrega (salvo acuerdo).

---

## 15. Propuesta de cotización (importes editables)

| Concepto | Descripción | Importe (editable) |
|---|---|---|
| Desarrollo y entrega de la web | Código completo + documentación | [COMPLETAR] |
| Personalización de marca | Logo, colores, textos, configuración inicial | [COMPLETAR] |
| Configuración de dominio y hosting | Asistencia técnica para publicar | [COMPLETAR] |
| Configuración de backend y base de datos | Activación Supabase + migraciones + validación | [COMPLETAR] |
| Integración de Mercado Pago | Preferencias, webhook, pruebas | [COMPLETAR] |
| Configuración de emails | Proveedor + plantillas + pruebas | [COMPLETAR] |
| Mantenimiento y futuras modificaciones | Bolsa de horas / soporte | [COMPLETAR] |

**Condiciones sugeridas**: pago inicial para reserva/configuración; pago final contra entrega y pruebas; cambios de alcance cotizados por separado; servicios externos a cargo del cliente.

---

## 16. Responsabilidades

**Cliente**: proveer credenciales y cuentas de servicios externos; definir catálogo, precios, envíos y políticas; proveer imágenes y textos definitivos; aprobar despliegue y configuración de producción.

**Desarrollador/entrega**: entregar código y documentación; asistir en configuración inicial; ejecutar pruebas y validar build; capacitar en uso del panel (si se acuerda); no activar servicios remotos sin autorización.

---

## 17. Próximos pasos

1. Definir alcance y personalización con el cliente.
2. Configurar marca, catálogo y datos de contacto.
3. (Opcional) Activar Supabase, Mercado Pago y email.
4. Cargar contenido e imágenes reales.
5. Verificación visual y pruebas.
6. Despliegue y entrega con capacitación.
