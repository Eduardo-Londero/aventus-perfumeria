/**
 * Capa de datos de la tienda
 * ==========================
 * Actúa como base de datos del sistema con una interfaz SÍNCRONA idéntica en
 * ambos backends (feature flag `NEXT_PUBLIC_DATA_BACKEND`):
 *
 *   - `localStorage` (POR DEFECTO): comportamiento histórico, byte a byte.
 *   - `supabase`: lectura hidratada desde el proyecto Remoto (Fase C-1) y
 *     escritura de catálogo vía `/api/data/*` con write-through optimista
 *     (Fase C-2). Los PEDIDOS no pasan por esta API síncrona en remoto: se
 *     crean/leen con src/lib/ordersRemote.ts (RPC `create_order_atomic` +
 *     /api/admin/orders). Las secciones del home siguen pendientes (Fase D).
 *
 * Toda la lógica de este archivo (CRUD, validaciones, máquina de estados,
 * stock) es la MISMA en ambos backends: lo único que cambia es dónde se
 * persiste, que decide src/lib/dbDriver.ts.
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

// Reglas de negocio aplicadas por la propia capa de datos (una sola fuente de verdad)
import { applyStatusTransition } from "@/lib/orderStatus";
import { releaseStock, reserveStock } from "@/lib/inventory";

// Feature flag de backend: el driver (localStorage | supabase) decide DÓNDE
// se persiste. Toda la lógica de este archivo (CRUD, validaciones, máquina de
// estados, stock) es idéntica en ambos backends: la interfaz pública NO cambia.
import { IS_SUPABASE_BACKEND, DATA_BACKEND, type DataBackend } from "@/lib/dataBackend";
import { getDriver } from "@/lib/dbDriver";
import { enqueueWrite, type WriteKind } from "@/lib/dataSync";
import type { CatalogEntity } from "@/lib/catalogEntities";

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
  return getDriver().get<T>(key);
}

function saveCollection<T>(key: string, data: T[]): void {
  getDriver().set<T>(key, data);
}

/**
 * Backend efectivo de este build ("localStorage" por defecto).
 * Expuesto para diagnóstico (admin/tests/informes).
 */
export function getDataBackend(): DataBackend {
  return DATA_BACKEND;
}

/**
 * Resuelve cuando la capa de datos puede servir datos reales:
 * - localStorage: ya (resuelta de inmediato).
 * - supabase: al terminar la hidratación del catálogo (o al degradar, en
 *   cuyo caso el error queda en driver.getLastError()).
 * Uso recomendado en los efectos de arranque de React:
 *   whenReady().then(() => setX(dbX.getAll()));
 */
export function whenReady(): Promise<void> {
  return getDriver().whenReady();
}

/**
 * Ejecuta `fn` cuando el backend pueda servir datos reales. Con el backend
 * por defecto (localStorage) NO hace nada: los consumidores pueden dejar la
 * línea escrita sin cambiar el comportamiento actual.
 *
 * Uso típico en efectos de arranque (las lecturas iniciales de React son
 * síncronas y en supabase la hidratación es async):
 *   useEffect(() => {
 *     setProducts(dbProducts.getAll());
 *     return onBackendReady(() => setProducts(dbProducts.getAll()));
 *   }, []);
 *
 * Devuelve una función de limpieza idempotente (segura de devolver desde un
 * efecto de React). Con el backend por defecto devuelve un no-op.
 */
export function onBackendReady(fn: () => void): () => void {
  if (!IS_SUPABASE_BACKEND) return () => {};
  let cancelled = false;
  void whenReady().then(() => {
    if (!cancelled) fn();
  });
  return () => {
    cancelled = true;
  };
}

/**
 * Guarda de las escrituras AÚN no migradas a esta API síncrona:
 *   - pedidos  → en supabase van por src/lib/ordersRemote.ts (RPC + API
 *                 admin); esta API síncrona no puede esperar la red
 *   - home/CMS → Fase D (el esquema 0001 no tiene tabla de secciones)
 *
 * El catálogo (productos, categorías, marcas y géneros) YA escribe en remoto:
 * ver `writeThrough` más abajo. El flag por defecto (localStorage) no se ve
 * afectado por ninguna de las dos rutas.
 */
function guardWrite(operation: string): void {
  if (IS_SUPABASE_BACKEND) {
    throw new Error(
      `[data-backend=supabase] ${operation} todavía no está disponible en la ` +
        `API síncrona: en el backend remoto los pedidos se manejan con ` +
        `src/lib/ordersRemote.ts (RPC create_order_atomic y /api/admin/orders) ` +
        `y las secciones del home siguen pendientes (Fase D: sin tabla en el ` +
        `esquema 0001). El catálogo sí escribe desde la Fase C-2.`
    );
  }
}

// ---------------------------------------------------------------------------
// Escritura de catálogo con write-through (Fase C-2)
// ---------------------------------------------------------------------------

/**
 * Aplica el cambio en memoria (optimista, tal como hasta ahora) y, SOLO con el
 * backend `supabase`, lo encola hacia `/api/data/{entity}`.
 *
 * Si el servidor lo rechaza se restaura la fila afectada (rollback) y
 * `dataSync` notifica: la UI relee y muestra el mensaje del servidor. La
 * interfaz pública sigue siendo síncrona; lo remoto ocurre en segundo plano
 * y en orden (cola serial de dataSync).
 *
 * Con `localStorage` esto reduce a `apply()` exactamente: un solo punto de
 * corte de escrituras.
 */
function writeThrough<T extends { id: string }>(
  entity: CatalogEntity,
  key: string,
  kind: WriteKind,
  id: string,
  previous: T | undefined,
  apply: () => void
): void {
  apply();
  if (!IS_SUPABASE_BACKEND) return;
  // Borrado de algo que ya no existía: nada que enviar (mismo no-op local).
  if (kind === "delete" && previous === undefined) return;

  // Se lee DESPUÉS de aplicar: refleja el estado final que queremos persistir.
  const row = getCollection<T>(key).find((item) => item.id === id);
  if (kind !== "delete" && !row) return;

  enqueueWrite({ entity, kind, id, payload: row }, () => {
    restoreItem(key, id, previous);
  });
}

/**
 * Rollback quirúrgico de UNA fila: no reemplaza la colección entera, así que
 * no pisa altas o ediciones posteriores que ya se hayan aplicado en memoria.
 */
function restoreItem<T extends { id: string }>(
  key: string,
  id: string,
  previous: T | undefined
): void {
  const items = getCollection<T>(key);
  const index = items.findIndex((item) => item.id === id);
  if (previous === undefined) {
    if (index !== -1) items.splice(index, 1);
  } else if (index !== -1) {
    items[index] = previous;
  } else {
    items.push(previous);
  }
  saveCollection(key, items);
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

    writeThrough<Product>(
      "products",
      PRODUCTS_KEY,
      "create",
      product.id,
      undefined,
      () => {
        products.push(product);
        saveCollection(PRODUCTS_KEY, products);
      }
    );
  },

  update(id: string, updates: Partial<Product>): void {
    // Si no se solicita un ID válido no se modifica nada (evita tocar registros equivocados).
    if (!isValidId(id)) return;

    const products = this.getAll();
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      // El ID nunca se reescribe: la edición no puede cambiar el identificador.
      const { id: _ignoredId, ...safeUpdates } = updates;
      const previous = products[index];
      writeThrough<Product>(
        "products",
        PRODUCTS_KEY,
        "update",
        id,
        previous,
        () => {
          products[index] = { ...products[index], ...safeUpdates, id };
          saveCollection(PRODUCTS_KEY, products);
        }
      );
    }
  },

  delete(id: string): void {
    // Sin un ID válido no se elimina nada: la baja debe ser explícita y sobre un solo registro.
    if (!isValidId(id)) return;

    const products = this.getAll();
    const previous = products.find((p) => p.id === id);
    writeThrough<Product>(
      "products",
      PRODUCTS_KEY,
      "delete",
      id,
      previous,
      () => {
        saveCollection(PRODUCTS_KEY, products.filter((p) => p.id !== id));
      }
    );
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
    writeThrough<Category>(
      "categories",
      CATEGORIES_KEY,
      "create",
      category.id,
      undefined,
      () => {
        categories.push(category);
        saveCollection(CATEGORIES_KEY, categories);
      }
    );
  },

  update(id: string, updates: Partial<Category>): void {
    const categories = this.getAll();
    const index = categories.findIndex((c) => c.id === id);
    if (index !== -1) {
      // El ID nunca se reescribe (igual que en productos).
      const { id: _ignoredId, ...safeUpdates } = updates;
      const previous = categories[index];
      writeThrough<Category>(
        "categories",
        CATEGORIES_KEY,
        "update",
        id,
        previous,
        () => {
          categories[index] = { ...categories[index], ...safeUpdates, id };
          saveCollection(CATEGORIES_KEY, categories);
        }
      );
    }
  },

  delete(id: string): void {
    const categories = this.getAll();
    const previous = categories.find((c) => c.id === id);
    writeThrough<Category>(
      "categories",
      CATEGORIES_KEY,
      "delete",
      id,
      previous,
      () => {
        saveCollection(CATEGORIES_KEY, categories.filter((c) => c.id !== id));
      }
    );
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
    writeThrough<Gender>(
      "genders",
      GENDERS_KEY,
      "create",
      gender.id,
      undefined,
      () => {
        genders.push(gender);
        saveCollection(GENDERS_KEY, genders);
      }
    );
  },

  update(id: string, updates: Partial<Gender>): void {
    const genders = this.getAll();
    const index = genders.findIndex((g) => g.id === id);
    if (index !== -1) {
      const { id: _ignoredId, ...safeUpdates } = updates;
      const previous = genders[index];
      writeThrough<Gender>(
        "genders",
        GENDERS_KEY,
        "update",
        id,
        previous,
        () => {
          genders[index] = { ...genders[index], ...safeUpdates, id };
          saveCollection(GENDERS_KEY, genders);
        }
      );
    }
  },

  delete(id: string): void {
    const genders = this.getAll();
    const previous = genders.find((g) => g.id === id);
    writeThrough<Gender>("genders", GENDERS_KEY, "delete", id, previous, () => {
      saveCollection(GENDERS_KEY, genders.filter((g) => g.id !== id));
    });
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
    writeThrough<Brand>("brands", BRANDS_KEY, "create", brand.id, undefined, () => {
      brands.push(brand);
      saveCollection(BRANDS_KEY, brands);
    });
  },

  update(id: string, updates: Partial<Brand>): void {
    const brands = this.getAll();
    const index = brands.findIndex((b) => b.id === id);
    if (index !== -1) {
      const { id: _ignoredId, ...safeUpdates } = updates;
      const previous = brands[index];
      writeThrough<Brand>("brands", BRANDS_KEY, "update", id, previous, () => {
        brands[index] = { ...brands[index], ...safeUpdates, id };
        saveCollection(BRANDS_KEY, brands);
      });
    }
  },

  delete(id: string): void {
    const brands = this.getAll();
    const previous = brands.find((b) => b.id === id);
    writeThrough<Brand>("brands", BRANDS_KEY, "delete", id, previous, () => {
      saveCollection(BRANDS_KEY, brands.filter((b) => b.id !== id));
    });
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

/**
 * Refleja en el catálogo en memoria la reserva de stock que la RPC
 * `create_order_atomic` YA aplicó en la base remota (solo backend
 * `supabase`). Así el carrito no ofrece unidades recién compradas hasta el
 * próximo arranque; el servidor sigue siendo la autoridad (si el espejo se
 * desincroniza, la RPC rechaza con "Stock insuficiente").
 *
 * No-op en localStorage: ahí la reserva la hace `dbOrders.create`.
 */
export function mirrorStockReserve(items: OrderItemSnapshot[]): void {
  if (!IS_SUPABASE_BACKEND || items.length === 0) return;
  const { products } = reserveStock(dbProducts.getAll(), items);
  saveCollection(PRODUCTS_KEY, products);
}

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
    guardWrite("dbOrders.create");
    // Validación: nunca persistir un pedido sin ID o con un ID duplicado.
    if (!isValidId(order.id)) {
      throw new Error("No se puede guardar el pedido: el ID es obligatorio.");
    }

    const orders = this.getAll();
    if (orders.some((o) => o.id === order.id)) {
      throw new Error(
        `No se puede guardar el pedido: ya existe un pedido con el ID "${order.id}".`
      );
    }

    // Reserva de stock (integridad de inventario): al crear el pedido se
    // descuentan las unidades del catálogo y se acumulan las ventas UNA sola
    // vez. `stockReserved: false` permite importar pedidos históricos sin
    // tocar el inventario; el resto queda marcado como `true` para que la
    // cancelación sepa que debe liberar exactamente esa reserva.
    const shouldReserve = order.stockReserved !== false;
    if (shouldReserve) {
      // Nota: si un producto del pedido fue dado de baja del catálogo, se omite.
      const { products } = reserveStock(dbProducts.getAll(), order.items);
      saveCollection(PRODUCTS_KEY, products);
    }

    const persisted: Order = { ...order, stockReserved: shouldReserve };
    orders.push(persisted);
    saveCollection(ORDERS_KEY, orders);
  },

  update(id: string, updates: Partial<Order>): void {
    guardWrite("dbOrders.update");
    const orders = this.getAll();
    const index = orders.findIndex((o) => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      saveCollection(ORDERS_KEY, orders);
    }
  },

  /**
   * Aplica un cambio de estado validado por la máquina de estados
   * (src/lib/orderStatus.ts). Devuelve `false` cuando el pedido no existe o la
   * transición no está permitida: en ese caso NO se persiste nada.
   * Al cancelar, libera la reserva de stock exactamente una vez.
   */
  updateStatus(id: string, status: OrderStatus): boolean {
    guardWrite("dbOrders.updateStatus");
    const orders = this.getAll();
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return false;

    const stored = orders[index];
    // Defensa ante datos legados sin historial: se normaliza antes de transicionar.
    const current: Order = Array.isArray(stored.statusHistory)
      ? stored
      : { ...stored, statusHistory: [] };

    const updated = applyStatusTransition(current, status);
    if (!updated) return false;

    if (status === "cancelado" && current.stockReserved === true) {
      // Liberación de la reserva (solo pedidos creados con reserva; los
      // antiguos, sin el flag, nunca descontaron stock).
      const { products } = releaseStock(dbProducts.getAll(), current.items);
      saveCollection(PRODUCTS_KEY, products);
      updated.stockReserved = false;
    }

    orders[index] = updated;
    saveCollection(ORDERS_KEY, orders);
    return true;
  },

  generateOrderNumber(): string {
    const orders = this.getAll();
    // Evita colisiones si algún pedido hubiese sido eliminado del storage.
    const existing = new Set(orders.map((o) => o.id));
    let nextNumber = 1048 + orders.length;
    while (existing.has(`AV-${nextNumber}`)) {
      nextNumber += 1;
    }
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
    guardWrite("dbHomeSections.save");
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

  // Arranque del driver activo: en supabase lanza la hidratación asíncrona
  // del catálogo (la siembra de abajo es síncrona y entra primero a la
  // memoria; lo remoto la reemplaza solo si vino con datos — ver dbDriver).
  getDriver().initialize();

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
      {
        id: "lancome",
        slug: "lancome",
        name: "Lancôme",
        description: "Elegancia francesa y el icónico aroma de La Vie Est Belle.",
        image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=800&q=80",
        isActive: true,
        order: 14,
      },
    ]);
  }
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
