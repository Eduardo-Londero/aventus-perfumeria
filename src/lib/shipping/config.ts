export function hasAndreaniConfig(): boolean {
  return !!(
    process.env.ANDREANI_API_BASE?.trim() &&
    (process.env.ANDREANI_USERNAME?.trim() || process.env.ANDREANI_API_KEY?.trim())
  );
}

export function hasCorreoArgentinoConfig(): boolean {
  return !!(
    process.env.CORREO_ARGENTINO_API_BASE?.trim() &&
    process.env.CORREO_ARGENTINO_API_KEY?.trim()
  );
}

export function getAndreaniConfig() {
  return {
    base: process.env.ANDREANI_API_BASE?.trim() || "",
    username: process.env.ANDREANI_USERNAME?.trim() || "",
    password: process.env.ANDREANI_PASSWORD?.trim() || "",
    apiKey: process.env.ANDREANI_API_KEY?.trim() || "",
    clientId: process.env.ANDREANI_CLIENT_ID?.trim() || "",
    originPostalCode: process.env.SHIPPING_ORIGIN_POSTAL_CODE?.trim() || "",
  };
}

export function getCorreoArgentinoConfig() {
  return {
    base: process.env.CORREO_ARGENTINO_API_BASE?.trim() || "",
    apiKey: process.env.CORREO_ARGENTINO_API_KEY?.trim() || "",
    originPostalCode: process.env.SHIPPING_ORIGIN_POSTAL_CODE?.trim() || "",
  };
}