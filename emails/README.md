# Plantillas de email — Aventus Perfumería

Plantillas HTML premium para los correos transaccionales de Supabase Auth.
Están listas para pegar en el Dashboard de Supabase.

## Dónde pegarlas

Supabase Dashboard → **Authentication → Email Templates**. Cada archivo
corresponde a una pestaña:

| Archivo | Pestaña del Dashboard | Asunto sugerido |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `Confirmá tu cuenta en Aventus Perfumería` |
| `reset-password.html` | Reset password | `Restablecé tu contraseña — Aventus Perfumería` |
| `magic-link.html` | Magic Link | `Tu enlace de acceso — Aventus Perfumería` |
| `change-email.html` | Change Email Address | `Confirmá tu nuevo email — Aventus Perfumería` |

Pasos: abrí la pestaña → pegá el HTML completo en el editor → guardá.
El asunto se configura en el campo "Subject" de esa misma pestaña.

## Variables dinámicas de Supabase (no tocar)

Las plantillas usan las variables oficiales de Go templates de Supabase:

- `{{ .ConfirmationURL }}` — enlace de confirmación / recuperación.
- `{{ .Email }}` — email del usuario (disponible si lo necesitás).
- `{{ .Token }}` / `{{ .TokenHash }}` — OTP (no usado acá, pero disponible).
- `{{ .SiteURL }}` — URL del sitio configurada en el Dashboard.
- `{{ .RedirectTo }}` — URL de redirección.
- `{{ .Data.name }}`, `{{ .Data.lastName }}` — metadatos del registro (los envía `AuthContext.register`).

## Identidad visual (compartida por todas las plantillas)

- Fondo exterior: marfil `#faf9f6`.
- Tarjeta: blanco `#ffffff` con borde fino `#e8e4dc`.
- Texto principal: `#1a1a1a` · secundario: `#6b6b6b`.
- Acento dorado: `#b8956a` (líneas, enlaces, etiquetas).
- Tipografía de títulos: Georgia / Times New Roman (serif) con letter-spacing.
- Tipografía de cuerpo: Helvetica / Arial (sans-serif).
- Botón principal: negro `#1a1a1a` con texto blanco en mayúsculas y letter-spacing.
- Estructura: tablas + estilos inline (compatible con Gmail, Outlook, Apple Mail).
- Ancho máximo 600 px, responsive.

## Compatibilidad

- HTML compatible con clientes de correo (tablas, estilos inline, sin CSS externo).
- Imágenes: no se usan imágenes externas en estas plantillas (solo tipografía y color),
  para evitar bloqueos de imágenes y dependencias de hosting. Si más adelante querés
  agregar el logo como imagen, subilo a Supabase Storage (bucket `imagenes`) y
  reemplazá el wordmark tipográfico por un `<img>` con `alt="Aventus Perfumería"`.

## Alcance

Estas plantillas cubren los correos que la aplicación envía hoy (todos vía
Supabase Auth): confirmación de cuenta, recuperación de contraseña, enlace mágico
y cambio de email.

Los correos de pedidos (recibido, confirmado, despachado, entregado, cancelado,
reembolso) **no existen todavía** en la app: las confirmaciones de compra se
envían por WhatsApp. Si querés añadir emails transaccionales de pedidos, es una
feature nueva (proveedor + Route Handlers + templates), no un rediseño.

## Nota importante

- No modifiques las variables `{{ ... }}`: son las que Supabase reemplaza.
- Si cambiás el SMTP (Resend/SendGrid/Postmark), las plantillas siguen funcionando
  porque viven en Supabase Auth, no en el proveedor.