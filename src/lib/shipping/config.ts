export function hasAndreaniConfig(): boolean {
  return !!(
    process.env.ANDREANI_USERNAME?.trim() &&
    process.env.ANDREANI_PASSWORD?.trim() &&
    process.env.ANDREANI_CLIENTE?.trim() &&
    process.env.ANDREANI_CONTRATO?.trim()
  );
}

export function hasCorreoArgentinoConfig(): boolean {
  return !!(
    process.env.CORREO_ARGENTINO_API_KEY?.trim() &&
    process.env.CORREO_ARGENTINO_AGREEMENT?.trim()
  );
}

export function getAndreaniConfig() {
  return {
    base: process.env.ANDREANI_DEBUG?.toLowerCase() === "true"
      ? "https://apisqa.andreani.com"
      : "https://apis.andreani.com",
    username: process.env.ANDREANI_USERNAME?.trim() || "",
    password: process.env.ANDREANI_PASSWORD?.trim() || "",
    cliente: process.env.ANDREANI_CLIENTE?.trim() || "",
    contrato: process.env.ANDREANI_CONTRATO?.trim() || "",
    sucursalOrigen: process.env.ANDREANI_SUCURSAL_ORIGEN?.trim() || "",
    originPostalCode: process.env.SHIPPING_ORIGIN_POSTAL_CODE?.trim() || "",
  };
}

export function getCorreoArgentinoConfig() {
  return {
    base: process.env.CORREO_ARGENTINO_API_BASE?.trim() || "https://api.correoargentino.com.ar/paqar/v1",
    apiKey: process.env.CORREO_ARGENTINO_API_KEY?.trim() || "",
    agreement: process.env.CORREO_ARGENTINO_AGREEMENT?.trim() || "",
    originPostalCode: process.env.SHIPPING_ORIGIN_POSTAL_CODE?.trim() || "",
  };
}