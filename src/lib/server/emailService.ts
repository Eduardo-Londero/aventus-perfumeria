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
  return !!process.env.BREVO_API_KEY?.trim() || !!process.env.RESEND_API_KEY?.trim();
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  if (brevoKey) {
    return sendViaBrevo(brevoKey, input);
  }
  if (resendKey) {
    return sendViaResend(resendKey, input);
  }
  return {
    ok: false,
    message:
      "Falta BREVO_API_KEY o RESEND_API_KEY en el entorno del servidor. Configurá un proveedor de email (ver docs).",
  };
}

// ---------------------------------------------------------------------------
// Brevo (ex Sendinblue) — 9.000 emails/mes gratis
// ---------------------------------------------------------------------------
async function sendViaBrevo(apiKey: string, input: SendEmailInput): Promise<SendEmailResult> {
  const fromRaw = (process.env.EMAIL_FROM || "Aventus Perfumería <no-reply@aventus.com>").trim();
  const { name: fromName, email: fromEmail } = parseFrom(fromRaw);
  const replyTo = input.replyTo || process.env.EMAIL_REPLY_TO?.trim();

  const toList = Array.isArray(input.to) ? input.to : [input.to];

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: toList.map((e) => ({ email: e })),
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        replyTo: replyTo ? { email: replyTo } : undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message: (data as any)?.message || `Brevo respondió ${res.status}`,
      };
    }
    return { ok: true, id: (data as any)?.messageId };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Error enviando email (Brevo).",
    };
  }
}

// ---------------------------------------------------------------------------
// Resend — fallback
// ---------------------------------------------------------------------------
async function sendViaResend(apiKey: string, input: SendEmailInput): Promise<SendEmailResult> {
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
      message: err instanceof Error ? err.message : "Error enviando email (Resend).",
    };
  }
}

function parseFrom(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: "Aventus Perfumería", email: raw.trim() };
}