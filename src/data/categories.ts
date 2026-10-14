/**
 * Datos mock de categorías
 * ========================
 * Categorías de prueba para visualizar correctamente la tienda.
 * Para reemplazarlas por datos reales, modificá este archivo
 * o conectá una base de datos real.
 *
 * Las imágenes usan placeholders de Unsplash preparados para
 * ser reemplazados por fotos reales de cada categoría.
 */

import { Category } from "@/types";

const CATEGORY_IMAGE_BASE = "https://images.unsplash.com/";

export const categories: Category[] = [
  {
    id: "1",
    slug: "hombres",
    name: "Hombres",
    description:
      "Descubrí nuestra colección de fragancias masculinas. Desde frescura mediterránea hasta intensos aromas amaderados, encontrá el perfume que refleje tu personalidad y estilo.",
    image: `${CATEGORY_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    isActive: true,
    order: 1,
  },
  {
    id: "2",
    slug: "mujeres",
    name: "Mujeres",
    description:
      "Explorá nuestra selección de perfumes femeninos. Elegancia, sensualidad y sofisticación en cada fragancia, desde las clásicas flores orientales hasta las modernas creaciones gourmand.",
    image: `${CATEGORY_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
    isActive: true,
    order: 2,
  },
  {
    id: "3",
    slug: "unisex",
    name: "Unisex",
    description:
      "Fragancias que trascienden géneros. Perfumes versátiles y contemporáneos diseñados para quienes no siguen reglas y buscan una firma olfativa única y personal.",
    image: `${CATEGORY_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    isActive: true,
    order: 3,
  },
  {
    id: "4",
    slug: "nuevos-ingresos",
    name: "Nuevos ingresos",
    description:
      "Las últimas novedades en perfumería acabaron de llegar. Descubrí las fragancias más recientes de las marcas más exclusivas antes que nadie.",
    image: `${CATEGORY_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
    isActive: true,
    order: 4,
  },
  {
    id: "5",
    slug: "ofertas",
    name: "Ofertas",
    description:
      "Aprovechá descuentos exclusivos en perfumes seleccionados. Lujo accesible por tiempo limitado — encontrá fragancias de primera calidad a precios especiales.",
    image: `${CATEGORY_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    isActive: true,
    order: 5,
  },
];

export const getCategoryBySlug = (slug: string): Category | undefined => {
  return categories.find((c) => c.slug === slug);
};
