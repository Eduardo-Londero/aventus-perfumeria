// Genera el dump del catálogo (aventus-dump.json) a partir de las semillas
// del repo, listo para importar con scripts/import-to-supabase.mjs.
// Ejecutar vía esbuild (ver comando en scripts/README o más abajo):
//   npx esbuild scripts/build-aventus-dump.ts --bundle --platform=node --format=esm \
//       --outfile=scripts/.build/dump.mjs --alias:@=./src
//   node scripts/.build/dump.mjs

// Polyfill mínimo de navegador (initializeDatabase + readCollection usan
// localStorage/window). Debe ir ANTES de importar db.ts.
if (typeof (globalThis as { localStorage?: unknown }).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}
if (typeof (globalThis as { window?: unknown }).window === "undefined") {
  (globalThis as { window: unknown }).window = globalThis;
}

import { initializeDatabase } from "@/lib/db";
import { buildDump, collectCollections } from "@/lib/exportData";
import * as fs from "node:fs";

initializeDatabase();
const collections = collectCollections();
const dump = buildDump(collections, { backend: "localStorage" });

const outPath = "aventus-dump.json";
fs.writeFileSync(outPath, JSON.stringify(dump, null, 2));
console.log("DUMP_OK");
console.log(JSON.stringify(dump.counts));
console.log("archivo:", outPath, "bytes:", fs.statSync(outPath).size);