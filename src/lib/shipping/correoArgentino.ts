import { getCorreoArgentinoConfig, hasCorreoArgentinoConfig } from "./config";
import type { ShippingAddress, PackageInfo, ShippingQuoteResult, ShippingProvider } from "./types";

async function caFetch(path: string, init: RequestInit = {}): Promise<any> {
  const cfg = getCorreoArgentinoConfig();
  const url = `${cfg.base.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Apikey ${cfg.apiKey}`,
    agreement: cfg.agreement,
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(typeof data === "string" ? data : data?.message || `Correo Argentino ${res.status}`);
  }
  return data;
}

export const correoArgentinoProvider: ShippingProvider = {
  name: "Correo Argentino",
  id: "correo_argentino",
  isConfigured() {
    return hasCorreoArgentinoConfig();
  },
  async getQuotes(_address: ShippingAddress, _pkg: PackageInfo): Promise<ShippingQuoteResult> {
    if (!hasCorreoArgentinoConfig()) {
      return { provider: "correo_argentino", configured: false, ok: false, message: "Correo Argentino no configurado.", quotes: [] };
    }
    // La API de Paq.ar no expone cotización; el costo se define por acuerdo comercial.
    return { provider: "correo_argentino", configured: true, ok: true, message: "Sin cotización automática; costo según acuerdo comercial.", quotes: [] };
  },
  async createShipment(input: any): Promise<{ ok: boolean; message?: string; trackingCode?: string }> {
    if (!hasCorreoArgentinoConfig()) return { ok: false, message: "Correo Argentino no configurado." };
    try {
      const data = await caFetch("/orders", { method: "POST", body: JSON.stringify(input) });
      const tn = data?.trackingNumber || data?.tracking_number || (Array.isArray(data) ? data[0]?.trackingNumber : undefined);
      return { ok: true, trackingCode: tn };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error creando envío." };
    }
  },
  async cancelShipment(trackingNumber: string): Promise<{ ok: boolean; message?: string }> {
    if (!hasCorreoArgentinoConfig()) return { ok: false, message: "Correo Argentino no configurado." };
    try {
      await caFetch(`/orders/${encodeURIComponent(trackingNumber)}/cancel`, { method: "PATCH" });
      return { ok: true, message: "Cancelado." };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error cancelando." };
    }
  },
  async generateLabel(trackingNumbers: string[], format: string = "10x15"): Promise<{ ok: boolean; message?: string; files?: any[] }> {
    if (!hasCorreoArgentinoConfig()) return { ok: false, message: "Correo Argentino no configurado." };
    try {
      const body = trackingNumbers.map((tn) => ({ sellerId: "", trackingNumber: tn }));
      const data = await caFetch(`/labels?labelFormat=${encodeURIComponent(format)}`, { method: "POST", body: JSON.stringify(body) });
      return { ok: true, files: Array.isArray(data) ? data : [data] };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error generando rótulo." };
    }
  },
  async getTracking(trackingCode: string): Promise<{ ok: boolean; message?: string; status?: string; url?: string; data?: any }> {
    if (!hasCorreoArgentinoConfig()) return { ok: false, message: "Correo Argentino no configurado." };
    try {
      const data = await caFetch(`/tracking`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ trackingNumber: trackingCode }]),
      });
      const entry = Array.isArray(data) ? data[0] : data;
      const status = entry?.event?.[0]?.status || entry?.status;
      return { ok: true, status, data };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error consultando tracking." };
    }
  },
  async getBranches(stateId?: string, pickup?: boolean, reception?: boolean): Promise<{ ok: boolean; message?: string; data?: any }> {
    if (!hasCorreoArgentinoConfig()) return { ok: false, message: "Correo Argentino no configurado." };
    try {
      const params = new URLSearchParams();
      if (stateId) params.set("stateId", stateId);
      if (pickup !== undefined) params.set("pickup_availability", String(pickup));
      if (reception !== undefined) params.set("package_reception", String(reception));
      const qs = params.toString();
      const data = await caFetch(`/agencies${qs ? `?${qs}` : ""}`, { method: "GET" });
      return { ok: true, data };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error consultando sucursales." };
    }
  },
};