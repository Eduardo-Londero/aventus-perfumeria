import { hasAndreaniConfig } from "./config";
import type { ShippingAddress, PackageInfo, ShippingQuoteResult, ShippingProvider } from "./types";

export const andreaniProvider: ShippingProvider = {
  name: "Andreani",
  id: "andreani",
  isConfigured() {
    return hasAndreaniConfig();
  },
  async getQuotes(_address: ShippingAddress, _pkg: PackageInfo): Promise<ShippingQuoteResult> {
    if (!hasAndreaniConfig()) {
      return {
        provider: "andreani",
        configured: false,
        ok: false,
        message:
          "Andreani no está configurado. Definí ANDREANI_API_BASE y credenciales en el entorno (ver docs).",
        quotes: [],
      };
    }
    // La integración real con la API de Andreani requiere la documentación
    // oficial y credenciales habilitadas. Se deja la estructura lista para
    // implementar los endpoints (cotización, generación, tracking) sin
    // inventar contratos de API.
    return {
      provider: "andreani",
      configured: true,
      ok: false,
      message:
        "Andreani está configurado pero la integración de cotización aún no está implementada (pendiente de documentación oficial de la API).",
      quotes: [],
    };
  },
};