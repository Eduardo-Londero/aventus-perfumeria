/**
 * Declaración de tipos de scripts/import-to-supabase.mjs (Fase D)
 * ===============================================================
 * El script corre con Node puro (sin build); estas firmas solo alimentan el
 * typecheck de las pruebas de paridad (src/lib/importScript.parity.test.ts),
 * que ejecutan el .mjs REAL en runtime. Si el script cambia una firma, la
 * paridad lo delata en las pruebas.
 */

export const DUMP_FORMAT: "aventus-dump";
export const DUMP_VERSION: 1;

export interface ScriptStep {
  table: string;
  entity: string;
  rows: Array<Record<string, unknown>>;
  replaceFor?: string[];
}

export interface ScriptSkipped {
  entity: string;
  reason: string;
}

export interface ScriptPlan {
  steps: ScriptStep[];
  skipped: ScriptSkipped[];
}

export interface ScriptValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counts: Record<string, number> | null;
}

export const SKIPPED: ScriptSkipped[];

export function mapGenderToRow(value: unknown): Record<string, unknown>;
export function mapCategoryToRow(value: unknown): Record<string, unknown>;
export function mapBrandToRow(value: unknown): Record<string, unknown>;
export function mapProductToRow(value: unknown): Record<string, unknown>;
export function mapProductCategoryIds(value: unknown): string[];

export function validateDump(dump: unknown): ScriptValidation;
// El script solo lee `dump.collections.<colecccion>`; la forma exacta la
// valida `validateDump` en runtime.
export function buildImportPlan(dump: { collections: object }): ScriptPlan;

export function loadEnvLocal(root?: string): string[];
