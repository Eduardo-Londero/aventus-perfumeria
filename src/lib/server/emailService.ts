/**
 * Servicio de email transaccional (Resend).
 * ========================================
 * Toda la lógica server-side. El frontend nunca toca la API key.
 *
 * Variables de entorno:
 *   - RESEND_API_KEY (obligatoria)
 *   - EMAIL_FROM (ej. "Aventus Perfumería <no-reply@tudominio.com>")
 *   - EMAIL_REPLY_TO (opcional)
 */
export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  message?: string;
}

export function hasEmailConfig(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      message:
        "Falta RESEND_API_KEY en el entorno del servidor. Configurá un proveedor de email (ver docs).",
    };
  }

  const from = (process.env.EMAIL_FROM || "Aventus Perfumería <onboarding@resend.dev>").trim();
  const replyTo = input.replyTo || process.env.EMAIL_REPLY_TO?.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: replyTo,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message: (data as any)?.message || `Resend respondió ${res.status}`,
      };
    }
    return { ok: true, id: (data as any)?.id };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Error enviando email.",
    };
  }
}