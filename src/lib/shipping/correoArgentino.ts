import { hasCorreoArgentinoConfig } from "./config";
import type { ShippingAddress, PackageInfo, ShippingQuoteResult, ShippingProvider } from "./types";

export const correoArgentinoProvider: ShippingProvider = {
  name: "Correo Argentino",
  id: "correo_argentino",
  isConfigured() {
    return hasCorreoArgentinoConfig();
  },
  async getQuotes(_address: ShippingAddress, _pkg: PackageInfo): Promise<ShippingQuoteResult> {
    if (!hasCorreoArgentinoConfig()) {
      return {
        provider: "correo_argentino",
        configured: false,
        ok: false,
        message:
          "Correo Argentino no está configurado. Definí CORREO_ARGENTINO_API_BASE y CORREO_ARGENTINO_API_KEY en el entorno (ver docs).",
        quotes: [],
      };
    }
    return {
      provider: "correo_argentino",
      configured: true,
      ok: false,
      message:
        "Correo Argentino está configurado pero la integración de cotización aún no está implementada (pendiente de documentación oficial de la API).",
      quotes: [],
    };
  },
};