import { hasAndreaniConfig } from "./config";
import type { ShippingAddress, PackageInfo, ShippingQuoteResult, ShippingProvider } from "./types";

async function andreaniFetch(path: string, init: RequestInit = {}): Promise<any> {
  const base = (process.env.ANDREANI_API_BASE || "").replace(/\/$/, "");
  if (!base) throw new Error("ANDREANI_API_BASE no configurado.");
  const url = `${base}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(process.env.ANDREANI_API_KEY ? { Authorization: `Bearer ${process.env.ANDREANI_API_KEY}` } : {}),
    ...(process.env.ANDREANI_USERNAME ? { "X-Username": process.env.ANDREANI_USERNAME } : {}),
    ...(process.env.ANDREANI_PASSWORD ? { "X-Password": process.env.ANDREANI_PASSWORD } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(typeof data === "string" ? data : data?.message || `Andreani ${res.status}`);
  }
  return data;
}

export const andreaniProvider: ShippingProvider = {
  name: "Andreani",
  id: "andreani",
  isConfigured() {
    return hasAndreaniConfig();
  },
  async getQuotes(address: ShippingAddress, pkg: PackageInfo): Promise<ShippingQuoteResult> {
    if (!hasAndreaniConfig()) {
      return { provider: "andreani", configured: false, ok: false, message: "Andreani no configurado.", quotes: [] };
    }
    // Cotización real: requiere documentación oficial de la API de Andreani.
    // Si se define ANDREANI_QUOTE_ENDPOINT, se intenta usarlo.
    const quoteEndpoint = process.env.ANDREANI_QUOTE_ENDPOINT?.trim();
    if (!quoteEndpoint) {
      return {
        provider: "andreani",
        configured: true,
        ok: false,
        message: "Andreani configurado pero la cotización no está implementada (falta ANDREANI_QUOTE_ENDPOINT o documentación oficial).",
        quotes: [],
      };
    }
    try {
      const data = await andreaniFetch(quoteEndpoint, {
        method: "POST",
        body: JSON.stringify({ address, package: pkg }),
      });
      // Mapeo genérico: se espera un array de opciones con price/service
      const options = Array.isArray(data) ? data : (data?.options || data?.quotes || []);
      const quotes = options.map((o: any) => ({
        provider: "andreani" as const,
        service: o.service || o.serviceType || "Andreani",
        price: Number(o.price || o.amount || 0),
        estimatedDays: o.estimatedDays || o.deliveryTime,
        raw: o,
      }));
      return { provider: "andreani", configured: true, ok: true, quotes };
    } catch (err) {
      return {
        provider: "andreani",
        configured: true,
        ok: false,
        message: err instanceof Error ? err.message : "Error cotizando con Andreani.",
        quotes: [],
      };
    }
  },
  async createShipment(input: any): Promise<{ ok: boolean; message?: string; trackingCode?: string }> {
    if (!hasAndreaniConfig()) return { ok: false, message: "Andreani no configurado." };
    const endpoint = process.env.ANDREANI_CREATE_ENDPOINT?.trim();
    if (!endpoint) return { ok: false, message: "Falta ANDREANI_CREATE_ENDPOINT (implementación pendiente)." };
    try {
      const data = await andreaniFetch(endpoint, { method: "POST", body: JSON.stringify(input) });
      const tn = data?.trackingNumber || data?.tracking_number || data?.id;
      return { ok: true, trackingCode: tn };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error creando envío." };
    }
  },
  async cancelShipment(trackingNumber: string): Promise<{ ok: boolean; message?: string }> {
    if (!hasAndreaniConfig()) return { ok: false, message: "Andreani no configurado." };
    const endpoint = process.env.ANDREANI_CANCEL_ENDPOINT?.trim();
    if (!endpoint) return { ok: false, message: "Falta ANDREANI_CANCEL_ENDPOINT (implementación pendiente)." };
    try {
      await andreaniFetch(`${endpoint}/${encodeURIComponent(trackingNumber)}`, { method: "DELETE" });
      return { ok: true, message: "Cancelado." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error cancelando." };
    }
  },
  async generateLabel(trackingNumbers: string[]): Promise<{ ok: boolean; message?: string; files?: any[] }> {
    if (!hasAndreaniConfig()) return { ok: false, message: "Andreani no configurado." };
    const endpoint = process.env.ANDREANI_LABEL_ENDPOINT?.trim();
    if (!endpoint) return { ok: false, message: "Falta ANDREANI_LABEL_ENDPOINT (implementación pendiente)." };
    try {
      const data = await andreaniFetch(endpoint, { method: "POST", body: JSON.stringify({ trackingNumbers }) });
      return { ok: true, files: Array.isArray(data) ? data : [data] };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error generando rótulo." };
    }
  },
  async getTracking(trackingCode: string): Promise<{ ok: boolean; message?: string; status?: string; url?: string; data?: any }> {
    if (!hasAndreaniConfig()) return { ok: false, message: "Andreani no configurado." };
    const endpoint = process.env.ANDREANI_TRACKING_ENDPOINT?.trim();
    if (!endpoint) return { ok: false, message: "Falta ANDREANI_TRACKING_ENDPOINT (implementación pendiente)." };
    try {
      const data = await andreaniFetch(`${endpoint}/${encodeURIComponent(trackingCode)}`, { method: "GET" });
      return { ok: true, status: data?.status, data };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error consultando tracking." };
    }
  },
};