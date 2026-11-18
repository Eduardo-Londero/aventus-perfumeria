import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * E2E — Flujos principales de la tienda (Paso 5 del informe final)
 * =================================================================
 * Cubre, sobre el build de producción servido por `next start`:
 *  1. Catálogo y detalle de producto.
 *  2. Carrito: cantidades, límite por stock y drawer.
 *  3. Checkout con retiro: revalidación, creación de pedido y
 *     RESERVA de stock (la base de datos del navegador descuenta unidades).
 *  4. Panel administrativo: redirección sin sesión, credenciales inválidas
 *     y acceso real con ADMIN_EMAIL / ADMIN_PASSWORD.
 *  5. Gestión de pedidos: cancelar un pedido libera la reserva exactamente
 *     una vez (verifica el flujo completo de inventario).
 *
 * El contexto (localStorage + cookies) se comparte entre tests del archivo,
 * de modo que el pedido creado en (3) es gestionado en (5) con la sesión
 * iniciada en (4). Los tests se ejecutan en orden (workers: 1).
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Los fixtures de ámbito worker se declaran en el 2.º parámetro de `extend`
const test = base.extend<{ page: Page }, { sharedContext: BrowserContext }>({
  // Contexto compartido (ámbito worker): la "base de datos" del navegador
  // (localStorage) debe persistir entre tests, como en una sesión real de compra.
  sharedContext: [
    async ({ browser }, use) => {
      const context = await browser.newContext();
      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],
  page: async ({ sharedContext }, use) => {
    const page = await sharedContext.newPage();
    await use(page);
  },
});

interface StoreProduct {
  id: string;
  slug: string;
  stock: number;
  soldCount?: number;
}

async function getProduct(page: Page, slug: string): Promise<StoreProduct | null> {
  return page.evaluate((s) => {
    const raw = localStorage.getItem("aventus-db-products");
    const list: StoreProduct[] = raw ? JSON.parse(raw) : [];
    return list.find((p) => p.slug === s) ?? null;
  }, slug);
}

async function getOrder(page: Page, id: string): Promise<Record<string, unknown> | null> {
  return page.evaluate((orderId) => {
    const raw = localStorage.getItem("aventus-db-orders");
    const list: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : [];
    return list.find((o) => o.id === orderId) ?? null;
  }, id);
}

// Estado compartido entre tests encadenados (serial implícito: workers = 1)
const flow: {
  createdOrderId: string;
  seedStock: number;
  seedSold: number;
} = { createdOrderId: "", seedStock: 0, seedSold: 0 };

const CLAMP_PRODUCT = "dior-sauvage-edt-100";
const BUY_PRODUCT = "carolina-herrera-good-girl-80";

test("1 · catálogo y detalle de producto", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Aventus/i);

  await page.goto("/perfumes");
  const cardLink = page.locator('a[href="/perfumes/dior-sauvage-edt-100"]').first();
  await expect(cardLink).toBeVisible();
  // Activación por teclado: evita interferencias del hover-zoom de la tarjeta
  await cardLink.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/perfumes\/dior-sauvage-edt-100/);
  await expect(page.getByRole("button", { name: /Agregar al carrito/i }).first()).toBeVisible();
});

test("2 · carrito: cantidades y límite por stock", async ({ page }) => {
  // (a) Límite superior: la cantidad nunca supera el stock disponible
  await page.goto(`/perfumes/${CLAMP_PRODUCT}`);
  const clampProduct = await getProduct(page, CLAMP_PRODUCT);
  expect(clampProduct).not.toBeNull();
  const maxAllowed = Math.min(clampProduct!.stock, 10);
  const detailQty = page.locator('[aria-label="Selector de cantidad"]').first();
  const plusButton = page.getByLabel("Aumentar cantidad").first();
  for (let i = 0; i < maxAllowed + 5; i += 1) {
    if (await plusButton.isDisabled()) break; // el selector se bloquea en el máximo
    await plusButton.click();
  }
  await expect(detailQty).toContainText(String(maxAllowed));

  // (b) Flujo real de compra: agregar al carrito y operar el drawer
  await page.goto(`/perfumes/${BUY_PRODUCT}`);
  const before = await getProduct(page, BUY_PRODUCT);
  expect(before).not.toBeNull();
  flow.seedStock = before!.stock;
  flow.seedSold = before!.soldCount ?? 0;

  await page.getByRole("button", { name: /Agregar al carrito/i }).first().click();

  // Al agregar, el drawer del carrito se abre automáticamente (por diseño)
  const drawer = page.locator('[aria-label="Carrito de compras"]');
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText(/Good Girl/i);

  const drawerQty = drawer.locator('[aria-label="Selector de cantidad"]');
  await drawer.getByLabel("Aumentar cantidad").click();
  await expect(drawerQty).toContainText("2");
  await drawer.getByLabel("Disminuir cantidad").click();
  await expect(drawerQty).toContainText("1");
  // queda en 2 unidades para el checkout del test siguiente
  await drawer.getByLabel("Aumentar cantidad").click();
  await expect(drawerQty).toContainText("2");

  await page.getByLabel("Cerrar carrito").click();
});

test("3 · checkout con retiro: pedido y reserva de stock", async ({ page }) => {
  await page.goto("/checkout");

  // El retiro en local es la modalidad por defecto y no debe exigir dirección
  await expect(page.locator('input[name="deliveryMethod"][value="retiro"]')).toBeChecked();

  await page.locator('input[name="name"]').fill("E2E");
  await page.locator('input[name="lastName"]').fill("Prueba");
  await page.locator('input[name="phone"]').fill("1122334455");
  await page.locator('input[name="email"]').fill("e2e@prueba.test");

  await page.locator('button[type="submit"]').click();

  await expect(page.getByRole("heading", { name: "Pedido generado" })).toBeVisible();
  const numberEl = await page
    .locator("p")
    .filter({ hasText: /#AV-\d+/ })
    .first()
    .textContent();
  const match = (numberEl ?? "").match(/AV-\d+/);
  expect(match).not.toBeNull();
  flow.createdOrderId = match![0];

  // El pedido quedó persistido con la reserva de stock activa
  const order = await getOrder(page, flow.createdOrderId);
  expect(order).not.toBeNull();
  expect(order!.deliveryMethod).toBe("retiro");
  expect(order!.shippingCost).toBe(0);
  expect(order!.status).toBe("no-concretado");
  expect(order!.stockReserved).toBe(true);

  // El inventario del navegador descontó exactamente las 2 unidades
  const after = await getProduct(page, BUY_PRODUCT);
  expect(after!.stock).toBe(flow.seedStock - 2);
  expect(after!.soldCount).toBe(flow.seedSold + 2);
});

test("4 · panel admin: redirección, credenciales inválidas y acceso real", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForURL(/\/login\?/);
  expect(page.url()).toContain("reason=login_required");

  await page.locator('input[name="email"]').fill(ADMIN_EMAIL ?? "admin@aventus.test");
  await page.locator('input[name="password"]').fill("clave-totalmente-invalida");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2000);
  expect(page.url()).toContain("/login"); // sin sesión: no avanza

  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "ADMIN_EMAIL / ADMIN_PASSWORD no configurados: no se prueba el acceso real"
  );

  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/admin$/);
  await expect(page.getByText("Ventas confirmadas", { exact: true })).toBeVisible();
});

test("5 · gestión de pedidos: cancelar libera el stock reservado", async ({ page }) => {
  test.skip(!flow.createdOrderId, "Sin pedido creado por el test 3");
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "ADMIN_EMAIL / ADMIN_PASSWORD no configurados: el panel requiere sesión"
  );

  await page.goto("/admin/pedidos"); // la cookie de sesión sigue vigente en el contexto

  // La fila del pedido en la tabla de gestión (elemento <tr> con onClick)
  const row = page.getByRole("row").filter({ hasText: flow.createdOrderId }).first();
  await expect(row).toBeVisible();
  await row.click();

  // El detalle del pedido quedó seleccionado (encabezado "Pedido #AV-XXXX")
  await expect(
    page.getByRole("heading", { name: `Pedido #${flow.createdOrderId}` })
  ).toBeVisible();

  await page.locator("select").selectOption("cancelado");
  await expect(page.locator("select")).toHaveValue("cancelado");

  // La cancelación devolvió exactamente una vez las unidades reservadas
  const order = await getOrder(page, flow.createdOrderId);
  expect(order!.status).toBe("cancelado");
  expect(order!.stockReserved).toBe(false);

  const restored = await getProduct(page, BUY_PRODUCT);
  expect(restored!.stock).toBe(flow.seedStock);
  expect(restored!.soldCount).toBe(flow.seedSold);
});

test("6 · móvil (390×844): catálogo, carrito, checkout y login", async ({ browser }) => {
  // Contexto propio con viewport móvil (el compartido del worker es desktop)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();

  try {
    await page.goto("/perfumes");
    await expect(page.getByRole("heading", { name: "Perfumes" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Agregar al carrito/i }).first()).toBeVisible();

    // Agregar al carrito y operar el drawer en tamaño móvil
    await page.getByRole("button", { name: /Agregar al carrito/i }).first().click();
    const drawer = page.locator('[aria-label="Carrito de compras"]');
    await expect(drawer).toBeVisible();
    await page.getByLabel("Cerrar carrito").click();

    // Formularios clave utilizables en móvil
    await page.goto("/checkout");
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await page.goto("/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  } finally {
    await context.close();
  }
});
