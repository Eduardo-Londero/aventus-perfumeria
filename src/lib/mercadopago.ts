/**
 * Integración con Mercado Pago (Checkout Pro).
 * ============================================
 * Toda la lógica server-side vive acá. El frontend nunca toca el access token.
 *
 * Variables de entorno:
 *   - MERCADOPAGO_ACCESS_TOKEN (obligatoria para operar)
 *   - MERCADOPAGO_WEBHOOK_SECRET (obligatoria para validar webhooks)
 *   - NEXT_PUBLIC_SITE_URL (para back_urls)
 */
import { MercadoPagoConfig, Preference, Payment, PaymentRefund } from "mercadopago";
import { createHmac, timingSafeEqual } from "crypto";

export function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token || token.trim() === "") {
    throw new Error(
      "Falta MERCADOPAGO_ACCESS_TOKEN en el entorno del servidor. Configurá las credenciales de Mercado Pago (ver docs/MERCADO_PAGO.md)."
    );
  }
  return token.trim();
}

export function getWebhookSecret(): string {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "Falta MERCADOPAGO_WEBHOOK_SECRET en el entorno del servidor. Sin él no se pueden validar los webhooks."
    );
  }
  return secret.trim();
}

export function hasMercadoPagoConfig(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
}

export function hasWebhookSecret(): boolean {
  return !!process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
}

export function getMercadoPagoClient(): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken: getAccessToken() });
}

export interface PreferenceItemInput {
  id: string;
  title: string;
  quantity: number;
  unit_price: number; // en pesos (la API espera number con decimales)
  currency_id?: string;
}

export interface CreatePreferenceInput {
  externalReference: string; // order_number o id del pedido
  items: PreferenceItemInput[];
  payerEmail?: string;
  notificationUrl?: string;
}

export interface PreferenceResult {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

export async function createPreference(input: CreatePreferenceInput): Promise<PreferenceResult> {
  const client = getMercadoPagoClient();
  const pref = new Preference(client);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  const res = await pref.create({
    body: {
      items: input.items.map((it) => ({
        id: it.id,
        title: it.title,
        quantity: it.quantity,
        unit_price: it.unit_price,
        currency_id: it.currency_id || "ARS",
      })),
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
      back_urls: siteUrl
        ? {
            success: `${siteUrl}/checkout/resultado?status=success&order=${encodeURIComponent(input.externalReference)}`,
            pending: `${siteUrl}/checkout/resultado?status=pending&order=${encodeURIComponent(input.externalReference)}`,
            failure: `${siteUrl}/checkout/resultado?status=failure&order=${encodeURIComponent(input.externalReference)}`,
          }
        : undefined,
      auto_return: siteUrl ? "approved" : undefined,
    },
  });

  if (!res.id || !res.init_point) {
    throw new Error("Mercado Pago no devolvió un init_point válido.");
  }
  return { id: res.id, init_point: res.init_point, sandbox_init_point: res.sandbox_init_point };
}

export async function getPayment(paymentId: string | number): Promise<any> {
  const client = getMercadoPagoClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

export async function refundPayment(paymentId: string | number, amount?: number): Promise<any> {
  const client = getMercadoPagoClient();
  const refund = new PaymentRefund(client);
  if (amount && amount > 0) {
    return refund.create({ payment_id: paymentId, body: { amount } });
  }
  return refund.total({ payment_id: paymentId });
}

/**
 * Valida la firma del webhook de Mercado Pago.
 * Header x-signature: "ts=...,v1=..."
 * Header x-request-id: request id
 * Query param data.id (o body data.id)
 */
export function validateWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  if (!opts.signatureHeader) return false;
  const parts = opts.signatureHeader.split(",");
  const ts = parts.find((p) => p.trim().startsWith("ts="))?.split("=")[1]?.trim();
  const v1 = parts.find((p) => p.trim().startsWith("v1="))?.split("=")[1]?.trim();
  if (!ts || !v1) return false;

  const secret = getWebhookSecret();
  const manifest = `id:${opts.dataId ?? ""};request-id:${opts.requestId ?? ""};ts:${ts};`;
  const hmac = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

export function mapPaymentStatus(mpStatus: string | undefined): "pending" | "paid" | "rejected" | "refunded" {
  switch (mpStatus) {
    case "approved":
      return "paid";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "refunded":
    case "charged_back":
      return "refunded";
    default:
      return "pending";
  }
}
