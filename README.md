# Aventus Perfumería — Tienda Online

Tienda online premium para perfumería, construida con Next.js (App Router),
TypeScript y Tailwind CSS.

## 🚀 Comandos

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Iniciar producción
npm start

# Lint (ESLint vía next lint)
npm run lint

# Pruebas unitarias (Vitest)
npm test

# Pruebas en modo watch
npm run test:watch
```

Requisitos: Node.js 20+ y npm 10+.

## 🧱 Stack

| Área | Tecnología |
| --- | --- |
| Framework | Next.js 15.5 (App Router) |
| UI | React 18.3 + Tailwind CSS 3.4 |
| Tipos | TypeScript 5 (strict) |
| Pruebas | Vitest 5 |
| Lint | ESLint + `next/core-web-vitals` (`.eslintrc.json`) |
| Datos hoy | `localStorage` (`src/lib/db.ts`) |
| Datos futuros | Supabase/PostgreSQL (migraciones en `supabase/`, sin aplicar) |

## 📁 Estructura del proyecto

```
src/
├── app/                    # Rutas (App Router)
│   ├── admin/              # Panel administrativo
│   ├── api/auth/           # Login/logout server-side del panel
│   ├── checkout/           # Checkout
│   ├── marcas/ ofertas/    # Marcas y ofertas
│   ├── perfumes/           # Catálogo y detalle
│   ├── faq/ contacto/      # Contenido público
│   ├── mi-cuenta/ mi-pedidos/ favoritos/   # Zona privada (noindex)
│   ├── login/ registro/ recuperar-password/
│   ├── layout.tsx          # Layout raíz + metadata
│   ├── middleware.ts       # Guardia server-side de /admin
│   ├── sitemap.ts robots.ts manifest.ts
│   └── page.tsx            # Home
├── components/             # Componentes React (cart, layout, products, ui)
├── config/site.ts          # Datos configurables del negocio
├── context/                # Providers: Auth, Cart, Orders, Favorites, Toast
├── data/                   # Catálogo inicial (mock)
├── lib/
│   ├── db.ts               # Capa de datos (localStorage)
│   ├── pricing.ts          # Motor de importes (fuente única de verdad)
│   ├── metrics.ts          # KPIs del panel
│   ├── orderStatus.ts      # Máquina de estados de pedidos
│   └── session.ts          # Cookie firmada del panel (solo servidor)
└── types/                  # index.ts (app) y domain.ts (esquema Supabase)
```

## 🔐 Seguridad del panel administrativo

El acceso a `/admin` NO depende de controles visuales:

1. `POST /api/auth/admin-login` valida `ADMIN_EMAIL` y `ADMIN_PASSWORD`
   **solo en el servidor** y emite una cookie `httpOnly` firmada con HMAC-SHA256
   (8 horas de vigencia).
2. `src/middleware.ts` verifica la firma y la expiración **antes** de servir
   cualquier ruta `/admin`; sin cookie válida redirige a `/login`.
3. Sin variables configuradas el endpoint responde `503` y el panel queda
   inaccesible a propósito (*fail closed*).
4. Hay límite de intentos por IP (10/minuto) en el login.

Requiere definir (ver `.env.example`):

```bash
ADMIN_EMAIL=tu-email
ADMIN_PASSWORD=contrasena-larga-y-unica   # mínimo 8 caracteres
```

> Las credenciales ya no se embeben en el bundle del navegador. Si cambiás
> `ADMIN_PASSWORD`, la sesión vigente deja de ser válida.

**Alcance:** esto protege el acceso a las rutas. Las mutaciones de datos se
guardan localmente en el navegador hasta la migración a Supabase, donde el
aislamiento real lo aportarán RLS + privilegios.

## 🧮 Reglas de negocio centralizadas

| Módulo | Responsabilidad |
| --- | --- |
| `src/lib/pricing.ts` | subtotal, envío, total, límite de stock, revalidación de stock |
| `src/lib/metrics.ts` | qué estados cuentan como venta, ticket promedio, stock bajo, evolución diaria |
| `src/lib/orderStatus.ts` | transiciones permitidas de pedidos (máquina de estados) |

Ninguna vista debe reimplementar estas reglas.

**Envíos (provisional, pendiente de confirmación comercial):** retiro en local
$0; envío a domicilio con costo por defecto y umbral de envío gratis, ambos
configurables en `src/config/site.ts` → `shipping`.

## 🧪 Pruebas

`npm test` ejecuta suites unitarias de:

- cálculo de importes y envíos (`pricing.test.ts`)
- límite de stock y revalidación en checkout (`pricing.test.ts`)
- firma/verificación de la sesión del panel (`session.test.ts`)
- KPIs y exclusiones de ventas (`metrics.test.ts`)
- transiciones de estado de pedidos (`orderStatus.test.ts`)

## 🔌 Integraciones

- **Pagos:** transferencia bancaria y efectivo (flujo de confirmación por
  WhatsApp). Mercado Pago está **deshabilitado** y pendiente de credenciales:
  ver informe final.
- **Supabase:** migraciones `0001` (aplicada remotamente) y `0002`/`0003`
  (preparadas localmente, **sin aplicar**). Requieren autorización explícita y
  un preflight de solo lectura antes de cualquier aplicación remota.

## 📝 Notas

- Los productos actuales son datos de prueba (mock) e imágenes de Unsplash.
- El contenido de FAQ es provisional pendiente de confirmación.
- WhatsApp, Instagram y dirección se configuran en `src/config/site.ts`.
- Variables de entorno: copiar `.env.example` a `.env.local` (no se versiona).
