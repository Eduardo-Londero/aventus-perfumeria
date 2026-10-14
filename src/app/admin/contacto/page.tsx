"use client";

import { useState } from "react";
import { siteConfig } from "@/config/site";
import { useToast } from "@/context/ToastContext";

export default function AdminContactoPage() {
  const { showToast } = useToast();
  const [content, setContent] = useState<{
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string;
    whatsapp: string;
    instagram: string;
    email: string;
    phone: string;
    address: string;
    mapsUrl: string;
  }>({
    heroTitle: "Hablemos",
    heroSubtitle: "Estamos para ayudarte. Escribinos por cualquiera de estos canales.",
    heroImage: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1920&q=80",
    whatsapp: siteConfig.whatsapp.number as string,
    instagram: siteConfig.instagram.username as string,
    email: "info@aventus.com",
    phone: siteConfig.store.phone as string,
    address: siteConfig.store.address as string,
    mapsUrl: siteConfig.store.mapsUrl as string,
  });

  const handleSave = () => {
    showToast("Contenido de Contacto actualizado correctamente");
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Contacto</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestioná el contenido de la página Contacto
        </p>
      </div>

      <div className="space-y-6">
        {/* Hero */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hero</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                type="text"
                value={content.heroTitle}
                onChange={(e) => setContent({ ...content, heroTitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
              <input
                type="text"
                value={content.heroSubtitle}
                onChange={(e) => setContent({ ...content, heroSubtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen</label>
              <input
                type="url"
                value={content.heroImage}
                onChange={(e) => setContent({ ...content, heroImage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
              <p className="text-xs text-gray-500 mt-1">Recomendado: 1920 × 700 px, JPG/WebP</p>
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de contacto</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input
                type="text"
                value={content.whatsapp}
                onChange={(e) => setContent({ ...content, whatsapp: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
              <input
                type="text"
                value={content.instagram}
                onChange={(e) => setContent({ ...content, instagram: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={content.email}
                onChange={(e) => setContent({ ...content, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={content.phone}
                onChange={(e) => setContent({ ...content, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>
        </div>

        {/* Local */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Local físico</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={content.address}
                onChange={(e) => setContent({ ...content, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL del mapa</label>
              <input
                type="url"
                value={content.mapsUrl}
                onChange={(e) => setContent({ ...content, mapsUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-3 bg-gold-600 text-white font-medium rounded-lg hover:bg-gold-700 transition-colors"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
