/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.supabase.co https://api.mercadopago.com https://*.mercadopago.com; frame-src https://*.mercadopago.com;",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Desactivada en producción (Vercel): con `unoptimized` Next entrega el
    // archivo tal cual, sin cobrar transformaciones. Vercel incluye solo
    // 5.000 imágenes/mes y cada 1.000 extra sale ~US$0.05 (facturación
    // impredecible = contrario a "deployar y olvidarse").
    // No hace daño en calidad: el pipeline de subida ya guarda TODO en
    // WebP q80 ≤1400px (src/app/api/upload) y las semillas usan Unsplash
    // con `?w=…` ya acotado. Para reactivarla, basta con quitar esta línea.
    unoptimized: true,
    // Lo siguiente solo aplica si se reactiva la optimización:
    formats: ['image/avif', 'image/webp'],
    // Variantes de ancho generadas: se limitan a las que realmente usa la
    // tienda para no llenar la caché de tamaños inútiles.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    // Caché de imágenes optimizadas: 30 días (evita re-procesar en cada request).
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
