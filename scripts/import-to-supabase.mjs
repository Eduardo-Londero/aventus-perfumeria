#!/usr/bin/env node
/**
 * Importación de un respaldo (dump) a Supabase — Fase D
 * =====================================================
 * Toma el JSON exportado desde Admin → Configuración ("Exportar respaldo")
 * y lo escribe en el proyecto Supabase con `service_role` (solo servidor).
 *
 * Uso:
 *   node scripts/import-to-supabase.mjs --file aventus-dump.json            # dry-run (SIN escribir)
 *   node scripts/import-to-supabase.mjs --file aventus-dump.json --execute  # escribe en Supabase
 *   npm run import:supabase -- --file aventus-dump.json [--execute]
 *
 * Seguridad y alcance:
 *   - Por defecto es DRY-RUN: valida el dump, imprime el plan y NO toca la
 *     red. La escritura requiere el flag explícito `--execute`.
 *   - Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local (o del
 *     entorno). NUNCA imprime valores: solo presencia/ausencia.
 *   - Solo escribe el CATÁLOGO (genders → categories → brands → products →
 *     product_categories) con `upsert` por clave natural (id), por lo que es
 *     re-ejecutable. Pedidos, secciones del home y carrito quedan RESERVADOS
 *     en el dump pero NO se importan (motivos abajo, `SKIPPED`).
 *
 * Motivos de los OMITIDOS (coherentes con docs/TRANSICION_SUPABASE.md):
 *   - orders: el esquema 0001 exige `user_id` con FK a profiles → auth.users;
 *     los pedidos del localStorage son de clientes sin cuenta (customer
 *     embebido). Requiere la F3/RPC de pedidos (Fase E).
 *   - homeSections: no existe tabla para el CMS del home en el esquema 0001.
 *   - cart: estado del navegador del visitante, no es dato de negocio.
 *
 * Códigos de salida: 0 ok · 1 dump inválido · 2 configuración · 3 escritura.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Constantes del formato (espejo de src/lib/exportData.ts)
// ---------------------------------------------------------------------------

export const DUMP_FORMAT = "aventus-dump";
export const DUMP_VERSION = 1;

/** Colecciones que este script SÍ importa, en orden de dependencia (FKs). */
export const IMPORT_STEPS = ["genders", "categories", "brands", "products", "product_categories"];

/** Colecciones presentes en el dump pero no importadas, con su motivo. */
export const SKIPPED = [
  {
    entity: "orders",
    reason:
      "requiere perfiles en Supabase Auth (F3/Fase E): los pedidos locales son de clientes sin cuenta",
  },
  {
    entity: "homeSections",
    reason: "no existe tabla para el CMS del home en el esquema 0001",
  },
  {
    entity: "cart",
    reason: "estado del navegador del visitante, no es dato de negocio",
  },
];

// ---------------------------------------------------------------------------
// Validadores (mensajes idénticos a src/lib/server/catalogWriteService.ts;
// la paridad se verifica con pruebas — src/lib/importScript.parity.test.ts)
// ---------------------------------------------------------------------------

const MAX_TEXT = 5_000;
const MAX_SHORT = 200;
const MAX_ID = 64;

function reqText(value, field, max = MAX_SHORT) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`El campo "${field}" es obligatorio y debe ser texto.`);
  }
  if (value.length > max) {
    throw new Error(`El campo "${field}" supera el máximo de ${max} caracteres.`);
  }
  return value;
}

function optText(value, field, opts = {}) {
  const nullAs = opts.nullAs ?? null;
  if (value === undefined || value === null || value === "") return nullAs;
  if (typeof value !== "string") {
    throw new Error(`El campo "${field}" debe ser texto.`);
  }
  if (value.length > (opts.max ?? MAX_TEXT)) {
    throw new Error(`El campo "${field}" supera el máximo de ${opts.max ?? MAX_TEXT} caracteres.`);
  }
  return value;
}

function reqPrice(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`El campo "${field}" debe ser un importe numérico mayor o igual a 0.`);
  }
  return Math.round(value);
}

function optInt(value, field, opts) {
  if (value === undefined || value === null) return opts.fallback;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < (opts.min ?? 0) ||
    value > (opts.max ?? Number.MAX_SAFE_INTEGER)
  ) {
    const min = opts.min ?? 0;
    const max = opts.max === undefined ? "sin tope superior" : `hasta ${opts.max}`;
    throw new Error(`El campo "${field}" debe ser un número entero (${min} ${max}).`);
  }
  return value;
}

function optDiscount(value) {
  if (value === undefined || value === null || value === "") return null;
  return optInt(value, "discount", { min: 0, max: 100, fallback: 0 });
}

function optBool(value, field, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw new Error(`El campo "${field}" debe ser verdadero o falso.`);
  }
  return value;
}

function optStrArray(value, field, opts = {}) {
  if (value === undefined || value === null) {
    if (opts.required) {
      throw new Error(`El campo "${field}" es obligatorio.`);
    }
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`El campo "${field}" debe ser una lista de textos.`);
  }
  const max = opts.maxItems ?? 50;
  if (value.length > max) {
    throw new Error(`El campo "${field}" admite como máximo ${max} ítems.`);
  }
  return value.map((item, index) => reqText(item, `${field}[${index}]`, MAX_TEXT));
}

function reqDate(value, field) {
  const text = reqText(value, field, 40);
  if (Number.isNaN(Date.parse(text))) {
    throw new Error(`El campo "${field}" debe ser una fecha válida.`);
  }
  return text;
}

/** Pesos enteros → centavos enteros (espejo de catalogMapper.arsToCents). */
function arsToCents(ars) {
  if (ars === null || ars === undefined) return null;
  return Math.round(Number(ars) * 100);
}

function asRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} debe ser un objeto.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Mapeo app → fila (idéntico a catalogWriteService: mismo JSON final)
// ---------------------------------------------------------------------------

export function mapGenderToRow(value) {
  const body = asRecord(value, "El género");
  return {
    id: reqText(body.id, "id", MAX_ID),
    name: reqText(body.name, "name"),
    is_active: optBool(body.isActive, "isActive", true),
  };
}

export function mapCategoryToRow(value) {
  const body = asRecord(value, "La categoría");
  return {
    id: reqText(body.id, "id", MAX_ID),
    slug: reqText(body.slug, "slug"),
    name: reqText(body.name, "name"),
    description: optText(body.description, "description", { nullAs: null }),
    image_url: optText(body.image, "image", { max: 1000, nullAs: null }),
    order: optInt(body.order, "order", { fallback: 0 }),
    is_active: optBool(body.isActive, "isActive", true),
  };
}

export function mapBrandToRow(value) {
  const body = asRecord(value, "La marca");
  return {
    id: reqText(body.id, "id", MAX_ID),
    slug: reqText(body.slug, "slug"),
    name: reqText(body.name, "name"),
    description: optText(body.description, "description", { nullAs: null }),
    image_url: optText(body.image, "image", { max: 1000, nullAs: null }),
    order: optInt(body.order, "order", { fallback: 0 }),
    is_active: optBool(body.isActive, "isActive", true),
  };
}

export function mapProductToRow(value) {
  const body = asRecord(value, "El producto");
  const notes =
    body.notes === undefined || body.notes === null
      ? {}
      : asRecord(body.notes, "El campo \"notes\"");

  return {
    id: reqText(body.id, "id", MAX_ID),
    slug: reqText(body.slug, "slug"),
    name: reqText(body.name, "name"),
    brand_id: reqText(body.brand, "brand", MAX_ID),
    gender_id: reqText(body.gender, "gender", MAX_ID),
    description: optText(body.description, "description", { nullAs: null }),
    long_description: optText(body.longDescription, "longDescription", { nullAs: null }),
    price_cents: arsToCents(reqPrice(body.price, "price")) ?? 0,
    previous_price_cents:
      body.previousPrice === undefined || body.previousPrice === null
        ? null
        : arsToCents(reqPrice(body.previousPrice, "previousPrice")),
    discount: optDiscount(body.discount),
    images: optStrArray(body.images, "images", { required: true, maxItems: 20 }),
    size: optText(body.size, "size", { nullAs: null }),
    concentration: optText(body.concentration, "concentration", { nullAs: null }),
    olfactory_family: optText(body.olfactoryFamily, "olfactoryFamily", { nullAs: null }),
    notes_top: optStrArray(notes.top, "notes.top", { maxItems: 30 }),
    notes_heart: optStrArray(notes.heart, "notes.heart", { maxItems: 30 }),
    notes_base: optStrArray(notes.base, "notes.base", { maxItems: 30 }),
    stock: optInt(body.stock, "stock", { fallback: 0 }),
    featured: optBool(body.featured, "featured", false),
    is_active: optBool(body.isActive, "isActive", true),
    is_on_sale: optBool(body.isOnSale, "isOnSale", false),
    is_new: optBool(body.isNew, "isNew", false),
    sold_count: optInt(body.soldCount, "soldCount", { fallback: 0 }),
    created_at: reqDate(body.createdAt, "createdAt"),
  };
}

/** Categorías pedidas en el payload de un producto (validadas). */
export function mapProductCategoryIds(value) {
  const body = asRecord(value, "El producto");
  return optStrArray(body.categories, "categories", { required: true, maxItems: 20 });
}

// ---------------------------------------------------------------------------
// Validación del dump (acumula TODOS los errores, no falla al primero)
// ---------------------------------------------------------------------------

function isArray(value) {
  return Array.isArray(value);
}

function findDuplicates(items) {
  const seen = new Set();
  const dupes = new Set();
  for (const item of items) {
    const id = String(item && item.id);
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

/**
 * Valida la estructura del dump y la integridad de referencias del catálogo.
 * Devuelve { ok, errors, warnings, counts } — nunca lanza.
 */
export function validateDump(dump) {
  const errors = [];
  const warnings = [];

  if (dump === null || typeof dump !== "object" || isArray(dump)) {
    return { ok: false, errors: ["El dump debe ser un objeto JSON."], warnings, counts: null };
  }

  if (dump.format !== DUMP_FORMAT) {
    errors.push(`format debe ser "${DUMP_FORMAT}" (recibido: ${JSON.stringify(dump.format)}).`);
  }
  if (dump.version !== DUMP_VERSION) {
    errors.push(`version debe ser ${DUMP_VERSION} (recibido: ${JSON.stringify(dump.version)}).`);
  }
  if (typeof dump.exportedAt !== "string" || Number.isNaN(Date.parse(dump.exportedAt))) {
    errors.push("exportedAt debe ser una fecha ISO válida.");
  }

  const collections = dump.collections;
  if (collections === null || typeof collections !== "object" || isArray(collections)) {
    errors.push("collections debe ser un objeto con las colecciones exportadas.");
    return { ok: false, errors, warnings, counts: null };
  }

  // Las 4 colecciones de catálogo son obligatorias (deben existir en el dump);
  // el resto puede faltar y se trata como vacío.
  const required = ["genders", "categories", "brands", "products"];
  const optional = ["orders", "homeSections", "cart"];
  const counts = {};

  for (const key of required) {
    if (!isArray(collections[key])) {
      errors.push(`collections.${key} debe ser una lista.`);
    }
  }
  for (const key of optional) {
    if (collections[key] === undefined) {
      counts[key] = 0;
    } else if (!isArray(collections[key])) {
      errors.push(`collections.${key} debe ser una lista.`);
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors, warnings, counts: null };
  }

  for (const key of [...required, ...optional]) {
    counts[key] = isArray(collections[key]) ? collections[key].length : 0;
  }

  // Entidad por entidad: forma básica + IDs duplicados (acumula errores).
  const entityChecks = [
    ["genders", (item, i) => mapGenderToRow(item) || `collections.genders[${i}]`],
    ["categories", (item, i) => mapCategoryToRow(item) || `collections.categories[${i}]`],
    ["brands", (item, i) => mapBrandToRow(item) || `collections.brands[${i}]`],
    ["products", (item, i) => mapProductToRow(item) || `collections.products[${i}]`],
  ];
  for (const [key, check] of entityChecks) {
    collections[key].forEach((item, index) => {
      try {
        check(item, index);
      } catch (error) {
        const idHint =
          item && typeof item === "object" && typeof item.id === "string" ? ` ("${item.id}")` : "";
        errors.push(`collections.${key}[${index}]${idHint}: ${error.message}`);
      }
    });
    for (const dupe of findDuplicates(collections[key])) {
      errors.push(`collections.${key}: el id "${dupe}" está duplicado.`);
    }
  }

  // Integridad de referencias del catálogo (productos → marcas/géneros/categorías).
  const brandIds = new Set(collections.brands.map((b) => b && b.id));
  const genderIds = new Set(collections.genders.map((g) => g && g.id));
  const categoryIds = new Set(collections.categories.map((c) => c && c.id));

  collections.products.forEach((product, index) => {
    if (!product || typeof product !== "object") return;
    const hint = `collections.products[${index}]${typeof product.id === "string" ? ` ("${product.id}")` : ""}`;
    if (typeof product.brand === "string" && !brandIds.has(product.brand)) {
      errors.push(`${hint}: la marca "${product.brand}" no existe en collections.brands.`);
    }
    if (typeof product.gender === "string" && !genderIds.has(product.gender)) {
      errors.push(`${hint}: el género "${product.gender}" no existe en collections.genders.`);
    }
    if (isArray(product.categories)) {
      for (const categoryId of product.categories) {
        if (!categoryIds.has(categoryId)) {
          errors.push(`${hint}: la categoría "${categoryId}" no existe en collections.categories.`);
        }
      }
    }
  });

  // Avisos (no bloquean): colecciones omitidas presentes en el dump.
  for (const { entity, reason } of SKIPPED) {
    if ((counts[entity] ?? 0) > 0) {
      warnings.push(
        `${counts[entity]} registro(s) de "${entity}" NO se importarán (${reason}). ` +
          `Quedan preservados en el JSON.`
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings, counts };
}

// ---------------------------------------------------------------------------
// Plan de importación (puro): filas listas para upsert + omisiones
// ---------------------------------------------------------------------------

/**
 * Construye el plan ordenado de escritura a partir de un dump YA validado.
 * `product_categories` se reemplaza por producto (delete + insert) para que
 * la re-ejecución sea determinística.
 */
export function buildImportPlan(dump) {
  const c = dump.collections;
  const steps = [
    { table: "genders", entity: "genders", rows: c.genders.map(mapGenderToRow) },
    { table: "categories", entity: "categories", rows: c.categories.map(mapCategoryToRow) },
    { table: "brands", entity: "brands", rows: c.brands.map(mapBrandToRow) },
    { table: "products", entity: "products", rows: c.products.map(mapProductToRow) },
    {
      table: "product_categories",
      entity: "product_categories",
      replaceFor: c.products.map((p) => p.id),
      rows: c.products.flatMap((product) =>
        mapProductCategoryIds(product).map((category_id) => ({
          product_id: product.id,
          category_id,
        }))
      ),
    },
  ];
  return { steps, skipped: SKIPPED };
}

// ---------------------------------------------------------------------------
// Ejecución (solo con --execute): upserts por clave natural
// ---------------------------------------------------------------------------

const BATCH = 200;

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function executePlan(plan, client, log) {
  for (const step of plan.steps) {
    if (step.table === "product_categories") {
      // Reemplazo por producto importado: la re-ejecución no duplica ni deja
      // vínculos obsoletos. Solo se tocan los productos del dump.
      for (const ids of chunk([...new Set(step.replaceFor)], BATCH)) {
        const { error } = await client.from("product_categories").delete().in("product_id", ids);
        if (error) {
          throw new Error(`product_categories (delete): ${error.message} [${error.code ?? ""}]`);
        }
      }
      for (const batch of chunk(step.rows, BATCH)) {
        const { error } = await client.from("product_categories").insert(batch);
        if (error) {
          throw new Error(`product_categories (insert): ${error.message} [${error.code ?? ""}]`);
        }
      }
    } else {
      for (const batch of chunk(step.rows, BATCH)) {
        const { error } = await client.from(step.table).upsert(batch, { onConflict: "id" });
        if (error) {
          throw new Error(`${step.table}: ${error.message} [${error.code ?? ""}]`);
        }
      }
    }
    log(`  ✓ ${step.table}: ${step.rows.length} fila(s) escrita(s)`);
  }
}

async function readRemoteCounts(client) {
  const tables = ["genders", "categories", "brands", "products", "product_categories"];
  const counts = {};
  for (const table of tables) {
    const { count, error } = await client
      .from(table)
      .select("id", { count: "exact", head: true });
    if (error) {
      throw new Error(`No se pudo contar ${table}: ${error.message} [${error.code ?? ""}]`);
    }
    counts[table] = count ?? 0;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Utilidades de entorno (jamás imprimen valores)
// ---------------------------------------------------------------------------

/** Carga .env.local sin dependencias externas; no pisa variables ya definidas. */
export function loadEnvLocal(root = process.cwd()) {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return [];
  const loaded = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
      loaded.push(key);
    }
  }
  return loaded;
}

function envPresence(names) {
  return names
    .map((name) => `${name}: ${process.env[name] && process.env[name].trim() !== "" ? "presente" : "AUSENTE"}`)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { file: null, execute: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file" || arg === "-f") {
      args.file = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--execute") {
      args.execute = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (!arg.startsWith("-") && args.file === null) {
      args.file = arg;
    }
  }
  return args;
}

const USAGE = `Importación de respaldo a Supabase (Fase D)

Uso:
  node scripts/import-to-supabase.mjs --file <dump.json>            dry-run (valida y muestra el plan)
  node scripts/import-to-supabase.mjs --file <dump.json> --execute  escribe en Supabase (upsert re-ejecutable)

Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local (nunca se imprimen).
Importa solo el catálogo: genders → categories → brands → products → product_categories.
Pedidos, home y carrito quedan en el dump pero se omiten (ver motivos al ejecutar).
Códigos de salida: 0 ok · 1 dump inválido · 2 configuración · 3 escritura.`;

async function main(argv) {
  const args = parseArgs(argv);
  const log = (message) => process.stdout.write(`${message}\n`);

  if (args.help || !args.file) {
    log(USAGE);
    process.exit(args.help ? 0 : 1);
  }

  // 1) Leer y parsear el dump.
  let dump;
  try {
    dump = JSON.parse(fs.readFileSync(args.file, "utf8"));
  } catch (error) {
    log(`ERROR: no se pudo leer el dump "${args.file}": ${error.message}`);
    process.exit(1);
  }

  // 2) Validar (acumula todos los errores).
  const validation = validateDump(dump);
  log(`Dump: ${args.file}`);
  if (validation.counts) {
    log(
      `Conteos: productos ${validation.counts.products} · categorías ${validation.counts.categories} · ` +
        `marcas ${validation.counts.brands} · géneros ${validation.counts.genders} · ` +
        `pedidos ${validation.counts.orders ?? 0} · home ${validation.counts.homeSections ?? 0} · ` +
        `carrito ${validation.counts.cart ?? 0}`
    );
  }
  for (const warning of validation.warnings) log(`AVISO: ${warning}`);
  if (!validation.ok) {
    log(`\nEl dump NO es válido (${validation.errors.length} error/es):`);
    for (const error of validation.errors) log(`  - ${error}`);
    process.exit(1);
  }
  log("Validación: OK");

  // 3) Plan.
  const plan = buildImportPlan(dump);
  log("\nPlan de escritura (orden por dependencias FK):");
  for (const step of plan.steps) {
    log(`  ${step.table}: ${step.rows.length} fila(s) (upsert${step.table === "product_categories" ? " por reemplazo de vínculos" : ' por clave "id"'})`);
  }
  for (const { entity, reason } of plan.skipped) {
    log(`  omitido ${entity}: ${reason}`);
  }

  if (!args.execute) {
    log(
      "\nDRY-RUN: no se escribió nada. Re-ejecutá con --execute para aplicar el plan " +
        "(con respaldo previo recomendado, ver docs/TRANSICION_SUPABASE.md §6)."
    );
    process.exit(0);
  }

  // 4) Ejecutar (requiere credenciales; solo servidor/local).
  loadEnvLocal();
  log(`\nEntorno: ${envPresence(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])}`);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log(
      "ERROR: faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. " +
        "Completá .env.local (ver .env.example) y volvé a intentar."
    );
    process.exit(2);
  }

  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    log("ERROR: no se encontró @supabase/supabase-js. Ejecutá npm install primero.");
    process.exit(2);
  }

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "aventus-import-script" } },
  });

  log("\nEscribiendo…");
  try {
    await executePlan(plan, client, log);
  } catch (error) {
    log(`\nERROR de escritura: ${error.message}`);
    log(
      "La importación es re-ejecutable (upsert por id): corregí la causa y volvé a correr el script " +
        "con el mismo dump; no se duplicarán filas."
    );
    process.exit(3);
  }

  const remote = await readRemoteCounts(client);
  log("\nConteos en Supabase tras la importación:");
  for (const table of Object.keys(remote)) {
    log(`  ${table}: ${remote[table]}`);
  }
  log("\nIMPORTACIÓN COMPLETADA. Verificá los conteos contra el dump antes de activar el flag.");
  process.exit(0);
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`ERROR inesperado: ${error.message}\n`);
    process.exit(3);
  });
}
