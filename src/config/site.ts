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
    number: "5493412755009",
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
    branches: [
      {
        name: "Sucursal 1",
        address: "San Martín 629 (Galería Gran Vía, Local 34)",
        city: "San Miguel de Tucumán",
        phone: "Teléfono (pendiente)",
        hours: [
          { days: "Lunes a Sábado", hours: "9:00 – 21:00 hs (horario corrido)" },
        ],
        mapsUrl: "https://maps.google.com/?q=San+Martín+629+San+Miguel+de+Tucumán",
      },
      {
        name: "Sucursal 2",
        address: "Buenos Aires 61 (Galería Mercado Showroom, Isla 3)",
        city: "San Miguel de Tucumán",
        phone: "Teléfono (pendiente)",
        hours: [
          { days: "Lunes a Sábado", hours: "9:00 – 13:00 hs y 17:00 – 21:00 hs" },
        ],
        mapsUrl: "https://maps.google.com/?q=Buenos+Aires+61+San+Miguel+de+Tucumán",
      },
    ],
    // Compatibilidad con código existente que espera un solo local
    address: "San Martín 629 (Galería Gran Vía, Local 34) / Buenos Aires 61 (Galería Mercado Showroom, Isla 3)",
    city: "San Miguel de Tucumán",
    phone: "Teléfono (pendiente)",
    hours: [
      { days: "Sucursal 1 — Lunes a Sábado", hours: "9:00 – 21:00 hs" },
      { days: "Sucursal 2 — Lunes a Sábado", hours: "9:00 – 13:00 y 17:00 – 21:00 hs" },
    ],
    // URL para "Cómo llegar" en Google Maps
    mapsUrl: "https://maps.google.com/?q=San+Martín+629+San+Miguel+de+Tucumán",
  },

  // Moneda
  currency: {
    symbol: "$",
    locale: "es-AR",
    name: "ARS",
  },

  // Envíos
  shipping: {
    freeThreshold: 200000,
    defaultCost: 2500,
    methods: [
      { id: "retiro", name: "Retiro en local", cost: 0 },
      { id: "envio", name: "Envío a domicilio", cost: 2500 },
    ],
  },

  // Métodos de pago (preparado para futura integración)
  paymentMethods: [
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
