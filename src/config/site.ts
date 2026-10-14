/**
 * Configuración central de Aventus Perfumería
 * =============================================
 * Este archivo contiene todos los datos configurables del sitio.
 * Para personalizar la web, simplemente modificá este archivo.
 */

export const siteConfig = {
  // Información del negocio
  name: "Aventus Perfumería",
  shortName: "Aventus",
  tagline: "Fragancias que te representan",
  description:
    "Perfumes originales y seleccionados para quienes buscan una fragancia que los represente.",

  // Contacto
  whatsapp: {
    // Número de WhatsApp con código de país, sin "+" ni espacios
    // Ejemplo: "5491123456789" para Argentina
    number: "5491123456789",
    message: "Hola Aventus Perfumería, quería hacer una consulta.",
  },
  contact: {
    email: "info@aventus.com",
    phone: "11 2345-6789",
  },

  // Redes sociales
  instagram: {
    username: "@aventus.perfumeria",
    url: "https://instagram.com/aventus.perfumeria",
  },

  // Local físico
  store: {
    address: "Dirección del local (pendiente de configuración)",
    city: "Ciudad (pendiente)",
    phone: "Teléfono (pendiente)",
    hours: [
      { days: "Lunes a Viernes", hours: "10:00 – 20:00" },
      { days: "Sábados", hours: "10:00 – 14:00" },
      { days: "Domingos", hours: "Cerrado" },
    ],
    // URL para "Cómo llegar" en Google Maps
    mapsUrl: "https://maps.google.com/?q=Argentina",
  },

  // Moneda
  currency: {
    symbol: "$",
    locale: "es-AR",
    name: "ARS",
  },

  // Envíos
  shipping: {
    freeThreshold: 50000,
    defaultCost: 2500,
    methods: [
      { id: "retiro", name: "Retiro en local", cost: 0 },
      { id: "envio", name: "Envío a domicilio", cost: 2500 },
    ],
  },

  // Métodos de pago (preparado para futura integración)
  paymentMethods: [
    { id: "mercadopago", name: "Mercado Pago", enabled: false },
    { id: "transferencia", name: "Transferencia bancaria", enabled: true },
    { id: "efectivo", name: "Efectivo en el local", enabled: true },
  ],
} as const;

// Helper para generar URLs de WhatsApp
export const generateWhatsAppUrl = (message: string): string => {
  return `https://wa.me/${siteConfig.whatsapp.number}?text=${encodeURIComponent(message)}`;
};

// Helper para formatear precios
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat(siteConfig.currency.locale, {
    style: "currency",
    currency: siteConfig.currency.name,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};
