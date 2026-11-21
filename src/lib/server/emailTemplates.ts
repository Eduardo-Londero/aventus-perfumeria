export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: string; // formateado
  items: Array<{ name: string; quantity: number; subtotal: string }>;
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#faf9f6;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e4dc;max-width:600px;width:100%;">
        <tr><td style="padding:32px 40px;text-align:center;border-bottom:1px solid #e8e4dc;">
          <p style="margin:0;font-family:Georgia,serif;font-size:24px;letter-spacing:2px;color:#1a1a1a;">AVENTUS</p>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:3px;color:#b8956a;text-transform:uppercase;">Perfumería</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">${body}</td></tr>
        <tr><td style="padding:24px 40px;text-align:center;border-top:1px solid #e8e4dc;font-size:12px;color:#6b6b6b;">
          <p style="margin:0;">Aventus Perfumería · San Martín 629, San Miguel de Tucumán</p>
          <p style="margin:4px 0 0;">Consultas: consultas@aventus.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function orderReceivedEmail(d: OrderEmailData): { subject: string; html: string } {
  const itemsHtml = d.items
    .map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #f0eee8;">${i.name}</td><td style="padding:8px 0;border-bottom:1px solid #f0eee8;text-align:center;">${i.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #f0eee8;text-align:right;">${i.subtotal}</td></tr>`)
    .join("");
  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">Pedido recibido</h1>
    <p style="margin:0 0 16px;color:#6b6b6b;">Hola ${d.customerName}, recibimos tu pedido <strong>${d.orderNumber}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:16px 0;">
      <thead><tr><th align="left" style="padding:8px 0;border-bottom:2px solid #1a1a1a;">Producto</th><th align="center" style="padding:8px 0;border-bottom:2px solid #1a1a1a;">Cant.</th><th align="right" style="padding:8px 0;border-bottom:2px solid #1a1a1a;">Subtotal</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p style="margin:16px 0 0;text-align:right;font-weight:bold;">Total: ${d.total}</p>
    <p style="margin:24px 0 0;color:#6b6b6b;font-size:13px;">Te avisaremos cuando el pago se confirme. Si elegiste transferencia, recordá enviar el comprobante.</p>`;
  return { subject: `Pedido ${d.orderNumber} recibido — Aventus Perfumería`, html: layout("Pedido recibido", body) };
}

export function paymentApprovedEmail(d: OrderEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">Pago aprobado</h1>
    <p style="margin:0 0 16px;color:#6b6b6b;">Hola ${d.customerName}, tu pago para el pedido <strong>${d.orderNumber}</strong> fue aprobado correctamente.</p>
    <p style="margin:0 0 16px;">Total abonado: <strong>${d.total}</strong></p>
    <p style="margin:24px 0 0;color:#6b6b6b;font-size:13px;">Comenzaremos a preparar tu pedido. Te notificaremos cuando sea despachado.</p>`;
  return { subject: `Pago aprobado — Pedido ${d.orderNumber}`, html: layout("Pago aprobado", body) };
}

export function orderShippedEmail(d: OrderEmailData): { subject: string; html: string } {
  const trackingHtml = d.trackingCode
    ? `<p style="margin:16px 0;">Código de seguimiento: <strong>${d.trackingCode}</strong>${d.carrier ? ` (${d.carrier})` : ""}</p>${d.trackingUrl ? `<p style="margin:0;"><a href="${d.trackingUrl}" style="color:#b8956a;">Consultar envío</a></p>` : ""}`
    : "";
  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">Pedido despachado</h1>
    <p style="margin:0 0 16px;color:#6b6b6b;">Hola ${d.customerName}, tu pedido <strong>${d.orderNumber}</strong> fue despachado.</p>
    ${trackingHtml}
    <p style="margin:24px 0 0;color:#6b6b6b;font-size:13px;">Gracias por tu compra.</p>`;
  return { subject: `Pedido ${d.orderNumber} despachado — Aventus Perfumería`, html: layout("Pedido despachado", body) };
}

export function orderCancelledEmail(d: OrderEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">Pedido cancelado</h1>
    <p style="margin:0 0 16px;color:#6b6b6b;">Hola ${d.customerName}, tu pedido <strong>${d.orderNumber}</strong> fue cancelado.</p>
    <p style="margin:0 0 16px;">Si ya realizaste el pago, el reembolso se procesará según el método utilizado.</p>
    <p style="margin:24px 0 0;color:#6b6b6b;font-size:13px;">Si tenés dudas, contactanos.</p>`;
  return { subject: `Pedido ${d.orderNumber} cancelado — Aventus Perfumería`, html: layout("Pedido cancelado", body) };
}