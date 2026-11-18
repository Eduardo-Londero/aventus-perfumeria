"use client";

import { useState } from "react";
import { generateWhatsAppUrl, siteConfig } from "@/config/site";

export default function ArrepentimientoPage() {
  const [form, setForm] = useState({ name: "", email: "", order: "", reason: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `Botón de arrepentimiento:\nNombre: ${form.name}\nEmail: ${form.email}\nPedido: ${form.order}\nMotivo: ${form.reason}`;
    window.open(generateWhatsAppUrl(msg), "_blank");
  };

  return (
    <div className="min-h-screen bg-cream-50 py-12">
      <div className="container-aventus max-w-xl">
        <h1 className="font-serif text-3xl text-charcoal-900 mb-2">Botón de Arrepentimiento</h1>
        <p className="text-charcoal-600 text-sm mb-6">
          Conforme a la Ley 24.240, podés arrepentirte de tu compra dentro de los 10 días corridos desde la recepción.
        </p>
        <form onSubmit={handleSubmit} className="bg-white border border-charcoal-100 rounded-lg p-6 space-y-4">
          <input
            type="text"
            placeholder="Nombre y apellido *"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="email"
            placeholder="Email *"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="text"
            placeholder="Número de pedido *"
            required
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <textarea
            placeholder="Motivo (opcional)"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button type="submit" className="w-full btn-primary">
            Enviar arrepentimiento
          </button>
        </form>
        <p className="text-xs text-charcoal-500 mt-4">
          También podés escribirnos directamente por WhatsApp: {siteConfig.whatsapp.number}
        </p>
      </div>
    </div>
  );
}