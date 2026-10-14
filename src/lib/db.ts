/**
 * Capa de datos local (localStorage)
 * ==================================
 * Actúa como base de datos del sistema.
 * Toda la información se persiste en localStorage.
 * En producción se reemplazaría por una API real.
 */

// Importar productos iniciales para poblar la base de datos
import { products as initialProducts } from "@/data/products";

// ============================================================
// Tipos canónicos — importados desde src/types
// ============================================================
import type {
  Product,
  Category,
  Gender,
  Brand,
  OrderItemSnapshot,
  Order,
  OrderStatus,
} from "@/types";

// HomepageSection está definido en types/cms.ts
import type { HomepageSection } from "@/types/cms";

// Re-exportar para compatibilidad con consumidores existentes
export type {
  Product,
  Category,
  Gender,
  Brand,
  OrderItemSnapshot,
  Order,
  OrderStatus,
  HomepageSection,
};

// ============================================================
// Generic CRUD helpers
// ============================================================

function getCollection<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCollection<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ============================================================
// Products
// ============================================================

const PRODUCTS_KEY = "aventus-db-products";

/**
 * Genera un ID único para un producto nuevo.
 *
 * Los productos existentes usan IDs numéricos en formato string ("1".."20"),
 * por lo que se conserva esa convención: se parte del máximo numérico actual
 * y se incrementa hasta encontrar un valor no utilizado.
 *
 * Nunca reutiliza un ID existente y no modifica los IDs ya persistidos.
 */
export function generateProductId(): string {
  const products = getCollection<Product>(PRODUCTS_KEY);
  const used = new Set(products.map((p) => String(p.id)));

  let next = 1;
  for (const p of products) {
    const numeric = Number(p.id);
    if (Number.isFinite(numeric) && numeric >= next) {
      next = numeric + 1;
    }
  }

  // Red de seguridad por si el máximo coincidiera con un ID no numérico ya usado
  while (used.has(String(next))) {
    next += 1;
  }

  return String(next);
}

/** Devuelve true si el valor es un ID de producto utilizable (string no vacío). */
function isValidId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0;
}

export const dbProducts = {
  getAll(): Product[] {
    return getCollection<Product>(PRODUCTS_KEY);
  },

  getActive(): Product[] {
    return this.getAll().filter((p) => p.isActive);
  },

  getById(id: string): Product | undefined {
    return this.getAll().find((p) => p.id === id);
  },

  getBySlug(slug: string): Product | undefined {
    return this.getAll().find((p) => p.slug === slug);
  },

  getFeatured(): Product[] {
    return this.getActive().filter((p) => p.featured);
  },

  getNew(): Product[] {
    return this.getActive().filter((p) => p.isNew);
  },

  getOnSale(): Product[] {
    return this.getActive().filter((p) => p.isOnSale);
  },

  getByCategory(categoryId: string): Product[] {
    return this.getActive().filter((p) => p.categories.includes(categoryId));
  },

  getByBrand(brandId: string): Product[] {
    return this.getActive().filter((p) => p.brand === brandId);
  },

  getByGender(genderId: string): Product[] {
    return this.getActive().filter((p) => p.gender === genderId);
  },

  search(query: string): Product[] {
    const q = query.toLowerCase();
    return this.getActive().filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.olfactoryFamily.toLowerCase().includes(q)
    );
  },

  create(product: Product): void {
    // Validación: nunca persistir un producto sin ID o con un ID duplicado.
    if (!isValidId(product.id)) {
      throw new Error(
        "No se puede guardar el producto: el ID es obligatorio."
      );
    }

    const products = this.getAll();
    if (products.some((p) => p.id === product.id)) {
      throw new Error(
        `No se puede guardar el producto: ya existe un producto con el ID "${product.id}".`
      );
    }

    products.push(product);
    saveCollection(PRODUCTS_KEY, products);
  },

  update(id: string, updates: Partial<Product>): void {
    // Si no se solicita un ID válido no se modifica nada (evita tocar registros equivocados).
    if (!isValidId(id)) return;

    const products = this.getAll();
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      // El ID nunca se reescribe: la edición no puede cambiar el identificador.
      const { id: _ignoredId, ...safeUpdates } = updates;
      products[index] = { ...products[index], ...safeUpdates, id };
      saveCollection(PRODUCTS_KEY, products);
    }
  },

  delete(id: string): void {
    // Sin un ID válido no se elimina nada: la baja debe ser explícita y sobre un solo registro.
    if (!isValidId(id)) return;

    const products = this.getAll().filter((p) => p.id !== id);
    saveCollection(PRODUCTS_KEY, products);
  },

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  },
};

// ============================================================
// Categories
// ============================================================

const CATEGORIES_KEY = "aventus-db-categories";

export const dbCategories = {
  getAll(): Category[] {
    return getCollection<Category>(CATEGORIES_KEY);
  },

  getActive(): Category[] {
    return this.getAll().filter((c) => c.isActive);
  },

  getById(id: string): Category | undefined {
    return this.getAll().find((c) => c.id === id);
  },

  create(category: Category): void {
    const categories = this.getAll();
    categories.push(category);
    saveCollection(CATEGORIES_KEY, categories);
  },

  update(id: string, updates: Partial<Category>): void {
    const categories = this.getAll();
    const index = categories.findIndex((c) => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updates };
      saveCollection(CATEGORIES_KEY, categories);
    }
  },

  delete(id: string): void {
    const categories = this.getAll().filter((c) => c.id !== id);
    saveCollection(CATEGORIES_KEY, categories);
  },

  getProductCount(categoryId: string): number {
    return dbProducts.getByCategory(categoryId).length;
  },

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  },
};

// ============================================================
// Genders
// ============================================================

const GENDERS_KEY = "aventus-db-genders";

export const dbGenders = {
  getAll(): Gender[] {
    return getCollection<Gender>(GENDERS_KEY);
  },

  getActive(): Gender[] {
    return this.getAll().filter((g) => g.isActive);
  },

  getById(id: string): Gender | undefined {
    return this.getAll().find((g) => g.id === id);
  },

  create(gender: Gender): void {
    const genders = this.getAll();
    genders.push(gender);
    saveCollection(GENDERS_KEY, genders);
  },

  update(id: string, updates: Partial<Gender>): void {
    const genders = this.getAll();
    const index = genders.findIndex((g) => g.id === id);
    if (index !== -1) {
      genders[index] = { ...genders[index], ...updates };
      saveCollection(GENDERS_KEY, genders);
    }
  },

  delete(id: string): void {
    const genders = this.getAll().filter((g) => g.id !== id);
    saveCollection(GENDERS_KEY, genders);
  },

  getProductCount(genderId: string): number {
    return dbProducts.getByGender(genderId).length;
  },
};

// ============================================================
// Brands
// ============================================================

const BRANDS_KEY = "aventus-db-brands";

export const dbBrands = {
  getAll(): Brand[] {
    return getCollection<Brand>(BRANDS_KEY);
  },

  getActive(): Brand[] {
    return this.getAll().filter((b) => b.isActive);
  },

  getById(id: string): Brand | undefined {
    return this.getAll().find((b) => b.id === id);
  },

  getBySlug(slug: string): Brand | undefined {
    return this.getAll().find((b) => b.slug === slug);
  },

  create(brand: Brand): void {
    const brands = this.getAll();
    brands.push(brand);
    saveCollection(BRANDS_KEY, brands);
  },

  update(id: string, updates: Partial<Brand>): void {
    const brands = this.getAll();
    const index = brands.findIndex((b) => b.id === id);
    if (index !== -1) {
      brands[index] = { ...brands[index], ...updates };
      saveCollection(BRANDS_KEY, brands);
    }
  },

  delete(id: string): void {
    const brands = this.getAll().filter((b) => b.id !== id);
    saveCollection(BRANDS_KEY, brands);
  },

  getProductCount(brandId: string): number {
    return dbProducts.getByBrand(brandId).length;
  },

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  },
};

// ============================================================
// Orders
// ============================================================

const ORDERS_KEY = "aventus-db-orders";

export const dbOrders = {
  getAll(): Order[] {
    return getCollection<Order>(ORDERS_KEY);
  },

  getById(id: string): Order | undefined {
    return this.getAll().find((o) => o.id === id);
  },

  getByUser(userId: string): Order[] {
    return this.getAll().filter((o) => o.userId === userId);
  },

  create(order: Order): void {
    const orders = this.getAll();
    orders.push(order);
    saveCollection(ORDERS_KEY, orders);
  },

  update(id: string, updates: Partial<Order>): void {
    const orders = this.getAll();
    const index = orders.findIndex((o) => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      saveCollection(ORDERS_KEY, orders);
    }
  },

  updateStatus(id: string, status: OrderStatus): void {
    const orders = this.getAll();
    const index = orders.findIndex((o) => o.id === id);
    if (index !== -1) {
      orders[index].status = status;
      orders[index].statusHistory.push({ status, date: new Date().toISOString() });
      saveCollection(ORDERS_KEY, orders);
    }
  },

  generateOrderNumber(): string {
    const orders = this.getAll();
    const nextNumber = 1048 + orders.length;
    return `AV-${nextNumber}`;
  },
};

// ============================================================
// Homepage Sections
// ============================================================

const HOME_SECTIONS_KEY = "aventus-db-home-sections";

export const dbHomeSections = {
  getAll(): HomepageSection[] {
    return getCollection<HomepageSection>(HOME_SECTIONS_KEY);
  },

  save(sections: HomepageSection[]): void {
    saveCollection(HOME_SECTIONS_KEY, sections);
  },

  getDefaultSections(): HomepageSection[] {
    return [
      { id: "1", type: "hero", title: "Hero principal", isActive: true, order: 1 },
      { id: "2", type: "categories", title: "Categorías", isActive: true, order: 2 },
      { id: "3", type: "featured", title: "Productos destacados", isActive: true, order: 3 },
      { id: "4", type: "offers", title: "Ofertas", isActive: true, order: 4 },
      { id: "5", type: "newArrivals", title: "Nuevos ingresos", isActive: true, order: 5 },
      { id: "6", type: "banner", title: "Banner promocional", isActive: true, order: 6 },
      { id: "7", type: "brands", title: "Marcas", isActive: false, order: 7 },
      { id: "8", type: "about", title: "Sobre Aventus", isActive: true, order: 8 },
      { id: "9", type: "instagram", title: "Instagram", isActive: true, order: 9 },
      { id: "10", type: "contact", title: "Contacto", isActive: true, order: 10 },
    ];
  },

  getActiveSections(): HomepageSection[] {
    const sections = this.getAll();
    if (sections.length === 0) {
      return this.getDefaultSections();
    }
    return sections.filter((s) => s.isActive).sort((a, b) => a.order - b.order);
  },
};

// ============================================================
// Initialize default data
// ============================================================

export function initializeDatabase(): void {
  if (typeof window === "undefined") return;

  // Initialize genders if empty
  const genders = getCollection<Gender>(GENDERS_KEY);
  if (genders.length === 0) {
    saveCollection(GENDERS_KEY, [
      { id: "hombre", name: "Hombre", isActive: true },
      { id: "mujer", name: "Mujer", isActive: true },
      { id: "unisex", name: "Unisex", isActive: true },
    ]);
  }

  // Initialize categories if empty
  const categories = getCollection<Category>(CATEGORIES_KEY);
  if (categories.length === 0) {
    saveCollection(CATEGORIES_KEY, [
      {
        id: "hombre",
        slug: "hombre",
        name: "Hombre",
        description: "Fragancias masculinas",
        image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80",
        isActive: true,
        order: 1,
      },
      {
        id: "mujer",
        slug: "mujer",
        name: "Mujer",
        description: "Fragancias femeninas",
        image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=800&q=80",
        isActive: true,
        order: 2,
      },
      {
        id: "unisex",
        slug: "unisex",
        name: "Unisex",
        description: "Fragancias para todos",
        image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
        isActive: true,
        order: 3,
      },
      {
        id: "nuevos-ingresos",
        slug: "nuevos-ingresos",
        name: "Nuevos ingresos",
        description: "Las últimas novedades en perfumería",
        image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80",
        isActive: true,
        order: 4,
      },
      {
        id: "ofertas",
        slug: "ofertas",
        name: "Ofertas",
        description: "Aprovechá descuentos exclusivos",
        image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
        isActive: true,
        order: 5,
      },
    ]);
  }

  // Initialize brands if empty
  const brands = getCollection<Brand>(BRANDS_KEY);
  if (brands.length === 0) {
    saveCollection(BRANDS_KEY, [
      {
        id: "dior",
        slug: "dior",
        name: "Dior",
        description: "La maison francesa que redefine el lujo desde 1946.",
        image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80",
        isActive: true,
        order: 1,
      },
      {
        id: "carolina-herrera",
        slug: "carolina-herrera",
        name: "Carolina Herrera",
        description: "Sofisticación neoyorquina con alma latina.",
        image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=800&q=80",
        isActive: true,
        order: 2,
      },
      {
        id: "paco-rabanne",
        slug: "paco-rabanne",
        name: "Paco Rabanne",
        description: "Audacia y vanguardia en cada creación.",
        image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
        isActive: true,
        order: 3,
      },
      {
        id: "jean-paul-gaultier",
        slug: "jean-paul-gaultier",
        name: "Jean Paul Gaultier",
        description: "El enfant terrible de la alta costura francesa.",
        image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80",
        isActive: true,
        order: 4,
      },
      {
        id: "armani",
        slug: "armani",
        name: "Armani",
        description: "Elegancia discreta y refinamiento italiano.",
        image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80",
        isActive: true,
        order: 5,
      },
      {
        id: "versace",
        slug: "versace",
        name: "Versace",
        description: "Opulencia mediterránea en estado puro.",
        image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
        isActive: true,
        order: 6,
      },
      {
        id: "ysl",
        slug: "ysl",
        name: "Yves Saint Laurent",
        description: "Revolución y elegancia desde 1961.",
        image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80",
        isActive: true,
        order: 7,
      },
      {
        id: "chanel",
        slug: "chanel",
        name: "Chanel",
        description: "El epítome del lujo francés.",
        image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
        isActive: true,
        order: 8,
      },
      {
        id: "hermes",
        slug: "hermes",
        name: "Hermès",
        description: "Artesanía y excelencia desde 1837.",
        image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80",
        isActive: true,
        order: 9,
      },
      {
        id: "jimmy-choo",
        slug: "jimmy-choo",
        name: "Jimmy Choo",
        description: "Glamour y sofisticación contemporánea.",
        image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=800&q=80",
        isActive: true,
        order: 10,
      },
      {
        id: "viktor-rolf",
        slug: "viktor-rolf",
        name: "Viktor & Rolf",
        description: "El arte conceptual aplicado a la perfumería.",
        image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
        isActive: true,
        order: 11,
      },
      {
        id: "creed",
        slug: "creed",
        name: "Creed",
        description: "La casa de perfumería más exclusiva del mundo.",
        image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80",
        isActive: true,
        order: 12,
      },
      {
        id: "maison-francis-kurkdjian",
        slug: "maison-francis-kurkdjian",
        name: "Maison Francis Kurkdjian",
        description: "La perfumería de autor en su máxima expresión.",
        image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80",
        isActive: true,
        order: 13,
      },
    ]);
  }

  // Initialize products if empty - CARGAR PRODUCTOS REALES
  const products = getCollection<Product>(PRODUCTS_KEY);
  if (products.length === 0) {
    // Guardar productos iniciales en localStorage
    saveCollection(PRODUCTS_KEY, initialProducts);
  }

  // Initialize home sections if empty
  const homeSections = getCollection<HomepageSection>(HOME_SECTIONS_KEY);
  if (homeSections.length === 0) {
    saveCollection(HOME_SECTIONS_KEY, dbHomeSections.getDefaultSections());
  }
}
