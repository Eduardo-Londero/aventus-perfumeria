import { andreaniProvider } from "./andreani";
import { correoArgentinoProvider } from "./correoArgentino";
import type { ShippingAddress, PackageInfo, ShippingQuote, ShippingQuoteResult } from "./types";

export * from "./types";
export * from "./config";

export const shippingProviders = [andreaniProvider, correoArgentinoProvider];

export function getShippingProviderStatus() {
  return shippingProviders.map((p) => ({
    id: p.id,
    name: p.name,
    configured: p.isConfigured(),
  }));
}

export async function getShippingQuotes(
  address: ShippingAddress,
  pkg: PackageInfo
): Promise<{ quotes: ShippingQuote[]; results: ShippingQuoteResult[] }> {
  const results = await Promise.all(shippingProviders.map((p) => p.getQuotes(address, pkg)));
  const quotes = results.flatMap((r) => r.quotes);
  return { quotes, results };
}