/**
 * UUID v5 determinístico (RFC 4122) — Fase E
 * ===========================================
 * Genera UUIDs determinísticos a partir de un espacio de nombres (namespace)
 * y un nombre. Se usa para dar identificadores estables a pedidos, ítems y
 * eventos de historial migrados: sin esto, una importación re-ejecutable
 * (upsert) no podría reconciliar filas (la base no permite DELETE en
 * orders/order_items/order_status_history).
 *
 * Implementación pura (SHA-1 + codificación) para no depender de `node:crypto`
 * ni de librerías externas: corre en Node y en el navegador por igual.
 *
 * NOTA: el namespace es una constante propia del proyecto; el resultado es un
 * UUID v5 válido (versión 5, variante 10xx) y determinístico, pero no es el
 * UUID v5 de los namespaces estándar (DNS/URL/OID/X500) salvo que se pase uno
 * de esos como `namespace`. Para este proyecto eso es deseable: es el
 * identificador canónico derivado del id legacy.
 */
export const AVT_NAMESPACE = "a57e4f1c-9b3d-4c2e-8f60-1d2b3c4d5e6f";

export function sha1Bytes(input: Uint8Array): Uint8Array {
  const ml = input.length * 8;
  const paddedLength = (((input.length + 8) >> 6) + 1) * 64;
  const buf = new Uint8Array(paddedLength);
  buf.set(input);
  buf[input.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLength - 8, Math.floor(ml / 0x100000000), false);
  view.setUint32(paddedLength - 4, ml >>> 0, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Int32Array(80);

  for (let i = 0; i < paddedLength; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 80; t++) {
      const n = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
      w[t] = (n << 1) | (n >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const tmp = (a << 5) | (a >>> 27);
      const sum = (tmp + f) | 0;
      const sum2 = (sum + e) | 0;
      const sum3 = (sum2 + k) | 0;
      const sum4 = (sum3 + w[t]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = sum4;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0 >>> 0, false);
  ov.setUint32(4, h1 >>> 0, false);
  ov.setUint32(8, h2 >>> 0, false);
  ov.setUint32(12, h3 >>> 0, false);
  ov.setUint32(16, h4 >>> 0, false);
  return out;
}

function parseUuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error(`namespace inválido: ${uuid}`);
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function uuidv5(namespace: string, name: string): string {
  const nsBytes = parseUuidBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const hash = sha1Bytes(concatBytes(nsBytes, nameBytes));
  const bytes = hash.slice(0, 16);
  // versión 5
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // variante 10xx
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20, 32)}`;
}
