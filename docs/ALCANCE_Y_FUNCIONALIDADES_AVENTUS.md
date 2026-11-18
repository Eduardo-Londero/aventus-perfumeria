# Alcance y Funcionalidades — Aventus Perfumería

## Incluido en el desarrollo actual

### Tienda pública
- Inicio con secciones configurables.
- Catálogo de perfumes con búsqueda, filtros y orden.
- Detalle de producto con imágenes, precio y stock.
- Favoritos.
- Carrito con límite por stock y persistencia local.
- Checkout con datos del comprador, método de entrega y cálculo de importes.
- Páginas: nosotros, contacto, FAQ, marcas, ofertas.

### Panel administrativo
- Login server-side con cookie firmada.
- Dashboard con KPIs.
- Productos: crear/editar/eliminar, precio, stock, imágenes.
- Categorías, subcategorías, marcas, géneros.
- Banners y secciones de inicio.
- Pedidos con estados controlados y liberación de stock.
- Clientes.
- Configuración y contenido institucional/contacto.

### Reglas de negocio centralizadas
- `src/lib/pricing.ts`: subtotal, envío, total, límite de stock, revalidación.
- `src/lib/metrics.ts`: ventas confirmadas, ticket promedio, stock bajo.
- `src/lib/orderStatus.ts`: transiciones de pedidos.
- `src/lib/inventory.ts`: reserva/liberación de stock.

### Calidad y seguridad
- TypeScript strict sin errores.
- ESLint sin errores/advertencias.
- 230 tests unitarios.
- 6 tests E2E (incluye móvil 390×844).
- Build exitoso.
- Panel admin protegido por middleware server-side.
- Sin credenciales en bundle.

## No incluido / pendiente de configuración

- Persistencia compartida (Supabase) no activada.
- Mercado Pago no implementado (sin credenciales).
- Email transaccional no implementado.
- Google OAuth no implementado.
- Contenido e imágenes definitivos no cargados.
- Despliegue no realizado.

## Dependencias externas

- Node.js 20+ y npm 10+.
- Supabase (opcional para producción compartida).
- Mercado Pago (opcional para pagos online).
- Proveedor de email (opcional).
- Dominio y hosting.
- Imágenes y textos del negocio.

## Responsabilidades del cliente

- Proveer credenciales y cuentas de servicios externos.
- Definir catálogo, precios, envíos y políticas.
- Proveer imágenes y textos definitivos.
- Aprobar despliegue y configuración de producción.

## Responsabilidades del desarrollador/entrega

- Entregar código y documentación.
- Asistir en configuración inicial.
- Ejecutar pruebas y validar build.
- Capacitar en uso del panel (si se acuerda).
- No activar servicios remotos sin autorización.
