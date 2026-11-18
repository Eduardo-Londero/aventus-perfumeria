# Guía de Entrega al Cliente — Aventus Perfumería

## A. Listo para entregar como proyecto

- Código fuente completo (Next.js 15.5, React 18, TypeScript, Tailwind).
- Panel administrativo protegido por autenticación server-side.
- CRUD de productos, marcas, categorías, géneros, banners y contenido.
- Carrito, checkout, pedidos e inventario con pruebas automatizadas.
- Suite de pruebas: 230 unitarias + 6 E2E + lint + tsc + build en verde.
- Documentación base: README, `.env.example`, docs de Supabase y Mercado Pago.

## B. Listo para publicar en un entorno real

- Build de producción exitoso (`npm run build`).
- Variables de entorno documentadas (sin secretos).
- Procedimiento de despliegue y rollback documentado.
- SEO base (metadata, sitemap, robots, manifest).
- Responsive funcional verificado por E2E (390×844).

## C. Listo para recibir compras y pagos reales

- **No listo todavía.**
- Persistencia compartida (Supabase) no activada.
- Mercado Pago no implementado (sin credenciales).
- Email transaccional no implementado.
- Contenido e imágenes reales no cargados.

## D. Pendiente de información o autorización del propietario

- Autorización para aplicar migraciones Supabase `0002/0003` y `negative_tests.sql`.
- Credenciales de Mercado Pago (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`) + URL pública.
- Credenciales de email y Google OAuth (si se usa).
- Datos comerciales reales (contacto, WhatsApp, dirección, horarios, envíos, políticas).
- Imágenes y textos definitivos.
- Decisión comercial de umbrales de envío.

## Instalación rápida

```bash
npm install
cp .env.example .env.local   # completar ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev
```

## Comandos de calidad

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

## Limitaciones conocidas

- Los datos viven en el navegador (`localStorage`) hasta activar Supabase.
- Mercado Pago deshabilitado; pagos por transferencia/efectivo vía WhatsApp.
- Recuperación de contraseña y Google OAuth simulados.
- Imágenes de demostración (Unsplash) y catálogo de prueba.
- Configuración de envíos provisoria en `src/config/site.ts`.
- Verificación visual/estética con navegador de escritorio pendiente.

## Checklist de entrega al comprador

- [ ] `npm install` ejecutado sin errores.
- [ ] `.env.local` configurado con credenciales propias.
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` en verde.
- [ ] `npm run test:e2e` en verde (requiere `ADMIN_EMAIL`/`ADMIN_PASSWORD`).
- [ ] Catálogo de prueba reemplazado por datos reales.
- [ ] Imágenes propias cargadas.
- [ ] Datos de contacto actualizados en `src/config/site.ts`.
- [ ] Políticas de envío y devoluciones definidas.
- [ ] Decisión sobre Supabase/Mercado Pago documentada.
