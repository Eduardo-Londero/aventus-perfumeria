/**
 * Datos mock de productos
 * ========================
 * Estos son productos de prueba para visualizar correctamente la tienda.
 * Para reemplazarlos por productos reales, modificá este archivo
 * o conectá una base de datos real.
 *
 * Las imágenes usan placeholders elegantes preparados para ser reemplazados
 * por fotos reales de cada perfume.
 */

import { Product } from "@/types";

const PRODUCT_IMAGE_BASE = "https://images.unsplash.com/";

export const products: Product[] = [
  {
    id: "1",
    slug: "dior-sauvage-edt-100",
    brand: "dior",
    name: "Sauvage",
    description:
      "Una fragancia salvaje y noble, inspirada en los paisajes desérticos al atardecer.",
    longDescription:
      "Sauvage de Dior es una composición poderosa y fresca que combina la bergamota de Calabria con pimienta de Sichuan y notas amaderadas. Una fragancia magnética que evoca la libertad y la elegancia masculina.",
    price: 145000,
    previousPrice: 165000,
    discount: 12,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    ],
    categories: ["hombre", "nuevos-ingresos", "ofertas"],
    gender: "hombre",
    size: "100 ml",
    concentration: "Eau de Toilette",
    olfactoryFamily: "Amaderado Aromático",
    notes: {
      top: ["Bergamota de Calabria", "Pimienta de Sichuan"],
      heart: ["Lavanda", "Elemi", "Pimienta rosa"],
      base: ["Ambroxan", "Cedro", "Vainilla"],
    },
    stock: 8,
    featured: true,
    isActive: true,
    isOnSale: true,
    isNew: false,
    createdAt: "2024-01-15",
    soldCount: 45,
  },
  {
    id: "2",
    slug: "dior-sauvage-edp-100",
    brand: "dior",
    name: "Sauvage Eau de Parfum",
    description:
      "Una versión más intensa y profunda del icónico Sauvage, con notas orientales.",
    longDescription:
      "La versión Eau de Parfum de Sauvage intensifica la bergamota con notas de lavanda y un corazón especiado. Una fragancia más adictiva y envolvente, perfecta para la noche.",
    price: 165000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
    ],
    categories: ["hombre"],
    gender: "hombre",
    size: "100 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Amaderado Especiado",
    notes: {
      top: ["Bergamota", "Pimienta de Sichuan"],
      heart: ["Lavanda", "Nuez moscada"],
      base: ["Almizcle", "Ámbar gris"],
    },
    stock: 5,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2024-01-10",
    soldCount: 38,
  },
  {
    id: "3",
    slug: "carolina-herrera-good-girl-80",
    brand: "carolina-herrera",
    name: "Good Girl",
    description:
      "Un icono de la feminidad moderna, con contrastes entre dulzura y oscuridad.",
    longDescription:
      "Good Girl es una fragancia audaz que celebra la dualidad de la mujer moderna. La delicadeza de la flor de azahar se encuentra con la intensidad del cacao y el café, creando un contraste irresistible.",
    price: 135000,
    previousPrice: 155000,
    discount: 13,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    ],
    categories: ["mujer", "nuevos-ingresos", "ofertas"],
    gender: "mujer",
    size: "80 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Floral Oriental",
    notes: {
      top: ["Almendra", "Café", "Bergamota"],
      heart: ["Azahar", "Jazmín sambac", "Rosa"],
      base: ["Cacao", "Tonka", "Vainilla"],
    },
    stock: 12,
    featured: true,
    isActive: true,
    isOnSale: true,
    isNew: false,
    createdAt: "2024-02-01",
    soldCount: 52,
  },
  {
    id: "4",
    slug: "paco-rabanne-1-million-100",
    brand: "paco-rabanne",
    name: "1 Million",
    description:
      "El símbolo definitivo del lujo y el éxito masculino, con notas orientales especiadas.",
    longDescription:
      "1 Million es una fragancia que celebra el poder y la ambición. Sus notas de cuero, canela y mandarina crean una firma olfativa inconfundible que no pasa desapercibida.",
    price: 128000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    ],
    categories: ["hombre"],
    gender: "hombre",
    size: "100 ml",
    concentration: "Eau de Toilette",
    olfactoryFamily: "Amaderado Especiado",
    notes: {
      top: ["Mandarina", "Pimienta rosa"],
      heart: ["Canela", "Rosa"],
      base: ["Cuero", "Ámbar", "Madera"],
    },
    stock: 15,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2024-01-20",
    soldCount: 67,
  },
  {
    id: "5",
    slug: "jean-paul-gaultier-le-male-125",
    brand: "jean-paul-gaultier",
    name: "Le Male",
    description:
      "Un clásico irresistible con notas de lavanda, menta y vainilla.",
    longDescription:
      "Le Male es una fragancia que reinterpreta la elegancia masculina con un toque de sensualidad. La frescura de la lavanda se combina con la calidez de la vainilla y el hinojo.",
    price: 118000,
    previousPrice: 138000,
    discount: 14,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    ],
    categories: ["hombre", "ofertas"],
    gender: "hombre",
    size: "125 ml",
    concentration: "Eau de Toilette",
    olfactoryFamily: "Amaderado Aromático",
    notes: {
      top: ["Menta", "Artemisa", "Bergamota"],
      heart: ["Lavanda", "Cilantro", "Canela"],
      base: ["Vainilla", "Hinojo", "Sándalo"],
    },
    stock: 6,
    featured: false,
    isActive: true,
    isOnSale: true,
    isNew: false,
    createdAt: "2024-02-10",
    soldCount: 41,
  },
  {
    id: "6",
    slug: "armani-si-eau-de-parfum-100",
    brand: "armani",
    name: "Sí",
    description:
      "Un tributo a la mujer moderna y segura de sí misma.",
    longDescription:
      "Sí de Giorgio Armani es una fragancia elegante y sofisticada que combina la grosella negra con la rosa y el almizcle. Una declaración de carácter y feminidad.",
    price: 142000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
    ],
    categories: ["mujer"],
    gender: "mujer",
    size: "100 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Floral Frutal",
    notes: {
      top: ["Grosella negra", "Mandarina"],
      heart: ["Rosa de mayo", "Freesia"],
      base: ["Vainilla", "Almizcle", "Madera"],
    },
    stock: 9,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: true,
    createdAt: "2024-03-01",
    soldCount: 28,
  },
  {
    id: "7",
    slug: "versace-eros-100",
    brand: "versace",
    name: "Eros",
    description:
      "La pasión y el deseo encapsulados en una fragancia intensa y vibrante.",
    longDescription:
      "Eros es una fragancia intensa inspirada en el dios griego del amor. Combina menta, manzana verde y tonka con un corazón de rosa y un fondo de madera de cedro y vetiver.",
    price: 112000,
    previousPrice: 135000,
    discount: 17,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    ],
    categories: ["hombre", "ofertas"],
    gender: "hombre",
    size: "100 ml",
    concentration: "Eau de Toilette",
    olfactoryFamily: "Amaderado Aromático",
    notes: {
      top: ["Menta", "Manzana verde", "Limón"],
      heart: ["Tonka", "Rosa", "Geranio"],
      base: ["Cedro", "Vetiver", "Vainilla"],
    },
    stock: 11,
    featured: false,
    isActive: true,
    isOnSale: true,
    isNew: false,
    createdAt: "2024-02-15",
    soldCount: 33,
  },
  {
    id: "8",
    slug: "ysl-libre-90",
    brand: "ysl",
    name: "Libre",
    description:
      "La libertad olfativa en su máxima expresión, con lavanda y vainilla.",
    longDescription:
      "Libre es un homenaje a la libertad. La lavanda francesa se encuentra con la mandarina, el azahar y la vainilla de Madagascar en una fragancia audaz y moderna.",
    price: 148000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
    ],
    categories: ["mujer"],
    gender: "mujer",
    size: "90 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Floral Oriental",
    notes: {
      top: ["Lavanda", "Mandarina", "Bergamota"],
      heart: ["Azahar", "Jazmín"],
      base: ["Vainilla", "Almizcle", "Madera"],
    },
    stock: 7,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: true,
    createdAt: "2024-03-05",
    soldCount: 22,
  },
  {
    id: "9",
    slug: "bleu-de-chanel-100",
    brand: "chanel",
    name: "Bleu de Chanel",
    description:
      "Elegancia atemporal con notas cítricas, amaderadas y especiadas.",
    longDescription:
      "Bleu de Chanel es una fragancia de carácter que combina la frescura del pomelo y la menta con la profundidad del sándalo y el cedro. Sofisticación sin esfuerzo.",
    price: 175000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
    ],
    categories: ["unisex"],
    gender: "unisex",
    size: "100 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Amaderado Aromático",
    notes: {
      top: ["Pomelo", "Menta", "Pimienta rosa"],
      heart: ["Jengibre", "Nuez moscada", "Jazmín"],
      base: ["Sándalo", "Cedro", "Incienzo"],
    },
    stock: 4,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2024-01-05",
    soldCount: 58,
  },
  {
    id: "10",
    slug: "la-vie-est-belle-75",
    brand: "lancome",
    name: "La Vie Est Belle",
    description:
      "La belleza de la vida capturada en una fragancia dulce y envolvente.",
    longDescription:
      "La Vie Est Belle es una fragancia que celebra la alegría de vivir. El iris se encuentra con la pralín, la vainilla y la crema de avellana en un perfume adictivo y memorable.",
    price: 132000,
    previousPrice: 152000,
    discount: 13,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    ],
    categories: ["mujer", "ofertas"],
    gender: "mujer",
    size: "75 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Floral Gourmand",
    notes: {
      top: ["Grosella negra", "Pera"],
      heart: ["Iris", "Jazmín", "Flor de azahar"],
      base: ["Pralín", "Vainilla", "Crema de avellana"],
    },
    stock: 10,
    featured: false,
    isActive: true,
    isOnSale: true,
    isNew: false,
    createdAt: "2024-02-20",
    soldCount: 36,
  },
  {
    id: "11",
    slug: "terre-dhermes-100",
    brand: "hermes",
    name: "Terre d'Hermès",
    description:
      "Una oda a la tierra y los elementos, con naranja, pimienta y vetiver.",
    longDescription:
      "Terre d'Hermès es una fragancia mineral y amaderada que evoca los elementos naturales. La naranja, la pimienta y el vetiver se combinan en una composición terrosa y sofisticada.",
    price: 158000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    ],
    categories: ["hombre"],
    gender: "hombre",
    size: "100 ml",
    concentration: "Eau de Toilette",
    olfactoryFamily: "Amaderado Terroso",
    notes: {
      top: ["Naranja", "Pimienta", "Pomelo"],
      heart: ["Geranio", "Pimienta rosa"],
      base: ["Vetiver", "Cedro", "Benzoin"],
    },
    stock: 3,
    featured: false,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2024-01-25",
    soldCount: 19,
  },
  {
    id: "12",
    slug: "black-opium-90",
    brand: "ysl",
    name: "Black Opium",
    description:
      "La adrenalina de la noche en una fragancia adictiva de café y vainilla.",
    longDescription:
      "Black Opium es una fragancia eléctrica y misteriosa. El café se encuentra con la vainilla y el azahar en una combinación adictiva que captura la energía nocturna.",
    price: 142000,
    previousPrice: 168000,
    discount: 15,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
    ],
    categories: ["mujer", "ofertas"],
    gender: "mujer",
    size: "90 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Floral Oriental",
    notes: {
      top: ["Pimienta rosa", "Naranja", "Pera"],
      heart: ["Café", "Azahar", "Jazmín"],
      base: ["Vainilla", "Cedro", "Almizcle"],
    },
    stock: 8,
    featured: false,
    isActive: true,
    isOnSale: true,
    isNew: false,
    createdAt: "2024-02-25",
    soldCount: 44,
  },
  {
    id: "13",
    slug: "acqua-di-gio-100",
    brand: "armani",
    name: "Acqua di Giò",
    description:
      "La frescura del Mediterráneo en una fragancia atemporal y elegante.",
    longDescription:
      "Acqua di Giò es el aroma del mar Mediterráneo. Notas marinas, bergamota y romero se combinan con un corazón de jazmín y un fondo amaderado. Una fragancia fresca y sofisticada.",
    price: 138000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    ],
    categories: ["hombre"],
    gender: "hombre",
    size: "100 ml",
    concentration: "Eau de Toilette",
    olfactoryFamily: "Aromático Acuático",
    notes: {
      top: ["Bergamota", "Neroli", "Limón"],
      heart: ["Jazmín", "Romero", "Ciprés"],
      base: ["Almizcle", "Cedro", "Ámbar"],
    },
    stock: 14,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2024-01-30",
    soldCount: 49,
  },
  {
    id: "14",
    slug: "jimmy-choo-100",
    brand: "jimmy-choo",
    name: "Jimmy Choo Eau de Parfum",
    description:
      "Glamour y sofisticación en una fragancia frutal y amaderada.",
    longDescription:
      "Jimmy Choo es una fragancia glamorosa que combina pera, melón y rosa con un fondo de parcheli y caramelo. Elegancia con un toque moderno y atrevido.",
    price: 108000,
    previousPrice: 128000,
    discount: 16,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    ],
    categories: ["mujer", "ofertas"],
    gender: "mujer",
    size: "100 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Frutal Amaderado",
    notes: {
      top: ["Pera", "Melón", "Mandarina"],
      heart: ["Rosa", "Jazmín", "Orquídea"],
      base: ["Parcheli", "Caramelo", "Sándalo"],
    },
    stock: 0,
    featured: false,
    isActive: true,
    isOnSale: true,
    isNew: false,
    createdAt: "2024-03-01",
    soldCount: 15,
  },
  {
    id: "15",
    slug: "invictus-100",
    brand: "paco-rabanne",
    name: "Invictus",
    description:
      "El espíritu del guerrero, con notas marinas y amaderadas.",
    longDescription:
      "Invictus es una fragancia que evoca la victoria y la determinación. Las notas marinas se combinan con el pomelo, el jazmín y la madera de gaiac en una composición energética y masculina.",
    price: 122000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    ],
    categories: ["hombre"],
    gender: "hombre",
    size: "100 ml",
    concentration: "Eau de Toilette",
    olfactoryFamily: "Aromático Acuático",
    notes: {
      top: ["Pomelo", "Notas marinas", "Mandarina"],
      heart: ["Jazmín", "Salvia"],
      base: ["Madera de gaiac", "Roble", "Ámbar gris"],
    },
    stock: 9,
    featured: false,
    isActive: true,
    isOnSale: false,
    isNew: true,
    createdAt: "2024-03-10",
    soldCount: 12,
  },
  {
    id: "16",
    slug: "coco-mademoiselle-100",
    brand: "chanel",
    name: "Coco Mademoiselle",
    description:
      "Elegancia parisina con notas orientales y cítricas.",
    longDescription:
      "Coco Mademoiselle es una fragancia irreverente y sofisticada. La naranja, la rosa y el jazmín se combinan con el parcheli y la vainilla en un perfume adictivo y moderno.",
    price: 185000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
    ],
    categories: ["mujer"],
    gender: "mujer",
    size: "100 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Amaderado Oriental",
    notes: {
      top: ["Naranja", "Bergamota"],
      heart: ["Rosa", "Jazmín"],
      base: ["Parcheli", "Vainilla", "Vetiver"],
    },
    stock: 6,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2024-01-12",
    soldCount: 55,
  },
  {
    id: "17",
    slug: "spicebomb-90",
    brand: "viktor-rolf",
    name: "Spicebomb",
    description:
      "Una explosión de especias y sensualidad en una fragancia intensa.",
    longDescription:
      "Spicebomb es una explosión de especias y sensualidad. La canela, el azafrán y el cardamomo se combinan con el tabaco, el cuero y la vainilla en una fragancia intensa y adictiva.",
    price: 115000,
    previousPrice: 135000,
    discount: 15,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    ],
    categories: ["hombre", "ofertas"],
    gender: "hombre",
    size: "90 ml",
    concentration: "Eau de Toilette",
    olfactoryFamily: "Amaderado Especiado",
    notes: {
      top: ["Bergamota", "Pomelo", "Pimienta rosa"],
      heart: ["Canela", "Azafrán", "Cardamomo"],
      base: ["Tabaco", "Cuero", "Vainilla"],
    },
    stock: 7,
    featured: false,
    isActive: true,
    isOnSale: true,
    isNew: false,
    createdAt: "2024-02-05",
    soldCount: 29,
  },
  {
    id: "18",
    slug: "flowerbomb-100",
    brand: "viktor-rolf",
    name: "Flowerbomb",
    description:
      "Una bomba floral que estalla en sensualidad y feminidad.",
    longDescription:
      "Flowerbomb es una explosión de flores. El jazmín, la rosa, la orquídea y el patchouli se combinan en una fragancia opulenta y femenina que no deja indiferente.",
    price: 152000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1587017539504-67cfbddac569?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
    ],
    categories: ["mujer"],
    gender: "mujer",
    size: "100 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Floral Oriental",
    notes: {
      top: ["Té", "Bergamota"],
      heart: ["Jazmín", "Rosa", "Orquídea"],
      base: ["Parcheli", "Vainilla", "Almizcle"],
    },
    stock: 5,
    featured: false,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2024-02-18",
    soldCount: 25,
  },
  {
    id: "19",
    slug: "baccarat-rouge-540-70",
    brand: "maison-francis-kurkdjian",
    name: "Baccarat Rouge 540",
    description:
      "La artesanía perfumera en su máxima expresión, con azafrán y ámbar.",
    longDescription:
      "Baccarat Rouge 540 es una fragancia de nicho que combina azafrán, jazmín y ámbar gris. Una composición cristalina y adictiva que ha conquistado a los amantes de la perfumería de autor.",
    price: 385000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1592945403244-b3fbafd7f539?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    ],
    categories: ["unisex"],
    gender: "unisex",
    size: "70 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Amaderado Especiado",
    notes: {
      top: ["Azafrán", "Jazmín"],
      heart: ["Ámbar gris", "Resina de abeto"],
      base: ["Cedro", "Vainilla"],
    },
    stock: 3,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: true,
    createdAt: "2024-03-15",
    soldCount: 18,
  },
  {
    id: "20",
    slug: "aventus-100",
    brand: "creed",
    name: "Aventus",
    description:
      "Inspirado en la vida de un emperador, con piña y abedul.",
    longDescription:
      "Aventus de Creed es una fragancia icónica que celebra el poder, el éxito y la visión. La piña, la grosella negra y el abedul se combinan con el almizcle y el roble en una composición majestuosa.",
    price: 420000,
    images: [
      `${PRODUCT_IMAGE_BASE}photo-1541643600914-78b084683601?w=800&q=80`,
      `${PRODUCT_IMAGE_BASE}photo-1594035910387-fea47794261f?w=800&q=80`,
    ],
    categories: ["unisex"],
    gender: "unisex",
    size: "100 ml",
    concentration: "Eau de Parfum",
    olfactoryFamily: "Frutal Amaderado",
    notes: {
      top: ["Piña", "Grosella negra", "Manzana"],
      heart: ["Abedul", "Jazmín", "Rosa"],
      base: ["Almizcle", "Roble", "Vainilla"],
    },
    stock: 2,
    featured: true,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2024-01-08",
    soldCount: 22,
  },
];

export const getProductBySlug = (slug: string): Product | undefined => {
  return products.find((p) => p.slug === slug);
};

export const getFeaturedProducts = (): Product[] => {
  return products.filter((p) => p.featured && p.isActive);
};

export const getNewProducts = (): Product[] => {
  return products.filter((p) => p.isNew && p.isActive);
};

export const getSaleProducts = (): Product[] => {
  return products.filter((p) => p.isOnSale && p.isActive);
};

export const getRelatedProducts = (product: Product, limit = 4): Product[] => {
  return products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.isActive &&
        (p.brand === product.brand ||
          p.olfactoryFamily === product.olfactoryFamily ||
          p.categories.some((c) => product.categories.includes(c)))
    )
    .slice(0, limit);
};

export const getBestSellers = (limit = 8): Product[] => {
  return [...products]
    .filter((p) => p.isActive)
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, limit);
};

export const searchProducts = (query: string): Product[] => {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.isActive &&
      (p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.olfactoryFamily.toLowerCase().includes(q) ||
        p.notes.top.some((n) => n.toLowerCase().includes(q)) ||
        p.notes.heart.some((n) => n.toLowerCase().includes(q)) ||
        p.notes.base.some((n) => n.toLowerCase().includes(q)))
  );
};

export const filterProducts = (
  filters: {
    categories?: string[];
    brands?: string[];
    genders?: string[];
    sizes?: string[];
    olfactoryFamilies?: string[];
    onlyOffers?: boolean;
    onlyNew?: boolean;
    onlyInStock?: boolean;
    priceRange?: [number, number];
  },
  source: Product[] = products
): Product[] => {
  return source.filter((p) => {
    if (!p.isActive) return false;
    if (filters.categories?.length && !filters.categories.some((c) => p.categories.includes(c)))
      return false;
    if (filters.brands?.length && !filters.brands.includes(p.brand))
      return false;
    if (filters.genders?.length && !filters.genders.includes(p.gender))
      return false;
    if (filters.sizes?.length && !filters.sizes.includes(p.size))
      return false;
    if (
      filters.olfactoryFamilies?.length &&
      !filters.olfactoryFamilies.includes(p.olfactoryFamily)
    )
      return false;
    if (filters.onlyOffers && !p.isOnSale) return false;
    if (filters.onlyNew && !p.isNew) return false;
    if (filters.onlyInStock && p.stock === 0) return false;
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      if (p.price < min || p.price > max) return false;
    }
    return true;
  });
};

export const sortProducts = (
  products: Product[],
  sortBy: string
): Product[] => {
  const sorted = [...products];
  switch (sortBy) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "newest":
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "best-sellers":
      return sorted.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    default:
      return sorted.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }
};

export const getUniqueBrands = (source: Product[] = products): string[] => {
  return [...new Set(source.map((p) => p.brand))];
};

export const getUniqueSizes = (source: Product[] = products): string[] => {
  return [...new Set(source.map((p) => p.size))];
};

export const getUniqueOlfactoryFamilies = (source: Product[] = products): string[] => {
  return [...new Set(source.map((p) => p.olfactoryFamily))];
};

export const getPriceRange = (source: Product[] = products): [number, number] => {
  const prices = source.map((p) => p.price);
  if (prices.length === 0) return [0, 0];
  return [Math.min(...prices), Math.max(...prices)];
};
