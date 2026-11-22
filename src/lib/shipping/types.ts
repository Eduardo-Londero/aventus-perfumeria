export interface ShippingAddress {
  postalCode: string;
  city?: string;
  province?: string;
  street?: string;
}

export interface PackageInfo {
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
}

export interface ShippingQuote {
  provider: "andreani" | "correo_argentino";
  service: string;
  price: number; // en pesos
  estimatedDays?: string;
  raw?: unknown;
}

export interface ShippingQuoteResult {
  provider: "andreani" | "correo_argentino";
  configured: boolean;
  ok: boolean;
  message?: string;
  quotes: ShippingQuote[];
}

export interface ShippingProvider {
  name: string;
  id: "andreani" | "correo_argentino";
  isConfigured(): boolean;
  getQuotes(address: ShippingAddress, pkg: PackageInfo): Promise<ShippingQuoteResult>;
  createShipment?(...args: any[]): Promise<{ ok: boolean; message?: string; trackingCode?: string }>;
  cancelShipment?(trackingCode: string): Promise<{ ok: boolean; message?: string }>;
  generateLabel?(trackingNumbers: string[], format?: string): Promise<{ ok: boolean; message?: string; files?: any[] }>;
  getBranches?(stateId?: string, pickup?: boolean, reception?: boolean): Promise<{ ok: boolean; message?: string; data?: any }>;
  getTracking?(trackingCode: string): Promise<{ ok: boolean; message?: string; status?: string; url?: string; data?: any }>;
}