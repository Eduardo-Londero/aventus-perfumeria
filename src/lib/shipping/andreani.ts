import { hasAndreaniConfig } from "./config";
import type { ShippingAddress, PackageInfo, ShippingQuote, ShippingQuoteResult, ShippingProvider } from "./types";

function andreaniBase(): string {
  const debug = (process.env.ANDREANI_DEBUG || "").toLowerCase() === "true";
  return debug ? "https://apisqa.andreani.com" : "https://apis.andreani.com";
}

async function andreaniLogin(): Promise<string> {
  const username = process.env.ANDREANI_USERNAME?.trim() || "";
  const password = process.env.ANDREANI_PASSWORD?.trim() || "";
  const hash = Buffer.from(`${username}:${password}`).toString("base64");
  const res = await fetch(`${andreaniBase()}/login`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${hash}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Andreani login falló: ${res.status}`);
  }
  const token =
    res.headers.get("x-authorization-token") ||
    res.headers.get("X-Authorization-Token") ||
    res.headers.get("x-authorization-token");
  if (!token) throw new Error("Andreani no devolvió token de autorización.");
  return token;
}

async function andreaniFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await andreaniLogin();
  const res = await fetch(`${andreaniBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-authorization-token": token,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
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
    const contrato = process.env.ANDREANI_CONTRATO?.trim() || "";
    const cliente = process.env.ANDREANI_CLIENTE?.trim() || "";
    const sucursalOrigen = process.env.ANDREANI_SUCURSAL_ORIGEN?.trim() || "";
    const bultos = [
      {
        altoCm: pkg.heightCm,
        anchoCm: pkg.widthCm,
        largoCm: pkg.lengthCm,
        kilos: pkg.weightGrams / 1000,
        valorDeclarado: 0,
      },
    ];
    const params = new URLSearchParams();
    params.set("cpDestino", address.postalCode);
    params.set("contrato", contrato);
    params.set("cliente", cliente);
    if (sucursalOrigen) params.set("sucursalOrigen", sucursalOrigen);
    // bultos as JSON string
    params.set("bultos", JSON.stringify(bultos));

    try {
      const data = await andreaniFetch(`/v1/tarifas?${params.toString()}`, { method: "GET" });
      // Mapeo genérico: Andreani devuelve un array de tarifas o un objeto
      const items = Array.isArray(data) ? data : (data?.tarifas || data?.options || [data]);
      const quotes: ShippingQuote[] = items
        .filter((it: any) => it && (it.tarifa || it.precio || it.amount || it.price))
        .map((it: any) => ({
          provider: "andreani" as const,
          service: it.servicio || it.service || it.modalidad || "Andreani",
          price: Number(it.tarifa || it.precio || it.amount || it.price || 0),
          estimatedDays: it.plazoEntrega || it.estimatedDays || it.tiempoEntrega,
          raw: it,
        }));
      if (quotes.length === 0) {
        // Fallback: maybe data itself is a single tarifa
        const price = Number(data?.tarifa || data?.precio || data?.amount || data?.price || 0);
        if (price > 0) {
          quotes.push({ provider: "andreani", service: data?.servicio || "Andreani", price, estimatedDays: data?.plazoEntrega, raw: data });
        }
      }
      return { provider: "andreani", configured: true, ok: quotes.length > 0, message: quotes.length === 0 ? "Sin tarifas disponibles." : undefined, quotes };
    } catch (err) {
      return { provider: "andreani", configured: true, ok: false, message: err instanceof Error ? err.message : "Error cotizando con Andreani.", quotes: [] };
    }
  },
  async createShipment(input: any): Promise<{ ok: boolean; message?: string; trackingCode?: string }> {
    if (!hasAndreaniConfig()) return { ok: false, message: "Andreani no configurado." };
    try {
      const data = await andreaniFetch("/v2/ordenes-de-envio", { method: "POST", body: JSON.stringify(input) });
      const tn = data?.numeroAndreani || data?.numeroEnvio || data?.trackingNumber || data?.id;
      return { ok: true, trackingCode: tn };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error creando envío." };
    }
  },
  async cancelShipment(_trackingNumber: string): Promise<{ ok: boolean; message?: string }> {
    // Andreani no expone cancelación en esta API (según SDK). Se deja como no soportado.
    return { ok: false, message: "Cancelación no soportada por la API de Andreani." };
  },
  async generateLabel(trackingNumber: string, tipo: string = ""): Promise<{ ok: boolean; message?: string; fileBase64?: string; fileName?: string }> {
    if (!hasAndreaniConfig()) return { ok: false, message: "Andreani no configurado." };
    try {
      const suffix = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
      const token = await andreaniLogin();
      const res = await fetch(`${andreaniBase()}/v2/ordenes-de-envio/${encodeURIComponent(trackingNumber)}/etiquetas${suffix}`, {
        method: "GET",
        headers: { "x-authorization-token": token },
      });
      if (!res.ok) throw new Error(`Andreani ${res.status}`);
      const buf = await res.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      return { ok: true, fileBase64: base64, fileName: `${trackingNumber}.pdf` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error generando etiqueta." };
    }
  },
  async getTracking(trackingCode: string): Promise<{ ok: boolean; message?: string; status?: string; url?: string; data?: any }> {
    if (!hasAndreaniConfig()) return { ok: false, message: "Andreani no configurado." };
    try {
      const data = await andreaniFetch(`/v1/envios/${encodeURIComponent(trackingCode)}/trazas`, { method: "GET" });
      const status = Array.isArray(data) ? data[data.length - 1]?.estado || data[data.length - 1]?.status : data?.estado || data?.status;
      return { ok: true, status, data };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error consultando tracking." };
    }
  },
};