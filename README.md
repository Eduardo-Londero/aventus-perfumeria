# Aventus Perfumería — Tienda Online

Tienda online premium para perfumería, construida con Next.js, TypeScript y Tailwind CSS.

## 🚀 Comandos

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Iniciar producción
npm start

# Lint
npm run lint
```

## 📁 Estructura del proyecto

```
src/
├── app/                    # Páginas (App Router)
│   ├── admin/              # Panel administrativo
│   ├── checkout/           # Checkout
│   ├── marcas/             # Marcas
│   ├── ofertas/            # Ofertas
│   ├── perfumes/           # Catálogo y detalle
│   ├── faq/                # Preguntas frecuentes
│   ├── layout.tsx          # Layout principal
│   └── page.tsx            # Home
├── components/             # Componentes React
│   ├── cart/               # Carrito
│   ├── layout/             # Header, Footer
│   ├── products/           # ProductCard, ProductGrid, etc.
│   └── ui/                 # Button, Modal, Input, etc.
├── config/                 # Configuración central
│   └── site.ts             # Todos los datos configurables
├── context/                # Context providers
│   ├── CartContext.tsx
│   ├── FavoritesContext.tsx
│   └── ToastContext.tsx
├── data/                   # Datos (mock)
│   ├── products.ts
│   ├── brands.ts
│   ├── categories.ts
│   └── faqs.ts
└── types/                  # Tipos TypeScript
    └── index.ts
```

## ⚙️ Configuración

Todos los datos del negocio (WhatsApp, Instagram, dirección, horarios, etc.) se configuran en:

```
src/config/site.ts
```

## 🔄 Preparado para integraciones futuras

- Pagos online (Mercado Pago, transferencia)
- Base de datos (Supabase/PostgreSQL)
- Autenticación
- Panel administrativo real
- Cálculo de envíos
- Newsletter
- Google Analytics / Meta Pixel

## 📝 Notas

- Los productos actuales son datos de prueba (mock)
- Las imágenes son placeholders de Unsplash
- El contenido de FAQ es provisional pendiente de confirmación
- WhatsApp, Instagram y dirección deben configurarse en `src/config/site.ts`
