import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Configuración E2E — Aventus Perfumería
 * =======================================
 * Ejecuta los flujos reales de la tienda contra un `next start` con el build
 * production (no se prueba `next dev`).
 *
 * Requisitos:
 *  1. `npm run build` previo (el servidor sirve `.next`).
 *  2. Microsoft Edge instalado: se usa el canal "msedge" para no descargar
 *     navegadores adicionales.
 *  3. Si no existe servidor en el puerto 3210, Playwright lo levanta solo
 *     (`webServer`) y lo reutiliza si ya está corriendo.
 *
 * Variables (opcionales, se leen de .env.local SOLO en Node, nunca se imprimen):
 *  - ADMIN_EMAIL / ADMIN_PASSWORD: credenciales del panel; si faltan, los
 *    tests de acceso administrativo se omiten explícitamente.
 */

function loadEnvLocal(): void {
  const file = path.join(__dirname, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key]) continue; // el entorno real tiene prioridad
    process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:3210",
    channel: "msedge",
    headless: true,
    trace: "off",
    // Falla rápido y con nombre de localizador en vez de colgar hasta el
    // timeout global del test (más fácil de diagnosticar).
    actionTimeout: 15_000,
  },
  webServer: {
    command: "npx next start -p 3210",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
