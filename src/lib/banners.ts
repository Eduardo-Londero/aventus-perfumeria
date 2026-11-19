/**
 * Banners promocionales — lógica pura del CMS
 * ============================================
 * Módulo SIN I/O compartido por el servidor (tienda), el panel de
 * administración y el servicio de escritura: la lista blanca de tipos, el
 * control de vigencia por fechas y el estado que se muestra en el panel.
 *
 * Reglas de vigencia (fechas opcionales, formato `YYYY-MM-DD`):
 *   - `startDate` vacío → sin límite inferior;
 *   - `endDate` vacío   → sin límite superior;
 *   - sin ninguna fecha → el banner siempre está vigente mientras esté activo.
 * La comparación es de FECHAS en texto ISO (lexicográfica), no de instantes:
 * así no aparecen falsos negativos por zona horaria.
 */
import type { Banner } from "@/types/cms";

export const BANNER_TYPES = [
  "promotion",
  "discount",
  "collection",
  "season",
  "launch",
  "campaign",
] as const;

export type BannerType = (typeof BANNER_TYPES)[number];

export function isBannerType(value: unknown): value is BannerType {
  return (
    typeof value === "string" && (BANNER_TYPES as readonly string[]).includes(value)
  );
}

/** Etiqueta legible de cada tipo (para el select del panel). */
export const BANNER_TYPE_LABELS: Record<BannerType, string> = {
  promotion: "Promoción",
  discount: "Descuento",
  collection: "Colección",
  season: "Temporada",
  launch: "Lanzamiento",
  campaign: "Campaña",
};

/** `YYYY-MM-DD` en hora local (para comparar contra los campos del banner). */
export function toDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** ¿El banner corresponde mostrar HOY? (activo + dentro del rango de fechas) */
export function isBannerActiveOn(banner: Banner, today: string = toDateKey()): boolean {
  if (!banner.isActive) return false;
  if (banner.startDate && today < banner.startDate) return false;
  if (banner.endDate && today > banner.endDate) return false;
  return true;
}

export type BannerStatus = "active" | "scheduled" | "expired" | "inactive";

/**
 * Estado para la etiqueta del panel. Sirve para que quien administra entienda
 * POR QUÉ un banner no aparece en la página (programado / vencido / inactivo).
 */
export function bannerStatus(
  banner: Banner,
  today: string = toDateKey()
): BannerStatus {
  if (!banner.isActive) return "inactive";
  if (banner.startDate && today < banner.startDate) return "scheduled";
  if (banner.endDate && today > banner.endDate) return "expired";
  return "active";
}

export const BANNER_STATUS_LABELS: Record<BannerStatus, string> = {
  active: "Vigente",
  scheduled: "Programado",
  expired: "Vencido",
  inactive: "Inactivo",
};

/** Los que la tienda debe mostrar hoy, en orden. */
export function selectVisibleBanners(
  banners: Banner[],
  today: string = toDateKey()
): Banner[] {
  return banners
    .filter((banner) => isBannerActiveOn(banner, today))
    .sort((a, b) => a.order - b.order);
}
