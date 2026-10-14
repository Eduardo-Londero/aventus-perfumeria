/**
 * Datos de marcas
 * =============
 * Las marcas ahora se gestionan dinámicamente desde Admin → Marcas.
 * Este archivo se mantiene como fallback para cuando no hay marcas en la BD.
 *
 * Las imágenes usan placeholders de Unsplash preparados para
 * ser reemplazados por fotos reales de cada marca.
 */

import { Brand } from "@/types";

const BRAND_IMAGE_BASE = "https://images.unsplash.com/";

export const brands: Brand[] = [
  {
    id: "dior",
    slug: "dior",
    name: "Dior",
    description:
      "La maison francesa que redefine el lujo desde 1946. Sus fragancias son sinónimo de elegancia atemporal, desde la frescura magnética de Sauvage hasta la sofisticación de J'adore.",
    image: `${BRAND_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
    isActive: true,
    order: 1,
  },
  {
    id: "carolina-herrera",
    slug: "carolina-herrera",
    name: "Carolina Herrera",
    description:
      "Sofisticación neoyorquina con alma latina. Desde el icónico Good Girl hasta la refinada Carolina Herrera, cada fragancia es una declaración de estilo y feminidad moderna.",
    image: `${BRAND_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
    isActive: true,
    order: 2,
  },
  {
    id: "paco-rabanne",
    slug: "paco-rabanne",
    name: "Paco Rabanne",
    description:
      "Audacia y vanguardia en cada creación. Paco Rompulle las convenciones con fragancias como 1 Million e Invictus que celebran el éxito y la energía masculina.",
    image: `${BRAND_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    isActive: true,
    order: 3,
  },
  {
    id: "jean-paul-gaultier",
    slug: "jean-paul-gaultier",
    name: "Jean Paul Gaultier",
    description:
      "El enfant terrible de la alta costura francesa. Sus perfumes desafían lo establecido con creaciones icónicas como Le Male y Classique, siempre con un toque irreverente y sensual.",
    image: `${BRAND_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    isActive: true,
    order: 4,
  },
  {
    id: "armani",
    slug: "armani",
    name: "Armani",
    description:
      "Elegancia discreta y refinamiento italiano. Giorgio Armani crea fragancias que son pura sofisticación, desde la frescura mediterránea de Acqua di Giò hasta la intensidad de Sí.",
    image: `${BRAND_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
    isActive: true,
    order: 5,
  },
  {
    id: "versace",
    slug: "versace",
    name: "Versace",
    description:
      "Opulencia mediterránea en estado puro. Versace combina lujo, sensualidad y arte en fragancias como Eros y Versace, reflejando el espíritu audaz de la casa italiana.",
    image: `${BRAND_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    isActive: true,
    order: 6,
  },
  {
    id: "ysl",
    slug: "ysl",
    name: "Yves Saint Laurent",
    description:
      "Revolución y elegancia desde 1961. YSL captura la esencia de la mujer moderna con audaz fragancias como Libre y Black Opium que no temen ser protagonistas.",
    image: `${BRAND_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    isActive: true,
    order: 7,
  },
  {
    id: "chanel",
    slug: "chanel",
    name: "Chanel",
    description:
      "El epítome del lujo francés. Desde el legendario N°5 hasta Bleu de Chanel, cada creación es un testimonio de la perfección artesanal y la visión de Gabrielle Chanel.",
    image: `${BRAND_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    isActive: true,
    order: 8,
  },
  {
    id: "hermes",
    slug: "hermes",
    name: "Hermès",
    description:
      "Artesanía y excelencia desde 1837. Hermès crea fragancias que cuentan historias, como Terre d'Hermès, una oda a los elementos naturales con refinamiento inigualable.",
    image: `${BRAND_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    isActive: true,
    order: 9,
  },
  {
    id: "jimmy-choo",
    slug: "jimmy-choo",
    name: "Jimmy Choo",
    description:
      "Glamour y sofisticación contemporánea. Jimmy Choo se inspira en el mundo de la alta costura para crear fragancias que celebran el estilo y la confianza de la mujer moderna.",
    image: `${BRAND_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
    isActive: true,
    order: 10,
  },
  {
    id: "viktor-rolf",
    slug: "viktor-rolf",
    name: "Viktor & Rolf",
    description:
      "El arte conceptual aplicado a la perfumería. El dúo neerlandés crea experiencias olfativas memorables como Flowerbomb y Spicebomb que desafían todas las convenciones.",
    image: `${BRAND_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    isActive: true,
    order: 11,
  },
  {
    id: "creed",
    slug: "creed",
    name: "Creed",
    description:
      "La casa de perfumería más exclusiva del mundo, fundada en 1760. Cada fragancia, como el legendario Aventus, se elabora artesanalmente siguiendo recetas centenarias.",
    image: `${BRAND_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
    isActive: true,
    order: 12,
  },
  {
    id: "maison-francis-kurkdjian",
    slug: "maison-francis-kurkdjian",
    name: "Maison Francis Kurkdjian",
    description:
      "La perfumería de autor en su máxima expresión. El maestro perfumista Francis Kurkdjian crea obras maestras como Baccarat Rouge 540 que redefinen el lujo contemporáneo.",
    image: `${BRAND_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    isActive: true,
    order: 13,
  },
];

export const getBrandBySlug = (slug: string): Brand | undefined => {
  return brands.find((b) => b.slug === slug);
};
